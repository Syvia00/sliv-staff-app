import { prisma } from "@/lib/prisma";
import { formatUTCDateOnly } from "@/lib/date-utils";
import StaffForm from "./StaffForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [employees, stores, holidays] = await Promise.all([
    prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.store.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, commissionThreshold: true, commissionRate: true },
    }),
    prisma.publicHoliday.findMany({ select: { date: true } }),
  ]);

  const stores_ = stores.map((s) => ({
    id: s.id,
    name: s.name,
    commissionThreshold: Number(s.commissionThreshold),
    commissionRate: Number(s.commissionRate),
  }));

  const holidayDates = holidays.map((h) => formatUTCDateOnly(h.date));

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-1 text-2xl font-semibold text-neutral-900">Shift Submission</h1>
        <p className="mb-6 text-sm text-neutral-500">
          Enter your shift details below. Your commission and total wage are calculated automatically.
        </p>
        <StaffForm employees={employees} stores={stores_} holidayDates={holidayDates} />
      </div>
    </main>
  );
}
