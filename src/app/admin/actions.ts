"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import {
  createSession,
  destroySession,
  isLoginRateLimited,
  requireAdmin,
  verifyPassword,
} from "@/lib/auth";
import { fetchFilteredSubmissions, type RecordsFilter } from "@/lib/records";
import { formatUTCDateOnly, formatUTCTime, parseUTCDateOnly } from "@/lib/date-utils";
import { runNswHolidaySync, type SyncResult } from "@/lib/holiday-sync";
import { HolidaySource } from "@/generated/prisma/enums";

async function clientKey(): Promise<string> {
  const headersList = await headers();
  return headersList.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function login(password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = await clientKey();
  if (isLoginRateLimited(key)) {
    return { ok: false, error: "Too many attempts. Please try again in a few minutes." };
  }
  try {
    if (!verifyPassword(password)) {
      return { ok: false, error: "Incorrect password." };
    }
  } catch {
    return { ok: false, error: "Admin password is not configured on the server." };
  }
  await createSession();
  return { ok: true };
}

export async function logout(): Promise<void> {
  await destroySession();
}

// ---------- Employees ----------

export type EmployeeRow = { id: number; name: string; active: boolean };

export async function listEmployees(): Promise<EmployeeRow[]> {
  await requireAdmin();
  return prisma.employee.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
}

export async function createEmployee(name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name cannot be empty." };
  await prisma.employee.create({ data: { name: trimmed } });
  return { ok: true };
}

export async function updateEmployeeName(
  id: number,
  name: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name cannot be empty." };
  await prisma.employee.update({ where: { id }, data: { name: trimmed } });
  return { ok: true };
}

export async function setEmployeeActive(id: number, active: boolean): Promise<void> {
  await requireAdmin();
  await prisma.employee.update({ where: { id }, data: { active } });
}

// ---------- Stores ----------

export type StoreRow = {
  id: number;
  name: string;
  active: boolean;
  commissionThreshold: string;
  commissionRate: string;
};

function toStoreRow(s: {
  id: number;
  name: string;
  active: boolean;
  commissionThreshold: Prisma.Decimal;
  commissionRate: Prisma.Decimal;
}): StoreRow {
  return {
    id: s.id,
    name: s.name,
    active: s.active,
    commissionThreshold: s.commissionThreshold.toFixed(2),
    commissionRate: s.commissionRate.toString(),
  };
}

export async function listStores(): Promise<StoreRow[]> {
  await requireAdmin();
  const stores = await prisma.store.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  return stores.map(toStoreRow);
}

function parseNonNegativeDecimal(value: string, label: string): Prisma.Decimal {
  const trimmed = value.trim();
  if (trimmed === "" || Number.isNaN(Number(trimmed))) {
    throw new Error(`${label} must be a number.`);
  }
  const decimal = new Prisma.Decimal(trimmed);
  if (decimal.isNegative()) throw new Error(`${label} cannot be negative.`);
  return decimal;
}

export async function createStore(input: {
  name: string;
  commissionThreshold: string;
  commissionRate: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  try {
    const commissionThreshold = parseNonNegativeDecimal(input.commissionThreshold, "Commission threshold");
    const commissionRate = parseNonNegativeDecimal(input.commissionRate, "Commission rate");
    await prisma.store.create({ data: { name, commissionThreshold, commissionRate } });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid input." };
  }
}

export async function updateStore(
  id: number,
  input: { name: string; commissionThreshold: string; commissionRate: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  try {
    const commissionThreshold = parseNonNegativeDecimal(input.commissionThreshold, "Commission threshold");
    const commissionRate = parseNonNegativeDecimal(input.commissionRate, "Commission rate");
    await prisma.store.update({ where: { id }, data: { name, commissionThreshold, commissionRate } });
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid input." };
  }
}

export async function setStoreActive(id: number, active: boolean): Promise<void> {
  await requireAdmin();
  await prisma.store.update({ where: { id }, data: { active } });
}

// ---------- Records ----------

export type SubmissionRow = {
  id: number;
  date: string;
  employeeName: string;
  storeName: string;
  eftposAmount: string;
  cashAmount: string;
  clockIn: string;
  clockOut: string;
  baseHourlyWage: string;
  dayType: string;
  commission: string;
  extraCommission: string;
  transportReasonUsed: boolean;
  publicHoliday: boolean;
  transportFee: string;
  totalWage: string;
};

export async function getFilteredSubmissions(
  filter: RecordsFilter,
): Promise<{ rows: SubmissionRow[]; totalWageSum: string }> {
  await requireAdmin();
  const submissions = await fetchFilteredSubmissions(filter);

  let sum = new Prisma.Decimal(0);
  const rows: SubmissionRow[] = submissions.map((s) => {
    sum = sum.plus(s.totalWage);
    return {
      id: s.id,
      date: formatUTCDateOnly(s.date),
      employeeName: s.employee.name,
      storeName: s.store.name,
      eftposAmount: s.eftposAmount.toFixed(2),
      cashAmount: s.cashAmount.toFixed(2),
      clockIn: formatUTCTime(s.clockIn),
      clockOut: formatUTCTime(s.clockOut),
      baseHourlyWage: s.baseHourlyWage.toFixed(2),
      dayType: s.dayType,
      commission: s.commission.toFixed(2),
      extraCommission: s.extraCommission.toFixed(2),
      transportReasonUsed: s.transportReasonUsed,
      publicHoliday: s.publicHoliday,
      transportFee: s.transportFee.toFixed(2),
      totalWage: s.totalWage.toFixed(2),
    };
  });

  return { rows, totalWageSum: sum.toFixed(2) };
}

// ---------- Public Holidays ----------

export type HolidayRow = { id: number; date: string; name: string; source: HolidaySource };

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function listHolidays(): Promise<HolidayRow[]> {
  await requireAdmin();
  const rows = await prisma.publicHoliday.findMany({ orderBy: { date: "asc" } });
  return rows.map((h) => ({ id: h.id, date: formatUTCDateOnly(h.date), name: h.name, source: h.source }));
}

export async function createHoliday(input: {
  date: string;
  name: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  if (!DATE_ONLY_RE.test(input.date)) return { ok: false, error: "Invalid date." };
  try {
    await prisma.publicHoliday.create({
      data: { date: parseUTCDateOnly(input.date), name, source: HolidaySource.manual },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "A holiday already exists on this date. Edit or delete it instead." };
  }
}

export async function updateHoliday(
  id: number,
  input: { date: string; name: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdmin();
  const name = input.name.trim();
  if (!name) return { ok: false, error: "Name cannot be empty." };
  if (!DATE_ONLY_RE.test(input.date)) return { ok: false, error: "Invalid date." };
  try {
    // An admin explicitly editing any holiday takes manual ownership of it,
    // even if it was originally auto-synced.
    await prisma.publicHoliday.update({
      where: { id },
      data: { date: parseUTCDateOnly(input.date), name, source: HolidaySource.manual },
    });
    return { ok: true };
  } catch {
    return { ok: false, error: "A holiday already exists on this date." };
  }
}

export async function deleteHoliday(id: number): Promise<void> {
  await requireAdmin();
  // Safe to hard-delete: submissions snapshot their own day_type/public_holiday
  // at submission time and never reference this table live, so removing a row
  // here cannot corrupt historical records.
  await prisma.publicHoliday.delete({ where: { id } });
}

export async function syncNswHolidays(year: number): Promise<SyncResult> {
  await requireAdmin();
  return runNswHolidaySync(year);
}
