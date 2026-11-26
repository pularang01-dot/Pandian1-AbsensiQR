import { Suspense, type ReactNode } from "react";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { NavProgress } from "@/components/layout/nav-progress";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const supabase = await createClient();

  const [{ data: setting }, { count }] = await Promise.all([
    supabase.from("system_settings").select("value").eq("key", "school.name").maybeSingle(),
    supabase.from("notifications").select("id", { count: "exact", head: true }).eq("is_read", false),
  ]);

  const schoolName = typeof setting?.value === "string" && setting.value ? setting.value : "SDN PANDIAN 1 SUMENEP";

  return (
    <>
    <Suspense fallback={null}><NavProgress /></Suspense>
    <AppShell role={user.role} fullName={user.fullName} schoolName={schoolName} unreadCount={count ?? 0}>
      {children}
    </AppShell>
    </>
  );
}