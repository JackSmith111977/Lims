import Link from "next/link";
import { redirect } from "next/navigation";

import { SettingsPanel } from "@/components/settings/settings-panel";
import { requireAdminPermission } from "@/lib/server/admin";

export default async function SettingsPage() {
  try {
    await requireAdminPermission("settings.manage");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 · 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">基础设置仅对授权管理员开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  return <SettingsPanel />;
}
