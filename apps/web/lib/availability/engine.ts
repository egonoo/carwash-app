import type { Prisma } from '@splash/db';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

export type AvailabilitySlot = {
  startsAt: Date;
  endsAt: Date;
  resourceId: string;
};

export type AvailabilityInput = {
  businessId: string;
  zoneId: string;
  date: string; // ISO date (YYYY-MM-DD) en TZ del negocio
  packageId: string;
  vehicleTypeId: string;
  addonIds: string[];
  timezone: string;
  slotGranularityMinutes?: number; // default 15
};

/**
 * Computa slots disponibles. Respeta:
 *  - schedule_template (ventanas por día de semana)
 *  - schedule_exception (cerrado / horas especiales por fecha)
 *  - schedule_template_zone (zona activa ese día)
 *  - schedule_block (bloqueos manuales)
 *  - appointments existentes con EXCLUDE constraint (por recurso)
 *  - tiempo de viaje entre zonas (zone_travel_time o default del negocio)
 *  - duración real del paquete + add-ons seleccionados
 *
 * Lectura pura. No escribe.
 */
export async function computeAvailability(
  tx: Prisma.TransactionClient,
  input: AvailabilityInput,
): Promise<AvailabilitySlot[]> {
  const granularity = input.slotGranularityMinutes ?? 15;
  const tz = input.timezone;

  // 1. Duración total
  const pkgPrice = await tx.packagePrice.findUnique({
    where: {
      packageId_vehicleTypeId: { packageId: input.packageId, vehicleTypeId: input.vehicleTypeId },
    },
  });
  if (!pkgPrice || !pkgPrice.isAvailable) return [];

  let duration = pkgPrice.durationMinutes;
  if (input.addonIds.length) {
    const addons = await tx.addon.findMany({
      where: { id: { in: input.addonIds }, businessId: input.businessId, isActive: true, archivedAt: null },
      select: { id: true, durationMinutes: true },
    });
    duration += addons.reduce((s, a) => s + a.durationMinutes, 0);
  }
  if (duration <= 0) return [];

  // 2. Día de la semana (0 = domingo en Postgres y en nuestra config)
  const dayDate = new Date(`${input.date}T00:00:00`);
  const dayOfWeek = dayDate.getUTCDay(); // dado ISO date, getUTCDay es estable
  // Construimos 00:00 y 23:59 en la TZ del negocio
  const startOfDayLocal = fromZonedTime(`${input.date}T00:00:00`, tz);
  const endOfDayLocal = fromZonedTime(`${input.date}T23:59:59`, tz);

  // 3. ¿Hay exception del día?
  const exceptions = await tx.scheduleException.findMany({
    where: { businessId: input.businessId, exceptionDate: dayDate },
  });
  const closed = exceptions.some((e) => e.kind === 'closed');
  if (closed) return [];

  // 4. Ventanas de trabajo: exception con special_hours o template del día
  type Window = { startMinutes: number; endMinutes: number };
  let windows: Window[] = [];
  const special = exceptions.find((e) => e.kind === 'special_hours');
  if (special) {
    const payload = special.payload as { windows?: Array<{ start: string; end: string }> };
    windows = (payload.windows ?? []).map((w) => ({
      startMinutes: minutesOfDay(w.start),
      endMinutes: minutesOfDay(w.end),
    }));
  } else {
    const templates = await tx.scheduleTemplate.findMany({
      where: { businessId: input.businessId, dayOfWeek, isActive: true, kind: 'work' },
    });
    windows = templates.map((t) => ({
      startMinutes: minutesFromTime(t.windowStart),
      endMinutes: minutesFromTime(t.windowEnd),
    }));
  }
  if (!windows.length) return [];

  // 4b. Restar break windows recurrentes (kind = 'break') de las ventanas de trabajo.
  const breakRows = await tx.scheduleTemplate.findMany({
    where: { businessId: input.businessId, dayOfWeek, isActive: true, kind: 'break' },
  });
  if (breakRows.length) {
    const breaks: Window[] = breakRows.map((b) => ({
      startMinutes: minutesFromTime(b.windowStart),
      endMinutes: minutesFromTime(b.windowEnd),
    }));
    windows = subtractWindows(windows, breaks);
    if (!windows.length) return [];
  }

  // 5. ¿Zona activa ese día?
  //    Exception zone_change override, else schedule_template_zone
  const zoneChange = exceptions.find((e) => e.kind === 'zone_change');
  let zonesActive: string[];
  if (zoneChange) {
    const payload = zoneChange.payload as { zone_ids?: string[] };
    zonesActive = payload.zone_ids ?? [];
  } else {
    const assignments = await tx.scheduleTemplateZone.findMany({
      where: { businessId: input.businessId, dayOfWeek },
      select: { zoneId: true },
    });
    zonesActive = assignments.map((a) => a.zoneId);
  }
  if (!zonesActive.includes(input.zoneId)) return [];

  // 6. Business defaults (travel time)
  const business = await tx.business.findUniqueOrThrow({
    where: { id: input.businessId },
    select: { defaultTravelTimeMin: true },
  });

  // 7. Bloqueos manuales
  const blocks = await tx.scheduleBlock.findMany({
    where: {
      businessId: input.businessId,
      AND: [{ startsAt: { lt: endOfDayLocal } }, { endsAt: { gt: startOfDayLocal } }],
      OR: [{ zoneId: null }, { zoneId: input.zoneId }],
    },
  });

  // 8. Recursos activos
  const resources = await tx.resource.findMany({
    where: { businessId: input.businessId, isActive: true, archivedAt: null },
    orderBy: { displayOrder: 'asc' },
  });
  if (!resources.length) return [];

  // 9. Citas existentes del día (todos los recursos, para calcular travel adyacente)
  const existing = await tx.appointment.findMany({
    where: {
      businessId: input.businessId,
      status: { notIn: ['cancelled', 'no_show', 'draft', 'rescheduled'] },
      AND: [{ startsAt: { lt: endOfDayLocal } }, { endsAt: { gt: startOfDayLocal } }],
    },
    select: { id: true, startsAt: true, endsAt: true, resourceId: true, zoneId: true },
  });
  const byResource = new Map<string, typeof existing>();
  for (const a of existing) {
    const arr = byResource.get(a.resourceId) ?? [];
    arr.push(a);
    byResource.set(a.resourceId, arr);
  }

  // 10. Travel times
  const ttRows = await tx.zoneTravelTime.findMany({
    where: { businessId: input.businessId },
  });
  const travelFn = (fromZoneId: string, toZoneId: string): number => {
    if (fromZoneId === toZoneId) return 0;
    const tt = ttRows.find(
      (r) =>
        (r.fromZoneId === fromZoneId && r.toZoneId === toZoneId) ||
        (r.fromZoneId === toZoneId && r.toZoneId === fromZoneId),
    );
    return tt?.minutes ?? business.defaultTravelTimeMin;
  };

  // 11. Generar candidatos
  const slots: AvailabilitySlot[] = [];
  const seenStarts = new Set<number>();

  for (const w of windows) {
    for (let t = w.startMinutes; t + duration <= w.endMinutes; t += granularity) {
      const startLocalStr = `${input.date}T${minutesToTimeString(t)}:00`;
      const endLocalStr = `${input.date}T${minutesToTimeString(t + duration)}:00`;
      const startsAt = fromZonedTime(startLocalStr, tz);
      const endsAt = fromZonedTime(endLocalStr, tz);

      // blocks globales que caen en [starts, ends]
      if (blocks.some((b) => overlaps(b.startsAt, b.endsAt, startsAt, endsAt) && !b.resourceId)) {
        continue;
      }

      // buscar un recurso libre + travel time ok
      let chosen: string | null = null;
      for (const r of resources) {
        // block específico del recurso
        if (
          blocks.some(
            (b) => b.resourceId === r.id && overlaps(b.startsAt, b.endsAt, startsAt, endsAt),
          )
        ) continue;
        const appts = byResource.get(r.id) ?? [];

        // ningún solape directo
        if (appts.some((a) => overlaps(a.startsAt, a.endsAt, startsAt, endsAt))) continue;

        // travel desde la cita previa
        const prev = appts.filter((a) => a.endsAt <= startsAt).sort((a, b) => b.endsAt.getTime() - a.endsAt.getTime())[0];
        if (prev) {
          const needed = travelFn(prev.zoneId, input.zoneId) * 60 * 1000;
          if (prev.endsAt.getTime() + needed > startsAt.getTime()) continue;
        }
        // travel hasta la siguiente cita
        const next = appts.filter((a) => a.startsAt >= endsAt).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];
        if (next) {
          const needed = travelFn(input.zoneId, next.zoneId) * 60 * 1000;
          if (endsAt.getTime() + needed > next.startsAt.getTime()) continue;
        }
        chosen = r.id;
        break;
      }

      if (!chosen) continue;
      const key = startsAt.getTime();
      if (seenStarts.has(key)) continue;
      seenStarts.add(key);
      slots.push({ startsAt, endsAt, resourceId: chosen });
    }
  }

  return slots;
}

