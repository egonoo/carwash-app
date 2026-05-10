import { requireSession } from '@/lib/auth';
import { withTenant } from '@/lib/rls';
import { prisma } from '@/lib/db';
import { hhmmFromTime } from '@/lib/availability/time';
import { WorkingHoursForm, type WorkingHoursInitial } from './WorkingHoursForm';
import { BreaksManager, type BreaksInitial } from './BreaksManager';
import { BlocksManager, type BlockRow } from './BlocksManager';

const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export default async function AvailabilityPage() {
  const session = await requireSession();

  const [templates, blocks, business] = await Promise.all([
    withTenant(session.activeBusinessId, (tx) =>
      tx.scheduleTemplate.findMany({
        where: { businessId: session.activeBusinessId },
        select: {
          id: true,
          dayOfWeek: true,
          windowStart: true,
          windowEnd: true,
          kind: true,
          isActive: true,
        },
      }),
    ),
    withTenant(session.activeBusinessId, (tx) =>
      tx.scheduleBlock.findMany({
        where: { businessId: session.activeBusinessId },
        orderBy: { startsAt: 'asc' },
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          reason: true,
        },
      }),
    ),
    prisma.business.findUnique({
      where: { id: session.activeBusinessId },
      select: { timezone: true },
    }),
  ]);

  const timezone = business?.timezone ?? 'America/New_York';

  // Build working hours initial state — 1 active row per day if present.
  const workingByDay = new Map<number, { start: string; end: string }>();
  for (const t of templates) {
    if (t.kind !== 'work' || !t.isActive) continue;
    if (!workingByDay.has(t.dayOfWeek)) {
      workingByDay.set(t.dayOfWeek, {
        start: hhmmFromTime(t.windowStart),
        end: hhmmFromTime(t.windowEnd),
      });
    }
  }
  const workingInitial: WorkingHoursInitial = {
    days: DAYS.map((dow) => {
      const w = workingByDay.get(dow);
      return {
        dayOfWeek: dow,
        enabled: Boolean(w),
        start: w?.start ?? '09:00',
        end: w?.end ?? '18:00',
      };
    }),
  };

  // Build breaks initial state — N break rows per day.
  const breaksByDay = new Map<number, Array<{ start: string; end: string }>>();
  for (const t of templates) {
    if (t.kind !== 'break' || !t.isActive) continue;
    const arr = breaksByDay.get(t.dayOfWeek) ?? [];
    arr.push({
      start: hhmmFromTime(t.windowStart),
      end: hhmmFromTime(t.windowEnd),
    });
    breaksByDay.set(t.dayOfWeek, arr);
  }
  const breaksInitial: BreaksInitial = {
    days: DAYS.map((dow) => ({
      dayOfWeek: dow,
      windows: (breaksByDay.get(dow) ?? []).sort((a, b) => a.start.localeCompare(b.start)),
    })),
  };

  // Build blocks rows — render dates in the business timezone (server-side).
  const blockFormatDate = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const blockFormatTime = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const blockFormatYMD = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const blockFormatHHMM = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const blockRows: BlockRow[] = blocks.map((b) => {
    const sameDay =
      blockFormatYMD.format(b.startsAt) === blockFormatYMD.format(b.endsAt);
    const startHHMM = blockFormatHHMM.format(b.startsAt);
    const endHHMM = blockFormatHHMM.format(b.endsAt);
    const allDay = sameDay && startHHMM === '00:00' && endHHMM === '23:59';
    return {
      id: b.id,
      dateLabel: blockFormatDate.format(b.startsAt),
      ymd: blockFormatYMD.format(b.startsAt),
      startHHMM,
      endHHMM,
      timeLabel: allDay
        ? 'All day'
        : `${blockFormatTime.format(b.startsAt)} – ${blockFormatTime.format(b.endsAt)}`,
      allDay,
      reason: b.reason,
      pastDue: b.endsAt.getTime() < Date.now(),
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Availability</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Control working hours, breaks, and unavailable time.
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          Timezone: <span className="font-medium">{timezone}</span>
        </p>
      </header>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Working hours</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Days and time windows when you accept bookings.
        </p>
        <div className="mt-4">
          <WorkingHoursForm initial={workingInitial} />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Break hours</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Optional recurring breaks within working hours (lunch, etc.). These block
          new bookings.
        </p>
        <div className="mt-4">
          <BreaksManager initial={breaksInitial} />
        </div>
      </section>

      <section className="rounded border bg-white p-4">
        <h2 className="font-semibold">Manual blocked time</h2>
        <p className="mt-1 text-xs text-neutral-500">
          One-off unavailable periods (vacation, personal appointments). These take
          precedence over working hours.
        </p>
        <div className="mt-4">
          <BlocksManager rows={blockRows} timezone={timezone} />
        </div>
      </section>

      <section className="rounded border border-dashed bg-neutral-50 p-4">
        <h2 className="font-semibold text-neutral-700">Google Calendar busy sync</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Coming soon. Once enabled, busy events from your connected Google Calendar
          will additionally block availability. The admin panel above remains the
          primary source of truth.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          Manage the Google Calendar connection in{' '}
          <a className="underline" href="/settings">
            Settings
          </a>
          .
        </p>
      </section>
    </div>
  );
}
