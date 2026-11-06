import type { Metadata } from "next";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { formatTanggal } from "@/lib/utils";
import { BackupForm } from "./backup-form";
import { BackupInspector } from "./backup-inspector";

export const metadata: Metadata = { title: "Pencadangan Data" };
export const dynamic = "force-dynamic";

export default async function BackupPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data: runs } = await supabase
    .from("audit_logs").select("id, created_at, new_data").eq("action", "backup_completed")
    .order("created_at", { ascending: false }).limit(8);
  const last = runs?.[0]?.created_at as string | undefined;
  const ageDays = last ? Math.floor((Date.now() - new Date(last).getTime()) / 86400000) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Pencadangan data" description="Unduh salinan terenkripsi seluruh data sekolah. Hanya super admin." />

      <section className="card p-5 sm:p-6" aria-live="polite">
        <h2 className="text-base font-semibold">Status</h2>
        {last ? (
          <p className="mt-1 text-sm">
            Cadangan terakhir: <span className="font-medium">{formatTanggal(last)}</span> ({ageDays} hari lalu).
            {ageDays !== null && ageDays > 7 && <span className="ml-1 font-semibold text-danger"> Sudah lebih dari 7 hari. Buat cadangan baru.</span>}
          </p>
        ) : (
          <p className="mt-1 text-sm font-semibold text-danger">Belum pernah ada cadangan tercatat. Buat cadangan pertama sekarang.</p>
        )}
        <p className="mt-2 text-xs text-ink-muted">Rekomendasi: buat cadangan setiap minggu dan sebelum kenaikan kelas atau penghapusan data. Simpan di dua tempat berbeda (misalnya flashdisk dan penyimpanan daring pribadi sekolah).</p>
      </section>

      <BackupForm />

      <BackupInspector />

      <section className="card space-y-3 p-5 sm:p-6 text-sm">
        <h2 className="text-base font-semibold">Yang perlu diketahui</h2>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Isi cadangan: akun (email dan peran), siswa, kelas, orang tua, absensi, izin, dispensasi, pengantaran pulang, notifikasi, pengaturan, dan jejak audit.</li>
          <li>Tidak termasuk: kata sandi (tidak dapat diekspor), dan berkas dokumen izin yang diunggah (foto atau PDF) di Supabase Storage. Catatan izinnya tetap ada.</li>
          <li>Berkas dienkripsi dengan kata sandi cadangan. Kata sandi tidak disimpan di sistem; jika hilang, berkas tidak dapat dibuka oleh siapa pun.</li>
          <li>Pemulihan data sementara dilakukan lewat skrip oleh pengembang. Panduan: docs/BACKUP_RESTORE_SOP.md dan docs/PANDUAN_SEKOLAH.md.</li>
          <li>Setiap pembuatan cadangan tercatat di jejak audit.</li>
        </ul>
      </section>

      {runs && runs.length > 0 && (
        <section className="card p-5 sm:p-6">
          <h2 className="mb-2 text-base font-semibold">Riwayat cadangan</h2>
          <ul className="divide-y divide-line text-sm">
            {runs.map((r) => {
              const c = ((r.new_data ?? {}) as { counts?: Record<string, number> }).counts ?? {};
              return (
                <li key={r.id as number} className="flex justify-between gap-3 py-2">
                  <span className="tabular">{formatTanggal(r.created_at as string)}</span>
                  <span className="text-ink-muted tabular">{c["students"] ?? 0} siswa, {c["attendance_records"] ?? 0} catatan absensi</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}