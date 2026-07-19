"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import type { AdminPermission, AdminRole } from "@/lib/admin/types";

type Props = { roles: AdminRole[]; permissions: AdminPermission[] };

async function requestJson(url: string, init: RequestInit) {
  const response = await fetch(url, init);
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message ?? "操作失败，请稍后重试。");
  return payload;
}

function RoleCard({ role, permissions }: { role: AdminRole; permissions: AdminPermission[] }) {
  const router = useRouter();
  const [name, setName] = useState(role.name);
  const [status, setStatus] = useState(role.status);
  const [selected, setSelected] = useState(role.permissions.map((permission) => permission.code));
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function togglePermission(code: string) {
    setSelected((current) => current.includes(code) ? current.filter((item) => item !== code) : [...current, code]);
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await requestJson(`/api/v1/roles/${role.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, status }) });
      await requestJson(`/api/v1/roles/${role.id}/permissions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ permissionCodes: selected }) });
      setMessage("角色配置已保存");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={save}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="font-semibold">{role.name}</p><p className="mt-1 font-mono text-xs text-slate-400">{role.code}</p></div>
        <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value)} disabled={role.code === "SYSTEM_ADMIN"}><option value="ACTIVE">启用</option><option value="INACTIVE">停用</option></select>
      </div>
      <label className="mt-4 block text-sm text-slate-600">角色名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" value={name} onChange={(event) => setName(event.target.value)} /></label>
      <div className="mt-5"><p className="text-sm font-medium text-slate-700">权限</p><div className="mt-2 grid gap-2 sm:grid-cols-2">{permissions.map((permission) => <label key={permission.id} className="flex items-start gap-2 rounded-lg border border-slate-100 p-2 text-xs"><input className="mt-0.5" type="checkbox" checked={selected.includes(permission.code)} onChange={() => togglePermission(permission.code)} /><span><span className="block text-slate-700">{permission.name}</span><span className="font-mono text-slate-400">{permission.code}</span></span></label>)}</div></div>
      <div className="mt-5 flex items-center gap-3"><button className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={saving} type="submit">保存角色</button>{message ? <span className="text-sm text-slate-600">{message}</span> : null}</div>
    </form>
  );
}

export function AdminRolesPanel({ roles, permissions }: Props) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function createRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await requestJson("/api/v1/roles", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, name }) });
      setCode("");
      setName("");
      setMessage("角色已创建");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "创建失败");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><h2 className="text-lg font-semibold">创建角色</h2><form className="mt-4 grid gap-4 md:grid-cols-[1fr_2fr_auto]" onSubmit={createRole}><label className="text-sm text-slate-600">角色编码<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 font-mono uppercase" placeholder="LAB_REVIEWER" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required /></label><label className="text-sm text-slate-600">角色名称<input className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2" placeholder="实验室审核员" value={name} onChange={(event) => setName(event.target.value)} required /></label><button className="self-end rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50" disabled={saving} type="submit">创建</button></form>{message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}</section>
      <section className="grid gap-5 xl:grid-cols-2">{roles.map((role) => <RoleCard key={role.id} role={role} permissions={permissions} />)}</section>
    </div>
  );
}
