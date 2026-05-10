import type { Prisma } from '@splash/db';
import { fromZonedTime } from 'date-fns-tz';

// =============================================================================
// Point-in-time availability check.
//
// Used by the public booking wizard's Step 2 ("When works best?"), which runs
// BEFORE the customer has chosen a package/vehicle, so we can't ask the full
// duration-aware engine. We only enforce the global business rules:
//
//   - schedule_exception (closed days / special hours)
//   - schedule_template kind='work' (working hours)
//   - schedule_template kind='break' (recurring breaks)
//   - schedule_block (manual blocked time, global or zone-scoped)
//
// Duration-aware checks (existing appointments, travel time, package fit
// inside the day's last window) happen later and at draft creation.
//
// IMPORTANT: working hours / breaks / manual blocked time are GLOBAL business
// rules. zoneId is optional and only used to honor legacy zone-scoped
// schedule_block rows so behavior stays consistent with the full engine.
// =============================================================================

export type PointReason = 'in_past' | 'closed' | 'outside_hours' | 'in_break' | 'in_block';

export type PointResult = {
  available: boolean;
  reason?: PointReason;
  /** UTC ISO of the local (date,time) interpreted in the business timezone. */
  isoStartsAt: string;
};

export type PointArgs = {
  businessId: string;
  date: string; // 'YYYY-MM-DD' in business timezone
  time: string; // 'HH:MM' in business timezone
  timezone: string;
  zoneId?: string;
};

export async function checkPointAvailability(
  tx: Prisma.TransactionClient,
  args: PointArgs,
): Promise<PointResult> {
  const { businessId, date, time, timezone, zoneId } = args;

  const startsAt = fromZonedTime(`${date}T${time}:00`, timezone);
  const isoStartsAt = startsAt.toISOString();

  if (startsAt.getTime() <= Date.now()) {
    return { available: false, reason: 'in_past', isoStartsAt };
  }

  // dayOfWeek matches the engine: parse the calendar date as UTC midnight and
  // take getUTCDay(). This is independent of the server's local timezone.
  const dayDate = new Date(`${date}T00:00:00.000Z`);
  const dayOfWeek = dayDate.getUTCDay();
  const pointMin = minutesOfDay(time);

  // Defensive row types — keep this file independent of Prisma's generated
  // row types in case they aren't fully available at build time.
  type ExceptionRow = { kind: string; payload: unknown };
  type ScheduleTemplateRow = { windowStart: Date; windowEnd: Date };
  type BlockIdRow = { id: string };

  const exceptions = (await tx.scheduleException.findMany({
    where: { businessId, exceptionDate: dayDate },
  })) as ExceptionRow[];

  if (exceptions.some((e) => e.kind === 'closed')) {
    return { available: false, reason: 'closed', isoStartsAt };
  }

  type Window = { startMin: number; endMin: number };
  let windows: Window[];
  const special = exceptions.find((e) => e.kind === 'special_hours');
  if (special) {
    const payload = special.payload as { windows?: Array<{ start: string; end: string }> };
    windows = (payload.windows ?? []).map((w) => ({
      startMin: minutesOfDay(w.start),
      endMin: minutesOfDay(w.end),
    }));
  } else {
    const tpls = (await tx.scheduleTemplate.findMany({
      where: { businessId, dayOfWeek, isActive: true, kind: 'work' },
    })) as ScheduleTemplateRow[];
    windows = tpls.map((t) => ({
      startMin: minutesFromTime(t.windowStart),
      endMin: minutesFromTime(t.windowEnd),
    }));
  }

  if (!windows.length || !windows.some((w) => pointMin >= w.startMin && pointMin < w.endMin)) {
    return { available: false, reason: 'outside_hours', isoStartsAt };
  }

  const breakRows = (await tx.scheduleTemplate.findMany({
    where: { businessId, dayOfWeek, isActive: true, kind: 'break' },
  })) as ScheduleTemplateRow[];
  if (breakRows.some((b) => {
    const bs = minutesFromTime(b.windowStart);
    const be = minutesFromTime(b.windowEnd);
    return pointMin >= bs && pointMin < be;
  })) {
    return { available: false, reason: 'in_break', isoStartsAt };
  }

  // schedule_block: any row whose [startsAt, endsAt) covers `startsAt`.
  // Match the engine's zone semantics: global blocks (zoneId IS NULL) always,
  // plus blocks for the chosen zone if one was provided.
  const blocks = (await tx.scheduleBlock.findMany({
    where: {
      businessId,
      startsAt: { lte: startsAt },
      endsAt: { gt: startsAt },
      OR: zoneId ? [{ zoneId: null }, { zoneId }] : [{ zoneId: null }],
    },
    select: { id: true },
  })) as BlockIdRow[];
  if (blocks.length) {
    return { available: false, reason: 'in_block', isoStartsAt };
  }

  return { available: true, isoStartsAt };
}

// --------------------------- helpers ---------------------------
function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function minutesFromTime(time: Date): number {
  // Prisma returns @db.Time as Date in UTC (1970-01-01T...).
  return time.getUTCHours() * 60 + time.getUTCMinutes();
}
