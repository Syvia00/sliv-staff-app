import type { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { fetchFilteredSubmissions } from "@/lib/records";
import { formatUTCDateOnly, formatUTCTime } from "@/lib/date-utils";

function csvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const employeeIdParam = searchParams.get("employeeId");
  const storeIdParam = searchParams.get("storeId");

  const submissions = await fetchFilteredSubmissions({
    dateFrom: searchParams.get("dateFrom") || undefined,
    dateTo: searchParams.get("dateTo") || undefined,
    employeeId: employeeIdParam ? Number(employeeIdParam) : undefined,
    storeId: storeIdParam ? Number(storeIdParam) : undefined,
  });

  const header = [
    "id",
    "date",
    "employee_id",
    "store_id",
    "eftpos_amount",
    "cash_amount",
    "clock_in",
    "clock_out",
    "base_hourly_wage",
    "day_type",
    "commission",
    "extra_commission",
    "transport_reason_used",
    "public_holiday",
    "transport_fee",
    "total_wage",
  ];

  const lines = [header.join(",")];
  for (const s of submissions) {
    lines.push(
      [
        s.id,
        formatUTCDateOnly(s.date),
        s.employeeId,
        s.storeId,
        s.eftposAmount.toFixed(2),
        s.cashAmount.toFixed(2),
        formatUTCTime(s.clockIn),
        formatUTCTime(s.clockOut),
        s.baseHourlyWage.toFixed(2),
        s.dayType,
        s.commission.toFixed(2),
        s.extraCommission.toFixed(2),
        s.transportReasonUsed ? "true" : "false",
        s.publicHoliday ? "true" : "false",
        s.transportFee.toFixed(2),
        s.totalWage.toFixed(2),
      ]
        .map((v) => csvField(String(v)))
        .join(","),
    );
  }

  const csv = lines.join("\r\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="submissions_export.csv"',
    },
  });
}
