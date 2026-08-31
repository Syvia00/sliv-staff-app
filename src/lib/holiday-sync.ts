import { prisma } from "@/lib/prisma";
import { HolidaySource } from "@/generated/prisma/enums";
import { fetchNswHolidays } from "@/lib/nager";
import { formatUTCDateOnly, parseUTCDateOnly } from "@/lib/date-utils";

export type SyncResult =
  | {
      ok: true;
      year: number;
      totalFetched: number;
      added: number;
      skippedManual: number;
      removedStale: number;
    }
  | { ok: false; error: string };

/**
 * Syncs national + NSW public holidays for `year` from Nager.Date into the
 * public_holidays table as source "auto". Manual entries on the same date
 * are preserved untouched; stale auto entries no longer returned by the API
 * are removed. No auth check here - callers must gate this themselves.
 */
export async function runNswHolidaySync(year: number): Promise<SyncResult> {
  let fetched: { date: string; name: string }[];
  try {
    fetched = await fetchNswHolidays(year);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to fetch holidays." };
  }

  const yearStart = parseUTCDateOnly(`${year}-01-01`);
  const yearEnd = parseUTCDateOnly(`${year + 1}-01-01`);
  const existing = await prisma.publicHoliday.findMany({ where: { date: { gte: yearStart, lt: yearEnd } } });
  const existingByDate = new Map(existing.map((h) => [formatUTCDateOnly(h.date), h]));
  const fetchedDates = new Set(fetched.map((f) => f.date));

  let added = 0;
  let skippedManual = 0;

  await prisma.$transaction(async (tx) => {
    const staleAutoIds = existing
      .filter((h) => h.source === HolidaySource.auto && !fetchedDates.has(formatUTCDateOnly(h.date)))
      .map((h) => h.id);
    if (staleAutoIds.length > 0) {
      await tx.publicHoliday.deleteMany({ where: { id: { in: staleAutoIds } } });
    }

    for (const h of fetched) {
      const existingRow = existingByDate.get(h.date);
      if (existingRow?.source === HolidaySource.manual) {
        skippedManual += 1;
        continue;
      }
      if (existingRow) {
        if (existingRow.name !== h.name) {
          await tx.publicHoliday.update({ where: { id: existingRow.id }, data: { name: h.name } });
        }
      } else {
        await tx.publicHoliday.create({
          data: { date: parseUTCDateOnly(h.date), name: h.name, source: HolidaySource.auto },
        });
        added += 1;
      }
    }
  });

  const removedStale = existing.filter(
    (h) => h.source === HolidaySource.auto && !fetchedDates.has(formatUTCDateOnly(h.date)),
  ).length;

  return { ok: true, year, totalFetched: fetched.length, added, skippedManual, removedStale };
}
