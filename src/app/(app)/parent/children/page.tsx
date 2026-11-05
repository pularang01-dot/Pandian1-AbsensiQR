import type { Metadata } from "next";
import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { loadChildren } from "@/lib/data/children";
import { STUDENT_STATUS_LABEL } from "@/lib/validation/student";

export const metadata: Metadata = { title: "Anak Saya" };
export const dynamic = "force-dynamic";

export default async function ChildrenPage() {
  await requireRole(["parent"]);
  const children = await loadChildren();
  return (
    <>
      <PageHeader title="Anak saya" description="Hanya siswa yang dihubungkan oleh sekolah dengan akun Anda yang ditampilkan." />
      {children.length === 0 ? (
        <div className="card"><EmptyState title="Tidak ada anak aktif" description="Belum ada anak yang terhubung, atau anak Anda sudah lulus atau pindah sehingga aksesnya ditutup otomatis. Hubungi administrator sekolah bila ini tidak sesuai." /></div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {children.map((c) => (
            <article key={c.id} className="card p-5">
              <h2 className="text-lg font-semibold">{c.full_name}</h2>
              <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div><dt className="text-ink-muted">NIS</dt><dd className="tabular font-medium">{c.nis}</dd></div>
                <div><dt className="text-ink-muted">Kelas</dt><dd className="font-medium">{c.className ?? "-"}</dd></div>
                <div><dt className="text-ink-muted">Status</dt><dd className="font-medium">{STUDENT_STATUS_LABEL[c.status] ?? c.status}</dd></div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href={`/parent/attendance?student=${c.id}`} className="inline-flex h-10 items-center rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas">Riwayat kehadiran</Link>
                <Link href="/parent/permissions/new" className="inline-flex h-10 items-center rounded-lg bg-brand-light px-3 text-sm font-medium text-brand hover:bg-brand/10">Ajukan izin</Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}