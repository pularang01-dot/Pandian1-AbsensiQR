import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { DismissalForm } from "@/components/dismissal/dismissal-form";
import { loadChildren } from "@/lib/data/children";
import { submitDismissalParentAction } from "@/app/(app)/early-dismissal/actions";

export const metadata: Metadata = { title: "Ajukan Pulang Lebih Awal" };
export const dynamic = "force-dynamic";

export default async function NewParentDismissalPage() {
  await requireRole(["parent"]);
  const children = (await loadChildren()).filter((c) => c.status === "active");
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Ajukan pulang lebih awal" description="Sekolah akan meninjau dan menghubungi Anda bila perlu." />
      {children.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada siswa aktif yang terhubung" description="Hubungi administrator sekolah untuk menghubungkan akun Anda." /></div>
      ) : (
        <DismissalForm action={submitDismissalParentAction} students={children.map((c) => ({ id: c.id, label: `${c.full_name}${c.className ? ` (${c.className})` : ""}` }))} cancelHref="/parent/early-dismissal" />
      )}
    </div>
  );
}
