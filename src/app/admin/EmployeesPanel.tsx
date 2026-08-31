"use client";

import { useEffect, useState, useTransition } from "react";
import { createEmployee, listEmployees, setEmployeeActive, updateEmployeeName, type EmployeeRow } from "./actions";

export default function EmployeesPanel() {
  const [employees, setEmployees] = useState<EmployeeRow[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const rows = await listEmployees();
        setEmployees(rows);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load employees.");
      }
    });
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAdding(true);
    setAddError(null);
    const result = await createEmployee(newName);
    setAdding(false);
    if (result.ok) {
      setNewName("");
      refresh();
    } else {
      setAddError(result.error);
    }
  }

  function startEdit(row: EmployeeRow) {
    setEditingId(row.id);
    setEditingName(row.name);
    setRowError(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setRowError(null);
    const result = await updateEmployeeName(id, editingName);
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      refresh();
    } else {
      setRowError(result.error);
    }
  }

  async function toggleActive(row: EmployeeRow) {
    await setEmployeeActive(row.id, !row.active);
    refresh();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Employees</h2>

      <form onSubmit={handleAdd} className="mb-6 flex items-end gap-3">
        <label className="block flex-1">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Add employee</span>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Full name"
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={adding || !newName.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {addError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

      {loading && !employees && <p className="text-sm text-neutral-500">Loading…</p>}
      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      {employees && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {employees.map((row) => (
              <tr key={row.id} className="border-b border-neutral-100">
                <td className="py-2 pr-4">
                  {editingId === row.id ? (
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                    />
                  ) : (
                    row.name
                  )}
                  {editingId === row.id && rowError && (
                    <p className="mt-1 text-xs text-red-700">{rowError}</p>
                  )}
                </td>
                <td className="py-2 pr-4">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      row.active ? "bg-green-100 text-green-800" : "bg-neutral-100 text-neutral-500"
                    }`}
                  >
                    {row.active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="py-2 text-right">
                  {editingId === row.id ? (
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
                      <button type="button" onClick={() => toggleActive(row)} className="text-neutral-700 underline">
                        {row.active ? "Deactivate" : "Activate"}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
