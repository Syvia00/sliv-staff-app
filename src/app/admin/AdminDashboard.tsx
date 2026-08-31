"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { logout } from "./actions";
import EmployeesPanel from "./EmployeesPanel";
import StoresPanel from "./StoresPanel";
import RecordsPanel from "./RecordsPanel";
import PublicHolidaysPanel from "./PublicHolidaysPanel";

type Tab = "employees" | "stores" | "records" | "holidays";

const TABS: { id: Tab; label: string }[] = [
  { id: "records", label: "Records" },
  { id: "employees", label: "Employees" },
  { id: "stores", label: "Stores" },
  { id: "holidays", label: "Public Holidays" },
];

export default function AdminDashboard() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("records");

  async function handleLogout() {
    await logout();
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-neutral-900">Admin Panel</h1>
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-100"
        >
          Log out
        </button>
      </div>

      <div className="mb-6 flex gap-1 border-b border-neutral-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium ${
              tab === t.id
                ? "border-b-2 border-neutral-900 text-neutral-900"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "records" && <RecordsPanel />}
      {tab === "employees" && <EmployeesPanel />}
      {tab === "stores" && <StoresPanel />}
      {tab === "holidays" && <PublicHolidaysPanel />}
    </div>
  );
}
