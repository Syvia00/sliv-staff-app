import { DayType } from "@/generated/prisma/enums";
import { parseUTCDateOnly } from "@/lib/date-utils";

/**
 * Pure, plain-number math shared by the client-side live preview and the
 * day-type/rate logic. Actual persisted money values are recomputed
 * server-side using Prisma.Decimal (see actions.ts) for currency precision -
 * these versions are for the "Estimated" preview only.
 */

export function deriveDayType(dateStr: string, holidayDateStrings: ReadonlySet<string>): DayType {
  if (holidayDateStrings.has(dateStr)) return DayType.public_holiday;
  const day = parseUTCDateOnly(dateStr).getUTCDay(); // 0 = Sunday .. 6 = Saturday
  if (day === 0) return DayType.sunday;
  if (day === 6) return DayType.saturday;
  return DayType.weekday;
}

export function getRateMultiplier(dayType: DayType): number {
  switch (dayType) {
    case DayType.public_holiday:
    case DayType.sunday:
      return 1.5;
    case DayType.saturday:
      return 1.25;
    default:
      return 1.0;
  }
}

export function getDayTypeLabel(dayType: DayType): string {
  switch (dayType) {
    case DayType.public_holiday:
      return "Public Holiday — 1.5x rate applied";
    case DayType.sunday:
      return "Sunday — 1.5x rate applied";
    case DayType.saturday:
      return "Saturday — 1.25x rate applied";
    default:
      return "Weekday — standard rate";
  }
}

/** "HH:MM" x2 -> decimal hours. A clock-out earlier than clock-in is treated as crossing midnight; equal times yield 0. */
export function computeHoursWorked(clockIn: string, clockOut: string): number {
  const [inH, inM] = clockIn.split(":").map(Number);
  const [outH, outM] = clockOut.split(":").map(Number);
  const startMin = inH * 60 + inM;
  let endMin = outH * 60 + outM;
  if (endMin < startMin) endMin += 24 * 60;
  return (endMin - startMin) / 60;
}

export function computeCommission(totalSales: number, threshold: number, rate: number): number {
  return Math.max(0, totalSales - threshold) * rate;
}

export function computeEstimatedTotalWage(params: {
  baseHourlyWage: number;
  rateMultiplier: number;
  hoursWorked: number;
  commission: number;
  extraCommission: number;
  transportFee: number;
}): number {
  const wageFromHours = params.baseHourlyWage * params.rateMultiplier * params.hoursWorked;
  return wageFromHours + params.commission + params.extraCommission + params.transportFee;
}
