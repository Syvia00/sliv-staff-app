"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { getFilteredSubmissions, listEmployees, listStores, type SubmissionRow } from "./actions";
import type { EmployeeRow, StoreRow } from "./actions";

export default function RecordsPanel() {
  const [employees, setEmployees] = useState<EmployeeRow[]>([]);
  const [stores, setStores] = useState<StoreRow[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [storeId, setStoreId] = useState("");

  const [rows, setRows] = useState<SubmissionRow[] | null>(null);
  const [totalWageSum, setTotalWageSum] = useState("0.00");
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load filter dropdown options once.
  useEffect(() => {
    startLoading(async () => {
      try {
        const [e, s] = await Promise.all([listEmployees(), listStores()]);
        setEmployees(e);
        setStores(s);
      } catch {
        setLoadError("Failed to load filter options.");
      }
    });
  }, []);

  // Re-run the query whenever a filter changes.
  useEffect(() => {
    startLoading(async () => {
      try {
        const result = await getFilteredSubmissions({
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          employeeId: employeeId ? Number(employeeId) : undefined,
          storeId: storeId ? Number(storeId) : undefined,
        });
        setRows(result.rows);
        setTotalWageSum(result.totalWageSum);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load records.");
      }
    });
  }, [dateFrom, dateTo, employeeId, storeId]);

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("dateFrom", dateFrom);
    if (dateTo) params.set("dateTo", dateTo);
    if (employeeId) params.set("employeeId", employeeId);
    if (storeId) params.set("storeId", storeId);
    return `/admin/export?${params.toString()}`;
  }, [dateFrom, dateTo, employeeId, storeId]);

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-lg font-semibold text-neutral-900">Records</h2>
        <a
          href={exportUrl}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
        >
          Export CSV
        </a>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">From</span>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">To</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Employee</span>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-neutral-700">Store</span>
          <select
            value={storeId}
            onChange={(e) => setStoreId(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          >
            <option value="">All</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadError && <p className="mb-4 text-sm text-red-700">{loadError}</p>}
      {loading && !rows && <p className="text-sm text-neutral-500">Loading…</p>}

      {rows && (
        <>
          <div className="mb-3 text-sm text-neutral-600">
            {rows.length} submission{rows.length === 1 ? "" : "s"} — total wage:{" "}
            <span className="font-semibold text-neutral-900">${totalWageSum}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-neutral-200 text-left text-neutral-500">
                  <th className="py-2 pr-3 font-medium">Date</th>
                  <th className="py-2 pr-3 font-medium">Employee</th>
                  <th className="py-2 pr-3 font-medium">Store</th>
                  <th className="py-2 pr-3 font-medium">Day type</th>
                  <th className="py-2 pr-3 font-medium">Clock in</th>
                  <th className="py-2 pr-3 font-medium">Clock out</th>
                  <th className="py-2 pr-3 font-medium">Commission</th>
                  <th className="py-2 pr-3 font-medium">Extra</th>
                  <th className="py-2 pr-3 font-medium">Transport</th>
                  <th className="py-2 pr-3 text-right font-medium">Total wage</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-neutral-100">
                    <td className="py-2 pr-3 whitespace-nowrap">{r.date}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.employeeName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.storeName}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.dayType.replace("_", " ")}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.clockIn}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">{r.clockOut}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">${r.commission}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">${r.extraCommission}</td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {r.transportReasonUsed ? `Yes ($${r.transportFee})` : "No"}
                    </td>
                    <td className="py-2 pr-3 text-right font-medium whitespace-nowrap">${r.totalWage}</td>
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={10} className="py-6 text-center text-neutral-400">
                      No submissions match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
