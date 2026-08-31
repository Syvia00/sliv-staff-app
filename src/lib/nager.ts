type NagerHoliday = {
  date: string;
  localName: string;
  name: string;
  countryCode: string;
  fixed: boolean;
  global: boolean;
  counties: string[] | null;
  launchYear: number | null;
  types: string[];
};

export type FetchedHoliday = { date: string; name: string };

/**
 * Pulls AU public holidays for `year` from the Nager.Date API and filters to
 * ones that apply nationally (`global: true`) or specifically to NSW
 * (`counties` includes "AU-NSW"). Called only from the admin sync action -
 * never from the staff form's request path.
 */
export async function fetchNswHolidays(year: number): Promise<FetchedHoliday[]> {
  const res = await fetch(`https://date.nager.at/api/v3/publicholidays/${year}/AU`, {
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Nager.Date API returned ${res.status} ${res.statusText}`);
  }
  const data = (await res.json()) as NagerHoliday[];

  const filtered = data.filter((h) => h.global === true || (h.counties?.includes("AU-NSW") ?? false));

  // Defensive dedupe by date - the current AU dataset never collides within
  // the global+NSW subset, but a same-date collision must not crash the sync.
  const byDate = new Map<string, string>();
  for (const h of filtered) {
    // localName over name: Nager's `name` is an internationalized label (e.g.
    // "St. Stephen's Day" for what AU calls "Boxing Day") - localName matches
    // what Australian staff/admins actually expect to see.
    byDate.set(h.date, h.localName);
  }
  return Array.from(byDate.entries()).map(([date, name]) => ({ date, name }));
}
