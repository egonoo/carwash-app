// Pure helpers for converting between Prisma @db.Time Date values and
// "HH:MM" strings. Lives outside actions/ because non-async exports are
// not allowed in 'use server' files.

/** Convert "HH:MM" → Date for Prisma @db.Time (stored as 1970-01-01 UTC). */
export function timeFromHHMM(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

/** Convert Prisma @db.Time Date back to "HH:MM". */
export function hhmmFromTime(d: Date): string {
  const h = d.getUTCHours().toString().padStart(2, '0');
  const m = d.getUTCMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
