import type { Prisma } from '@splash/db';
import { fromZonedTime } from 'date-fns-tz';

// =============================================================================
// Day-slot enumeration for the public booking wizard's Step 2.
//
// Generates a 30-minute grid across the day's working windows and marks each
// slot as available or unavailable using the SAME global business rules the
// rest of the system reads:
//
//   - schedule_exception (closed days / special hours)
//   - schedule_template kind='work' (working hours)
//   - schedule_template kind='break' (recurring breaks)
//   - schedule_block (manual blocked time)
//   - appointment (conservative "all resources busy" check)
//
// IMPORTANT: this is a UX gate only. The full duration-aware engine still
// runs at draft creation (apps/web/actions/booking.ts) and is the
// authoritative gate. We pre-filter slots here so the customer never picks a
// time that's obviously unavailable.
// =============================================================================

export type SlotBucket = 'morning' | 'afternoon' | 'evening';

export type DaySlot = {
  /** "HH:MM" in the business timezone — stable key for the UI. */
  time: string;
  /** Human-readable label such as "8:00 AM" in the business timezone. */
  label: string;
  /** Canonical UTC ISO of the slot start, suitable for storing in WizardState.startsAtISO. */
  isoStartsAt: string;
  available: boolean;
  bucket: SlotBucket;
};

export type DaySlots = {
  closed: boolean;
  slots: DaySlot[];
};

const SLOT_MIN = 30;

export async function enumerateDaySlots(
  tx: Prisma.TransactionClient,
  args: {
    businessId: string;
    date: string; // YYYY-MM-DD interpreted in business timezone
    timezone: string;
    zoneId?: string;
  },
): Promise<DaySlots> {
  const { businessId, date, timezone, zoneId } = args;

  const dayDate = new Date(`${date}T00:00:00.000Z`);
  const dayOfWeek = dayDate.getUTCDay();
  const startOfDay = fromZonedTime(`${date}T00:00:00`, timezone);
  const endOfDay = fromZonedTime(`${date}T23:59:59`, timezone);

  const exceptions = await tx.scheduleException.findMany({
    where: { businessId, exceptionDate: dayDate },
  });
  if (exceptions.some((e) => e.kind === 'closed')) {
    return { closed: true, slots: [] };
  }

  type WindowMin = { startMin: number; endMin: number };
  let workWindows: WindowMin[];
  const special = exceptions.find((e) => e.kind === 'special_hours');
  if (special) {
    const payload = special.payload as { windows?: Array<{ start: string; end: string }> };
    workWindows = (payload.windows ?? []).map((w) => ({
      startMin: minutesOfDay(w.start),
      endMin: minutesOfDay(w.end),
    }));
  } else {
    const tpls = await tx.scheduleTemplate.findMany({
      where: { businessId, dayOfWeek, isActive: true, kind: 'work' },
    });
    workWindows = tpls.map((t) => ({
      startMin: minutesFromTime(t.windowStart),
      endMin: minutesFromTime(t.windowEnd),
    }));
  }
  if (!workWindows.length) {
    return { closed: true, slots: [] };
  }

  const breakRows = await tx.scheduleTemplate.findMany({
    where: { businessId, dayOfWeek, isActive: true, kind: 'break' },
  });
  const breakWindows: WindowMin[] = breakRows.map((b) => ({
    startMin: minutesFromTime(b.windowStart),
    endMin: minutesFromTime(b.windowEnd),
  }));

  const blocks = await tx.scheduleBlock.findMany({
    where: {
      businessId,
      startsAt: { lt: endOfDay },
      endsAt: { gt: startOfDay },
      OR: zoneId ? [{ zoneId: null }, { zoneId }] : [{ zoneId: null }],
    },
    select: { startsAt: true, endsAt: true },
  });

  const resources = await tx.resource.findMany({
    where: { businessId, isActive: true, archivedAt: null },
    select: { id: true },
  });
  const resourceCount = resources.length;

  const appointments = await tx.appointment.findMany({
    where: {
      businessId,
      status: { notIn: ['cancelled', 'no_show', 'draft', 'rescheduled'] },
      AND: [{ startsAt: { lt: endOfDay } }, { endsAt: { gt: startOfDay } }],
    },
    select: { startsAt: true, endsAt: true, resourceId: true },
  });

  const labelFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const slots: DaySlot[] = [];
  const now = Date.now();

  for (const w of workWindows) {
    for (let m = w.startMin; m + SLOT_MIN <= w.endMin; m += SLOT_MIN) {
      const time = minutesToHHMM(m);
      const slotStart = fromZonedTime(`${date}T${time}:00`, timezone);
      const slotEnd = new Date(slotStart.getTime() + SLOT_MIN * 60 * 1000);

      // Hide past slots — never useful in a booking flow.
      if (slotStart.getTime() <= now) continue;

      let available = true;

      // Slot overlaps a recurring break window.
      if (
        available &&
        breakWindows.some((b) => m < b.endMin && m + SLOT_MIN > b.startMin)
      ) {
        available = false;
      }

      // Slot overlaps a manual schedule_block.
      if (
        available &&
        blocks.some(
          (b) =>
            slotStart.getTime() < b.endsAt.getTime() &&
            slotEnd.getTime() > b.startsAt.getTime(),
        )
      ) {
        available = false;
      }

      // All active resources busy at this slot.
      if (available && resourceCount > 0) {
        const busy = new Set<string>();
        for (const a of appointments) {
          if (
            a.startsAt.getTime() < slotEnd.getTime() &&
            a.endsAt.getTime() > slotStart.getTime()
          ) {
            busy.add(a.resourceId);
          }
        }
        if (busy.size >= resourceCount) available = false;
      }

      slots.push({
        time,
        label: labelFmt.format(slotStart),
        isoStartsAt: slotStart.toISOString(),
        available,
        bucket: bucketFor(m),
      });
    }
  }

  return { closed: false, slots };
}

// --------------------------- helpers ---------------------------
function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesFromTime(time: Date): number {
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}

function minutesToHHMM(min: number): string {
  const h = Math.floor(min / 60).toString().padStart(2, '0');
  const m = (min % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function bucketFor(min: number): SlotBucket {
  if (min < 12 * 60) return 'morning';
  if (min < 17 * 60) return 'afternoon';
  return 'evening';
}
