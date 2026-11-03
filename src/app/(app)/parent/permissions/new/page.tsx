import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { PermissionForm } from "@/components/permissions/permission-form";
import { loadChildren } from "@/lib/data/children";
import { submitPermissionAction } from "@/app/(app)/permissions/actions";
import { todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Ajukan Izin atau Sakit" };
export const dynamic = "force-dynamic";

export default async function NewParentPermissionPage() {
  await requireRole(["parent"]);
  const children = (await loadChildren()).filter((c) => c.status === "active");
  const supabase = await createClient();
  const { data: s } = await supabase.from("system_settings").select("value").eq("key", "permission.document_required_for_sick_days").maybeSingle();
  const docDays = Number(s?.value) > 0 ? Number(s?.value) : 3;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajukan izin atau sakit" description="Isi data seperlunya. Tidak perlu menuliskan diagnosis medis." />
      {children.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada siswa aktif yang terhubung" description="Hubungi administrator sekolah untuk menghubungkan akun Anda." /></div>
      ) : (
        <PermissionForm action={submitPermissionAction} students={children.map((c) => ({ id: c.id, label: `${c.full_name}${c.className ? ` (${c.className})` : ""}` }))} cancelHref="/parent/permissions" today={todayISO()} docDays={docDays} />
      )}
    </div>
  );
}
