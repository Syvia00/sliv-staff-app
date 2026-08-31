"use server";

import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { DayType } from "@/generated/prisma/enums";
import { parseUTCDateOnly, timeStringToUTCDate, getIsoWeekRangeUTC } from "@/lib/date-utils";

export type SubmitInput = {
  date: string; // "YYYY-MM-DD"
  employeeId: number;
  storeId: number;
  eftposAmount: string;
  cashAmount: string;
  clockIn: string; // "HH:MM"
  clockOut: string; // "HH:MM"
  baseHourlyWage: string;
  extraCommission: string;
  transportReasonUsed: boolean;
  transportFee: string;
};

export type SubmitResult = { ok: true; id: number } | { ok: false; error: string };

/** Has this employee already used the transport allowance in the ISO (Mon-Sun) week containing `dateStr`? */
export async function checkTransportUsedThisWeek(employeeId: number, dateStr: string): Promise<boolean> {
  const { start, end } = getIsoWeekRangeUTC(parseUTCDateOnly(dateStr));
  const count = await prisma.submission.count({
    where: {
      employeeId,
      transportReasonUsed: true,
      date: { gte: start, lt: end },
    },
  });
  return count > 0;
}

function toDecimal(value: string, fieldLabel: string): Prisma.Decimal {
  const trimmed = value.trim();
  if (trimmed === "" || Number.isNaN(Number(trimmed))) {
    throw new Error(`${fieldLabel} must be a number.`);
  }
  const decimal = new Prisma.Decimal(trimmed);
  if (decimal.isNegative()) {
    throw new Error(`${fieldLabel} cannot be negative.`);
  }
  return decimal;
}

export async function submitEntry(input: SubmitInput): Promise<SubmitResult> {
  try {
    const employee = await prisma.employee.findUnique({ where: { id: input.employeeId } });
    if (!employee || !employee.active) {
      return { ok: false, error: "Selected employee is not available." };
    }

    const store = await prisma.store.findUnique({ where: { id: input.storeId } });
    if (!store || !store.active) {
      return { ok: false, error: "Selected store is not available." };
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date)) {
      return { ok: false, error: "Invalid date." };
    }
    if (!/^\d{2}:\d{2}$/.test(input.clockIn) || !/^\d{2}:\d{2}$/.test(input.clockOut)) {
      return { ok: false, error: "Invalid clock-in/clock-out time." };
    }

    const eftposAmount = toDecimal(input.eftposAmount, "EFTPOS amount");
    const cashAmount = toDecimal(input.cashAmount, "Cash amount");
    const baseHourlyWage = toDecimal(input.baseHourlyWage, "Base hourly wage");
    const extraCommission = toDecimal(input.extraCommission || "0", "Extra commission");
    const transportFee = toDecimal(input.transportFee || "0", "Transport fee");

    const dateUTC = parseUTCDateOnly(input.date);
    const clockInDate = timeStringToUTCDate(input.clockIn);
    const clockOutDate = timeStringToUTCDate(input.clockOut);

    const startMin = clockInDate.getUTCHours() * 60 + clockInDate.getUTCMinutes();
    let endMin = clockOutDate.getUTCHours() * 60 + clockOutDate.getUTCMinutes();
    if (endMin < startMin) endMin += 24 * 60; // crossed midnight (equal times stay 0, rejected below)
    const hoursWorked = new Prisma.Decimal(endMin - startMin).dividedBy(60);

    if (hoursWorked.equals(0)) {
      return { ok: false, error: "Clock-in and clock-out cannot be the same time." };
    }

    const holiday = await prisma.publicHoliday.findUnique({ where: { date: dateUTC } });
    let dayType: DayType;
    if (holiday) {
      dayType = DayType.public_holiday;
    } else {
      const day = dateUTC.getUTCDay(); // 0 = Sunday .. 6 = Saturday
      dayType = day === 0 ? DayType.sunday : day === 6 ? DayType.saturday : DayType.weekday;
    }
    const isPublicHoliday = dayType === DayType.public_holiday;

    const rateMultiplier =
      dayType === DayType.public_holiday || dayType === DayType.sunday
        ? new Prisma.Decimal("1.5")
        : dayType === DayType.saturday
          ? new Prisma.Decimal("1.25")
          : new Prisma.Decimal("1");

    const totalSales = eftposAmount.plus(cashAmount);
    const commission = Prisma.Decimal.max(0, totalSales.minus(store.commissionThreshold)).times(
      store.commissionRate,
    );

    const wageFromHours = baseHourlyWage.times(rateMultiplier).times(hoursWorked);
    const totalWage = wageFromHours.plus(commission).plus(extraCommission).plus(transportFee);

    const transportReasonUsed = input.transportReasonUsed;
    if (transportReasonUsed) {
      const alreadyUsed = await checkTransportUsedThisWeek(input.employeeId, input.date);
      if (alreadyUsed) {
        return {
          ok: false,
          error: "Transport allowance has already been used this week for this employee.",
        };
      }
    }

    const submission = await prisma.submission.create({
      data: {
        date: dateUTC,
        employeeId: input.employeeId,
        storeId: input.storeId,
        eftposAmount,
        cashAmount,
        clockIn: clockInDate,
        clockOut: clockOutDate,
        baseHourlyWage,
        dayType,
        commission,
        extraCommission,
        transportReasonUsed,
        publicHoliday: isPublicHoliday,
        transportFee,
        totalWage,
      },
    });

    return { ok: true, id: submission.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
    return { ok: false, error: message };
  }
}
