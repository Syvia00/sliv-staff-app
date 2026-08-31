"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import {
  createHoliday,
  deleteHoliday,
  listHolidays,
  syncNswHolidays,
  updateHoliday,
  type HolidayRow,
} from "./actions";

const currentYear = new Date().getFullYear();

export default function PublicHolidaysPanel() {
  const [holidays, setHolidays] = useState<HolidayRow[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [newDate, setNewDate] = useState("");
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingDate, setEditingDate] = useState("");
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const rows = await listHolidays();
        setHolidays(rows);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load public holidays.");
      }
    });
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleSync() {
    setSyncing(true);
    setSyncMessage(null);
    setSyncError(null);
    const result = await syncNswHolidays(currentYear);
    setSyncing(false);
    if (result.ok) {
      setSyncMessage(
        `Synced ${result.year}: ${result.totalFetched} NSW/national holidays found, ` +
          `${result.added} added, ${result.skippedManual} preserved as manual overrides, ` +
          `${result.removedStale} stale auto entries removed.`,
      );
      refresh();
    } else {
      setSyncError(result.error);
    }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const result = await createHoliday({ date: newDate, name: newName });
    setAdding(false);
    if (result.ok) {
      setNewDate("");
      setNewName("");
      refresh();
    } else {
      setAddError(result.error);
    }
  }

  function startEdit(row: HolidayRow) {
    setEditingId(row.id);
    setEditingDate(row.date);
    setEditingName(row.name);
    setRowError(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setRowError(null);
    const result = await updateHoliday(id, { date: editingDate, name: editingName });
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      refresh();
    } else {
      setRowError(result.error);
    }
  }

  async function handleDelete(id: number) {
    await deleteHoliday(id);
    refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-neutral-900">Sync from Nager.Date</h2>
        <p className="mb-4 text-sm text-neutral-500">
          Fetches national and NSW public holidays for {currentYear} and saves them with
          source &quot;auto&quot;. Manually-added holidays on the same date are never overwritten.
        </p>
        <button
          type="button"
          onClick={handleSync}
          disabled={syncing}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {syncing ? "Syncing…" : `Sync NSW Holidays (${currentYear})`}
        </button>
        {syncMessage && <p className="mt-3 rounded-md bg-green-50 px-3 py-2 text-sm text-green-800">{syncMessage}</p>}
        {syncError && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{syncError}</p>}
      </div>

      <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">Public Holidays</h2>

        <form onSubmit={handleAdd} className="mb-6 flex items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Date</span>
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block flex-1">
            <span className="mb-1 block text-sm font-medium text-neutral-700">Name</span>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </label>
          <button
            type="submit"
            disabled={adding || !newDate || !newName.trim()}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add"}
          </button>
        </form>
        {addError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

        {loading && !holidays && <p className="text-sm text-neutral-500">Loading…</p>}
        {loadError && <p className="text-sm text-red-700">{loadError}</p>}

        {holidays && (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left text-neutral-500">
                <th className="py-2 font-medium">Date</th>
                <th className="py-2 font-medium">Name</th>
                <th className="py-2 font-medium">Source</th>
                <th className="py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {holidays.map((row) => {
                const isEditing = editingId === row.id;
                return (
                  <Fragment key={row.id}>
                    <tr className={isEditing ? "" : "border-b border-neutral-100"}>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <input
                            type="date"
                            value={editingDate}
                            onChange={(e) => setEditingDate(e.target.value)}
                            className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          row.date
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                          />
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className="py-2 pr-4">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.source === "auto"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-neutral-100 text-neutral-600"
                          }`}
                        >
                          {row.source}
                        </span>
                      </td>
                      <td className="py-2 text-right">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={() => saveEdit(row.id)}
                              disabled={saving}
                              className="mr-2 text-neutral-900 underline"
                            >
                              Save
                            </button>
                            <button type="button" onClick={() => setEditingId(null)} className="text-neutral-500">
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="mr-3 text-neutral-700 underline"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(row.id)}
                              className="text-red-700 underline"
                            >
                              Delete
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                    {isEditing && rowError && (
                      <tr className="border-b border-neutral-100">
                        <td colSpan={4} className="pb-2 text-xs text-red-700">
                          {rowError}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {holidays.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-neutral-400">
                    No public holidays recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
