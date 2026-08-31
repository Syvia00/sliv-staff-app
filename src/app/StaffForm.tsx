"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { checkTransportUsedThisWeek, submitEntry } from "./actions";
import {
  computeCommission,
  computeEstimatedTotalWage,
  computeHoursWorked,
  deriveDayType,
  getDayTypeLabel,
  getRateMultiplier,
} from "@/lib/calculations";

type Employee = { id: number; name: string };
type Store = { id: number; name: string; commissionThreshold: number; commissionRate: number };

type Props = {
  employees: Employee[];
  stores: Store[];
  holidayDates: string[];
};

type Step = "form" | "confirm" | "success";
type TransportCheckState = "idle" | "checking" | "available" | "used";

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return "$0.00";
  return `$${n.toFixed(2)}`;
}

function parseAmount(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function StaffForm({ employees, stores, holidayDates }: Props) {
  const holidaySet = useMemo(() => new Set(holidayDates), [holidayDates]);

  const [step, setStep] = useState<Step>("form");

  const [date, setDate] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [storeId, setStoreId] = useState("");
  const [eftposAmount, setEftposAmount] = useState("");
  const [cashAmount, setCashAmount] = useState("");
  const [clockIn, setClockIn] = useState("");
  const [clockOut, setClockOut] = useState("");
  const [baseHourlyWage, setBaseHourlyWage] = useState("");
  const [extraCommission, setExtraCommission] = useState("");
  const [transportReasonUsed, setTransportReasonUsed] = useState(false);
  const [transportFee, setTransportFee] = useState("");

  const [transportChecking, startTransportCheck] = useTransition();
  const [transportUsed, setTransportUsed] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedId, setSubmittedId] = useState<number | null>(null);

  const selectedStore = useMemo(() => stores.find((s) => String(s.id) === storeId), [stores, storeId]);
  const selectedEmployee = useMemo(
    () => employees.find((e) => String(e.id) === employeeId),
    [employees, employeeId],
  );

  const dayType = date ? deriveDayType(date, holidaySet) : null;
  const dayTypeLabel = dayType ? getDayTypeLabel(dayType) : null;
  const rateMultiplier = dayType ? getRateMultiplier(dayType) : 1;

  const hoursWorked = clockIn && clockOut ? computeHoursWorked(clockIn, clockOut) : 0;
  const totalSales = parseAmount(eftposAmount) + parseAmount(cashAmount);
  const commission = selectedStore
    ? computeCommission(totalSales, selectedStore.commissionThreshold, selectedStore.commissionRate)
    : 0;
  const estimatedTotalWage = computeEstimatedTotalWage({
    baseHourlyWage: parseAmount(baseHourlyWage),
    rateMultiplier,
    hoursWorked,
    commission,
    extraCommission: parseAmount(extraCommission),
    transportFee: parseAmount(transportFee),
  });

  // Re-check transport allowance availability whenever employee or date changes.
  useEffect(() => {
    if (!employeeId || !date) {
      return;
    }
    let cancelled = false;
    startTransportCheck(async () => {
      try {
        const used = await checkTransportUsedThisWeek(Number(employeeId), date);
        if (cancelled) return;
        setTransportUsed(used);
        if (used) setTransportReasonUsed(false);
      } catch {
        if (!cancelled) setTransportUsed(null);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [employeeId, date]);

  const transportCheck: TransportCheckState =
    !employeeId || !date
      ? "idle"
      : transportChecking
        ? "checking"
        : transportUsed === true
          ? "used"
          : transportUsed === false
            ? "available"
            : "idle";

  const transportCheckboxDisabled = transportCheck !== "available";

  const isFormValid =
    date !== "" &&
    employeeId !== "" &&
    storeId !== "" &&
    eftposAmount !== "" &&
    cashAmount !== "" &&
    clockIn !== "" &&
    clockOut !== "" &&
    baseHourlyWage !== "" &&
    hoursWorked > 0;

  async function handleConfirmSubmit() {
    setSubmitting(true);
    setSubmitError(null);
    const result = await submitEntry({
      date,
      employeeId: Number(employeeId),
      storeId: Number(storeId),
      eftposAmount,
      cashAmount,
      clockIn,
      clockOut,
      baseHourlyWage,
      extraCommission: extraCommission || "0",
      transportReasonUsed,
      transportFee: transportFee || "0",
    });
    setSubmitting(false);
    if (result.ok) {
      setSubmittedId(result.id);
      setStep("success");
    } else {
      setSubmitError(result.error);
    }
  }

  function handleSubmitAnother() {
    setStep("form");
    setDate("");
    setEmployeeId("");
    setStoreId("");
    setEftposAmount("");
    setCashAmount("");
    setClockIn("");
    setClockOut("");
    setBaseHourlyWage("");
    setExtraCommission("");
    setTransportReasonUsed(false);
    setTransportFee("");
    setTransportUsed(null);
    setSubmitError(null);
    setSubmittedId(null);
  }

  if (step === "success") {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 p-6 text-center">
        <p className="text-lg font-medium text-green-800">Submission recorded</p>
        <p className="mt-1 text-sm text-green-700">Reference #{submittedId}</p>
        <button
          type="button"
          onClick={handleSubmitAnother}
          className="mt-4 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Submit another shift
        </button>
      </div>
    );
  }

  if (step === "confirm") {
    return (
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Review your submission</h2>
        <dl className="divide-y divide-neutral-100 text-sm">
          <Row label="Date" value={`${date}${dayTypeLabel ? ` — ${dayTypeLabel}` : ""}`} />
          <Row label="Employee" value={selectedEmployee?.name ?? ""} />
          <Row label="Store" value={selectedStore?.name ?? ""} />
          <Row label="EFTPOS amount" value={formatMoney(parseAmount(eftposAmount))} />
          <Row label="Cash amount" value={formatMoney(parseAmount(cashAmount))} />
          <Row label="Total sales" value={formatMoney(totalSales)} />
          <Row label="Clock in" value={clockIn} />
          <Row label="Clock out" value={clockOut} />
          <Row label="Hours worked" value={hoursWorked.toFixed(2)} />
          <Row label="Base hourly wage" value={formatMoney(parseAmount(baseHourlyWage))} />
          <Row label="Rate multiplier" value={`${rateMultiplier}x`} />
          <Row label="Commission" value={formatMoney(commission)} />
          <Row label="Extra commission" value={formatMoney(parseAmount(extraCommission))} />
          <Row
            label="Transport issue"
            value={transportReasonUsed ? "Yes — no time deducted" : "No"}
          />
          <Row label="Transport fee" value={formatMoney(parseAmount(transportFee))} />
          <Row label="Estimated total wage" value={formatMoney(estimatedTotalWage)} bold />
        </dl>

        {submitError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{submitError}</p>
        )}

        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={() => setStep("form")}
            disabled={submitting}
            className="flex-1 rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50"
          >
            Back to edit
          </button>
          <button
            type="button"
            onClick={handleConfirmSubmit}
            disabled={submitting}
            className="flex-1 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {submitting ? "Submitting…" : "Confirm & Submit"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      className="space-y-5 rounded-lg border border-neutral-200 bg-white p-6 shadow-sm"
      onSubmit={(e) => {
        e.preventDefault();
        if (isFormValid) setStep("confirm");
      }}
    >
      <Field label="Date">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
        {dayTypeLabel && <p className="mt-1 text-xs text-neutral-500">{dayTypeLabel}</p>}
      </Field>

      <Field label="Employee">
        <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Select employee
          </option>
          {employees.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Store">
        <select value={storeId} onChange={(e) => setStoreId(e.target.value)} required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm">
          <option value="" disabled>
            Select store
          </option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label="EFTPOS amount">
          <input
            type="number"
            min="0"
            step="0.01"
            value={eftposAmount}
            onChange={(e) => setEftposAmount(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </Field>
        <Field label="Cash amount">
          <input
            type="number"
            min="0"
            step="0.01"
            value={cashAmount}
            onChange={(e) => setCashAmount(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label="Clock in">
          <input type="time" value={clockIn} onChange={(e) => setClockIn(e.target.value)} required className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm" />
        </Field>
        <Field label="Clock out">
          <input
            type="time"
            value={clockOut}
            onChange={(e) => setClockOut(e.target.value)}
            required
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </Field>
      </div>
      {clockIn && clockOut && (
        <p className="-mt-3 text-xs text-neutral-500">Hours worked: {hoursWorked.toFixed(2)}</p>
      )}

      <Field label="Base hourly wage">
        <input
          type="number"
          min="0"
          step="0.01"
          value={baseHourlyWage}
          onChange={(e) => setBaseHourlyWage(e.target.value)}
          required
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Commission (auto-calculated)">
        <div className="flex w-full items-center rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-sm font-medium text-neutral-700">
          {formatMoney(commission)}
        </div>
      </Field>

      <Field label="Extra commission (optional)">
        <input
          type="number"
          min="0"
          step="0.01"
          value={extraCommission}
          onChange={(e) => setExtraCommission(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <div>
        <label className="flex items-start gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={transportReasonUsed}
            disabled={transportCheckboxDisabled}
            onChange={(e) => setTransportReasonUsed(e.target.checked)}
            className="mt-0.5"
          />
          <span>Late due to transport issue (no time deducted)</span>
        </label>
        {transportCheck === "checking" && (
          <p className="mt-1 text-xs text-neutral-400">Checking this week&apos;s usage…</p>
        )}
        {transportCheck === "used" && (
          <p className="mt-1 text-xs text-amber-600">
            Already used this week for this employee — only one transport-issue allowance per
            employee per week.
          </p>
        )}
        {transportCheck === "idle" && (
          <p className="mt-1 text-xs text-neutral-400">Select an employee and date to enable this.</p>
        )}
      </div>

      <Field label="Transport fee">
        <input
          type="number"
          min="0"
          step="0.01"
          value={transportFee}
          onChange={(e) => setTransportFee(e.target.value)}
          className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
        />
      </Field>

      <Field label="Estimated total wage">
        <div className="flex w-full items-center rounded-md border border-neutral-300 bg-neutral-50 px-3 py-2 text-base font-semibold text-neutral-900">
          {formatMoney(estimatedTotalWage)}
        </div>
      </Field>

      <button
        type="submit"
        disabled={!isFormValid}
        className="w-full rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Review submission
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">{label}</span>
      {children}
    </label>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between py-2">
      <dt className="text-neutral-500">{label}</dt>
      <dd className={bold ? "font-semibold text-neutral-900" : "text-neutral-800"}>{value}</dd>
    </div>
  );
}
