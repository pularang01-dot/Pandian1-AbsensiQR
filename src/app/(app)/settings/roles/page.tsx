import type { Metadata } from "next";
import { ADMIN_ROLES, ROLES, ROLE_LABEL } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = { title: "Peran dan Hak Akses" };

// Ringkasan referensi. Penegakan sebenarnya ada di RLS dan fungsi database (lihat docs/ROLE_PERMISSIONS.md).
const ROWS: { feature: string; allow: Record<string, string> }[] = [
  { feature: "Melihat data siswa", allow: { super_admin: "Semua", school_admin: "Semua", principal: "Semua", teacher: "Kelas sendiri", operator: "Semua (terbatas)", parent: "Anak sendiri" } },
  { feature: "Mencatat absensi (QR/manual)", allow: { super_admin: "Ya", school_admin: "Ya", teacher: "Kelas sendiri", operator: "Ya" } },
  { feature: "Mengoreksi absensi (dengan jejak audit)", allow: { super_admin: "Ya", school_admin: "Ya", principal: "Ya", teacher: "Kelas sendiri" } },
  { feature: "Mengajukan izin/sakit", allow: { parent: "Anak sendiri", super_admin: "Atas nama", school_admin: "Atas nama" } },
  { feature: "Menyetujui izin, dispensasi, pulang awal", allow: { super_admin: "Ya", school_admin: "Ya", principal: "Ya" } },
  { feature: "Mengajukan dispensasi", allow: { super_admin: "Ya", school_admin: "Ya", principal: "Ya", teacher: "Kelas sendiri" } },
  { feature: "Konfirmasi partisipasi dispensasi", allow: { super_admin: "Ya", school_admin: "Ya", teacher: "Guru pendamping" } },
  { feature: "Mencatat serah terima pulang awal", allow: { super_admin: "Ya", school_admin: "Ya", principal: "Ya", teacher: "Ya", operator: "Ya" } },
  { feature: "Laporan dan ekspor", allow: { super_admin: "Ya", school_admin: "Ya", principal: "Ya", teacher: "Kelas sendiri" } },
  { feature: "Pengaturan dan pengguna", allow: { super_admin: "Semua peran", school_admin: "Guru, operator, orang tua" } },
];

export default async function RolesPage() {
  await requireRole(ADMIN_ROLES);
  return (
    <>
      <PageHeader title="Peran dan hak akses" description="Referensi saja. Hak akses ditegakkan di basis data (RLS) dan tidak dapat diubah dari halaman ini." />
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Matriks peran dan hak akses</caption>
          <thead><tr className="border-b border-line bg-canvas text-left text-xs text-ink-muted"><th scope="col" className="px-3 py-2.5 font-medium">Fitur</th>{ROLES.map((r) => <th key={r} scope="col" className="px-3 py-2.5 font-medium">{ROLE_LABEL[r]}</th>)}</tr></thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((row) => (
              <tr key={row.feature}><th scope="row" className="px-3 py-2.5 text-left font-medium">{row.feature}</th>{ROLES.map((r) => <td key={r} className="px-3 py-2.5">{row.allow[r] ?? "Tidak"}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
