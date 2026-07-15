"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogout() {
    setIsSubmitting(true);
    setError(null);
    const response = await fetch("/api/v1/auth/logout", { method: "POST" });

    if (!response.ok) {
      setError("退出登录失败，请稍后重试。");
      setIsSubmitting(false);
      return;
    }

    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleLogout}
        disabled={isSubmitting}
        className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-500 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "退出中…" : "退出登录"}
      </button>
      {error ? <span className="text-xs text-rose-600" role="alert">{error}</span> : null}
    </div>
  );
}
