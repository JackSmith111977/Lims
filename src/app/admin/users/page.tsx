import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminUsersPanel } from "@/components/admin/admin-users-panel";
import { requireAdminPermission } from "@/lib/server/admin";
import { loadAdminRoles, loadAdminUsers } from "@/lib/server/admin-data";

export default async function AdminUsersPage() {
  let context;
  try {
    context = await requireAdminPermission("auth.user.manage");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 401) redirect("/login");
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
        <section className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold text-rose-600">403 · 无权访问</p>
          <h1 className="mt-2 text-2xl font-semibold text-slate-900">用户管理仅对授权管理员开放</h1>
          <Link className="mt-6 inline-block text-sm text-blue-600" href="/dashboard">返回工作台</Link>
        </section>
      </main>
    );
  }

  const [users, roleData] = await Promise.all([
    loadAdminUsers(context.supabase),
    loadAdminRoles(context.supabase),
  ]);

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5 lg:px-8">
          <div>
            <Link href="/dashboard" className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-600">LIMS 工作台</Link>
            <h1 className="mt-2 text-2xl font-semibold">用户管理</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <Link href="/admin/roles" className="text-blue-600 hover:text-blue-700">角色与权限</Link>
            <Link href="/dashboard" className="text-slate-500 hover:text-slate-700">返回工作台</Link>
          </nav>
        </div>
      </header>
      <section className="mx-auto max-w-7xl space-y-6 px-6 py-8 lg:px-8">
        <div className="rounded-2xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
          用户资料、状态和角色变更都会经过服务端权限校验，并写入审计日志。密码不会写入业务表。
        </div>
        <AdminUsersPanel
          users={users}
          roles={roleData.roles}
          currentUserId={context.user.id}
          authAdminConfigured={Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)}
        />
      </section>
    </main>
  );
}
