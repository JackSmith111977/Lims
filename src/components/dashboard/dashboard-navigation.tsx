"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type DashboardNavigationItem = {
  href: string;
  label: string;
};

export type DashboardNavigationGroup = {
  id: string;
  title: string;
  description: string;
  items: DashboardNavigationItem[];
};

export function isDashboardNavigationActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardNavigation({ groups }: { groups: DashboardNavigationGroup[] }) {
  const pathname = usePathname();
  const itemCount = groups.reduce((total, group) => total + group.items.length, 0);

  return (
    <nav aria-label="工作台业务模块" className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200/80 bg-slate-50/70 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-blue-600">WORKSPACE</p>
            <span className="h-1 w-1 rounded-full bg-blue-300" aria-hidden="true" />
            <span className="text-xs text-slate-500">{itemCount} 个入口</span>
          </div>
          <h2 className="mt-1 text-base font-semibold text-slate-900">业务模块</h2>
          <p className="mt-1 text-sm text-slate-500">按实验室工作流整理，快速进入当前账号可用的功能。</p>
        </div>
        <span className="inline-flex w-fit items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">仅显示有权限的入口</span>
      </div>

      <div className="grid gap-3 p-3 sm:gap-4 sm:p-4 md:grid-cols-2 xl:grid-cols-4">
        {groups.map((group) => (
          <section key={group.id} aria-labelledby={`dashboard-nav-${group.id}`} className="rounded-xl border border-slate-200/80 bg-slate-50/60 p-3">
            <div className="flex items-start justify-between gap-3">
              <h3 id={`dashboard-nav-${group.id}`} className="text-sm font-semibold text-slate-900">{group.title}</h3>
              <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-slate-500">{group.items.length}</span>
            </div>
            <div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p>
            </div>
            <ul className="mt-3 grid gap-1.5">
              {group.items.map((item) => {
                const active = isDashboardNavigationActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`group flex min-h-11 items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${active ? "bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200" : "bg-white text-slate-700 hover:bg-blue-50/70 hover:text-blue-700 hover:ring-1 hover:ring-inset hover:ring-blue-200"}`}
                    >
                      <span className="min-w-0">{item.label}</span>
                      <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full transition-colors ${active ? "bg-blue-600" : "bg-slate-200 group-hover:bg-blue-300"}`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
    </nav>
  );
}