// --------------------------- helpers ---------------------------
function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesFromTime(time: Date): number {
  // Prisma devuelve campo @db.Time como Date en UTC (1970-01-01T08:00:00Z)
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

function minutesToTimeString(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Resta `cuts` (en minutos del día) de cada ventana de `base` y devuelve
 * los segmentos resultantes. Útil para excluir breaks recurrentes de los
 * horarios de trabajo. No muta los inputs.
 */
function subtractWindows(
  base: Array<{ startMinutes: number; endMinutes: number }>,
  cuts: Array<{ startMinutes: number; endMinutes: number }>,
): Array<{ startMinutes: number; endMinutes: number }> {
  let segments = base.map((w) => ({ ...w }));
  for (const cut of cuts) {
    const next: typeof segments = [];
    for (const seg of segments) {
      if (cut.endMinutes <= seg.startMinutes || cut.startMinutes >= seg.endMinutes) {
        next.push(seg);
        continue;
      }
      if (cut.startMinutes > seg.startMinutes) {
        next.push({ startMinutes: seg.startMinutes, endMinutes: cut.startMinutes });
      }
      if (cut.endMinutes < seg.endMinutes) {
        next.push({ startMinutes: cut.endMinutes, endMinutes: seg.endMinutes });
      }
    }
    segments = next;
  }
  return segments;
}

export { toZonedTime };
