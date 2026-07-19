import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminRolesPanel } from "@/components/admin/admin-roles-panel";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadAdminRoles } from "@/lib/server/admin-data";

export default async function AdminRolesPage() {
  let context;
  try {
    context = await requireAdminPermission("auth.role.manage");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 · 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">角色管理仅对授权管理员开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  const roleData = await loadAdminRoles(context.supabase);
  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link>
            <h1 className="mt-2 text-2xl font-semibold">角色与权限</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/users" className="text-blue-600 hover:text-blue-700">用户管理</Link>
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">返回工作台</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <AdminRolesPanel roles={roleData.roles} permissions={roleData.permissions} />
      </section>
    </main>
  );
}
