import { hasValidSession, isAdminPasswordConfigured } from "@/lib/auth";
import AdminLogin from "./AdminLogin";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!isAdminPasswordConfigured()) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="max-w-sm rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm text-amber-800">
          The <code className="rounded bg-amber-100 px-1">ADMIN_PASSWORD</code> environment variable is
          not set on the server, so the admin panel cannot be unlocked. Set it in Railway&apos;s
          dashboard.
        </div>
      </main>
    );
  }

  const authed = await hasValidSession();

  return (
    <main className="min-h-screen bg-neutral-50 px-4 py-8">
      <div className="mx-auto max-w-5xl">{authed ? <AdminDashboard /> : <AdminLogin />}</div>
    </main>
  );
}
