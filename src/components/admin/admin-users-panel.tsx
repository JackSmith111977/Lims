"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { AdminRole, AdminUser } from "@/lib/admin/types";

type Props = {
  users: AdminUser[];
  roles: AdminRole[];
  currentUserId: string;
  authAdminConfigured: boolean;
};

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  }
  return payload;
}

function UserRow({ user, roles, currentUserId }: { user: AdminUser; roles: AdminRole[]; currentUserId: string }) {
  const router = useRouter();
  const [username, setUsername] = useState(user.username);
  const [realName, setRealName] = useState(user.real_name);
  const [status, setStatus] = useState(user.status);
  const [selectedRoles, setSelectedRoles] = useState(user.roles.map((role) => role.code));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(`/api/v1/users/${user.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, realName, status }),
      });
      setMessage("资料已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function saveRoles() {
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(`/api/v1/users/${user.id}/roles`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ roleCodes: selectedRoles }),
      });
      setMessage("角色已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "角色保存失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleRole(code: string) {
    setSelectedRoles((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{user.real_name}</p>
          <p className="mt-1 text-sm text-slate-500">{user.email ?? "未设置邮箱"} · {user.username}</p>
          <p className="mt-1 font-mono text-xs text-slate-400">{user.id}</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${status === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
          {status === "ACTIVE" ? "启用" : "停用"}
        </span>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <form className="space-y-3" onSubmit={saveProfile}>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">资料与状态</p>
          <label className="block text-sm text-slate-600">
            用户名
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={username} onChange={(event) => setUsername(event.target.value)} />
          </label>
          <label className="block text-sm text-slate-600">
            姓名
            <input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={realName} onChange={(event) => setRealName(event.target.value)} />
          </label>
          <label className="block text-sm text-slate-600">
            状态
            <select className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} disabled={user.id === currentUserId}>
              <option value="ACTIVE">启用</option>
              <option value="INACTIVE">停用</option>
            </select>
          </label>
          <button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} type="submit">
            保存资料
          </button>
        </form>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">角色分配</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {roles.map((role) => (
              <label key={role.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-sm">
                <input className="mt-1" type="checkbox" checked={selectedRoles.includes(role.code)} onChange={() => toggleRole(role.code)} />
                <span><span className="block text-slate-800">{role.name}</span><span className="font-mono text-xs text-slate-400">{role.code}</span></span>
              </label>
            ))}
          </div>
          <button className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} type="button" onClick={saveRoles}>
            保存角色
          </button>
        </div>
      </div>
      {message ? <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">{message}</p> : null}
    </article>
  );
}

export function AdminUsersPanel({ users, roles, currentUserId, authAdminConfigured }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [realName, setRealName] = useState("");
  const [roleCodes, setRoleCodes] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function toggleCreateRole(code: string) {
    setRoleCodes((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function createUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await requestJson("/api/v1/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password, username, realName, roleCodes }),
      });
      setEmail("");
      setPassword("");
      setUsername("");
      setRealName("");
      setRoleCodes([]);
      setMessage("用户已创建");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">创建用户</h2>
            <p className="mt-1 text-sm text-slate-500">由服务端 Auth Admin API 创建登录账号，再生成业务用户资料。</p>
          </div>
          {!authAdminConfigured ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs text-amber-700">未配置 SUPABASE_SERVICE_ROLE_KEY</span> : null}
        </div>
        <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={createUser}>
          <label className="text-sm text-slate-600">邮箱<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
          <label className="text-sm text-slate-600">初始密码<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" type="password" minLength={8} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
          <label className="text-sm text-slate-600">用户名<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={username} onChange={(event) => setUsername(event.target.value)} required /></label>
          <label className="text-sm text-slate-600">姓名<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={realName} onChange={(event) => setRealName(event.target.value)} required /></label>
          <div className="md:col-span-2">
            <p className="text-sm text-slate-600">初始角色</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {roles.map((role) => <label key={role.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"><input type="checkbox" checked={roleCodes.includes(role.code)} onChange={() => toggleCreateRole(role.code)} />{role.name}</label>)}
            </div>
          </div>
          <div className="md:col-span-2 flex items-center gap-3">
            <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving || !authAdminConfigured} type="submit">创建用户</button>
            {message ? <span className="text-sm text-slate-600">{message}</span> : null}
          </div>
        </form>
      </section>

      <section className="space-y-4">
        <div className="flex items-end justify-between"><div><h2 className="text-lg font-semibold">用户列表</h2><p className="mt-1 text-sm text-slate-500">共 {users.length} 个业务用户</p></div></div>
        {users.map((user) => <UserRow key={user.id} user={user} roles={roles} currentUserId={currentUserId} />)}
      </section>
    </div>
  );
}
