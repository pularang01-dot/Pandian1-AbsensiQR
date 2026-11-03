import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { StaffImportClient } from "./import-client";

export const metadata: Metadata = { title: "Impor Staf" };
export const dynamic = "force-dynamic";

export default async function StaffImportPage() {
  const me = await requireRole(ADMIN_ROLES);
  const isSuper = me.roles.includes("super_admin");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Impor akun staf" description="Buat banyak akun guru, wali kelas, dan staf sekaligus. Setiap orang menerima email undangan untuk membuat kata sandinya sendiri." />
      {!isSuper && <p className="mb-4 rounded-lg bg-canvas px-3.5 py-3 text-sm text-ink-muted">Sebagai Administrator Sekolah, Anda dapat mengimpor Guru dan Operator. Peran Kepala Sekolah dan Admin hanya dapat diberikan Super Admin.</p>}
      <StaffImportClient />
    </div>
  );
}