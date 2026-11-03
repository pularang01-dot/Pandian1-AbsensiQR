"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, GraduationCap, LogOut, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { navForRole, isActive } from "@/lib/navigation";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { signOutAction } from "@/app/login/actions";

export function AppShell({
  role,
  fullName,
  schoolName,
  unreadCount,
  children,
}: {
  role: Role;
  fullName: string;
  schoolName: string;
  unreadCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const groups = navForRole(role);
  const allItems = groups.flatMap((g) => g.items);

  const nav = (
    <nav aria-label="Navigasi utama" className="flex-1 overflow-y-auto px-3 py-4">
      {groups.map((g) => (
        <div key={g.title} className="mb-5">
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-white/40">{g.title}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = isActive(item.href, pathname, allItems);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                      active ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <item.icon className="h-[18px] w-[18px] shrink-0" aria-hidden />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-white/10 px-5">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10 text-white">
        <GraduationCap className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0 leading-tight">
        <p className="truncate text-sm font-semibold text-white">Pandian Smart Attendance</p>
        <p className="truncate text-[11px] text-white/60">{schoolName}</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen lg:pl-64">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-navy lg:flex">
        {brand}
        {nav}
      </aside>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu navigasi">
          <button aria-label="Tutup menu" className="absolute inset-0 bg-ink/50" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-navy shadow-pop">
            <button
              aria-label="Tutup menu"
              onClick={() => setOpen(false)}
              className="absolute right-3 top-4 flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            >
              <X className="h-5 w-5" />
            </button>
            {brand}
            {nav}
          </aside>
        </div>
      )}

      <header className="app-topbar sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
        <button
          aria-label="Buka menu"
          onClick={() => setOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-lg text-ink hover:bg-canvas lg:hidden"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="ml-auto flex items-center gap-2 sm:gap-4">
          <Link
            href="/notifications"
            aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : "Notifikasi"}
            className="relative flex h-11 w-11 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas"
          >
            <Bell className="h-5 w-5" aria-hidden />
            {unreadCount > 0 && (
              <span className="tabular absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold text-white">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            )}
          </Link>
          <div className="hidden text-right sm:block">
            <p className="text-sm font-medium leading-tight text-ink">{fullName}</p>
            <p className="text-xs text-ink-muted">{ROLE_LABEL[role]}</p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="flex h-11 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              <span className="hidden sm:inline">Keluar</span>
              <span className="sr-only sm:hidden">Keluar</span>
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">{children}</main>
    </div>
  );
}
