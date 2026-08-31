"use client";

import { Fragment, useEffect, useState, useTransition } from "react";
import { createStore, listStores, setStoreActive, updateStore, type StoreRow } from "./actions";

type FormFields = { name: string; commissionThreshold: string; commissionRate: string };

const emptyForm: FormFields = { name: "", commissionThreshold: "", commissionRate: "" };

export default function StoresPanel() {
  const [stores, setStores] = useState<StoreRow[] | null>(null);
  const [loading, startLoading] = useTransition();
  const [loadError, setLoadError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [newStore, setNewStore] = useState<FormFields>(emptyForm);
  const [addError, setAddError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingFields, setEditingFields] = useState<FormFields>(emptyForm);
  const [rowError, setRowError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    startLoading(async () => {
      try {
        const rows = await listStores();
        setStores(rows);
        setLoadError(null);
      } catch {
        setLoadError("Failed to load stores.");
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
    const result = await createStore(newStore);
    setAdding(false);
    if (result.ok) {
      setNewStore(emptyForm);
      refresh();
    } else {
      setAddError(result.error);
    }
  }

  function startEdit(row: StoreRow) {
    setEditingId(row.id);
    setEditingFields({
      name: row.name,
      commissionThreshold: row.commissionThreshold,
      commissionRate: row.commissionRate,
    });
    setRowError(null);
  }

  async function saveEdit(id: number) {
    setSaving(true);
    setRowError(null);
    const result = await updateStore(id, editingFields);
    setSaving(false);
    if (result.ok) {
      setEditingId(null);
      refresh();
    } else {
      setRowError(result.error);
    }
  }

  async function toggleActive(row: StoreRow) {
    await setStoreActive(row.id, !row.active);
    refresh();
  }

  return (
    <div className="rounded-lg border border-neutral-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-neutral-900">Stores</h2>

      <form onSubmit={handleAdd} className="mb-6 grid grid-cols-4 items-end gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Name</span>
          <input
            type="text"
            value={newStore.name}
            onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Threshold</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={newStore.commissionThreshold}
            onChange={(e) => setNewStore({ ...newStore, commissionThreshold: e.target.value })}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-neutral-700">Rate (e.g. 0.05)</span>
          <input
            type="number"
            min="0"
            step="0.0001"
            value={newStore.commissionRate}
            onChange={(e) => setNewStore({ ...newStore, commissionRate: e.target.value })}
            className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          disabled={adding || !newStore.name.trim()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </form>
      {addError && <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{addError}</p>}

      {loading && !stores && <p className="text-sm text-neutral-500">Loading…</p>}
      {loadError && <p className="text-sm text-red-700">{loadError}</p>}

      {stores && (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 text-left text-neutral-500">
              <th className="py-2 font-medium">Name</th>
              <th className="py-2 font-medium">Threshold</th>
              <th className="py-2 font-medium">Rate</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {stores.map((row) => {
              const isEditing = editingId === row.id;
              return (
                <Fragment key={row.id}>
                <tr className={isEditing ? "" : "border-b border-neutral-100"}>
                  <td className="py-2 pr-4">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editingFields.name}
                        onChange={(e) => setEditingFields({ ...editingFields, name: e.target.value })}
                        className="w-full rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      row.name
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editingFields.commissionThreshold}
                        onChange={(e) =>
                          setEditingFields({ ...editingFields, commissionThreshold: e.target.value })
                        }
                        className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      `$${row.commissionThreshold}`
                    )}
                  </td>
                  <td className="py-2 pr-4">
                    {isEditing ? (
                      <input
                        type="number"
                        min="0"
                        step="0.0001"
                        value={editingFields.commissionRate}
                        onChange={(e) => setEditingFields({ ...editingFields, commissionRate: e.target.value })}
                        className="w-24 rounded-md border border-neutral-300 px-2 py-1 text-sm"
                      />
                    ) : (
                      row.commissionRate
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
                          onClick={() => toggleActive(row)}
                          className="text-neutral-700 underline"
                        >
                          {row.active ? "Deactivate" : "Activate"}
                        </button>
                      </>
                    )}
                  </td>
                </tr>
                {isEditing && rowError && (
                  <tr className="border-b border-neutral-100">
                    <td colSpan={5} className="pb-2 text-xs text-red-700">
                      {rowError}
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
