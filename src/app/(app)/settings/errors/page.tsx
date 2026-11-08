import type { Metadata } from "next";
import { CheckCircle2, MessageCircle } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Button } from "@/components/ui/button";
import { formatTanggal, formatWaktu } from "@/lib/utils";
import { DEVELOPER, errorReportText, waLink } from "@/lib/brand/developer";
import { CopyReport } from "./copy-button";
import { resolveAllErrorsAction, resolveErrorAction } from "./actions";

export const metadata: Metadata = { title: "Pemantauan Error" };
export const dynamic = "force-dynamic";

const SOURCE: Record<string, string> = {
  server: "Server (halaman gagal dibuat)",
  action: "Server (aksi simpan/ubah gagal)",
  client: "Peramban pengguna",
};

type Row = {
  id: string; source: string; route: string | null; message: string; digest: string | null; detail: string | null;
  occurrences: number; first_seen: string; last_seen: string; resolved_at: string | null;
};

export default async function ErrorsPage() {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("app_errors")
    .select("id, source, route, message, digest, detail, occurrences, first_seen, last_seen, resolved_at")
    .order("last_seen", { ascending: false }).limit(100);
  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <PageHeader title="Pemantauan error" />
        <div className="card"><ErrorState message="Daftar error tidak dapat dimuat. Pastikan migrasi 020_error_monitoring.sql sudah dijalankan." /></div>
      </div>
    );
  }
  const rows = (data ?? []) as Row[];
  const open = rows.filter((r) => !r.resolved_at);
  const done = rows.filter((r) => r.resolved_at).slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Pemantauan error" description="Catatan kesalahan teknis aplikasi. Hanya super admin." />

      <section className="card p-5 text-sm sm:p-6">
        <h2 className="mb-1 text-base font-semibold">Cara membaca halaman ini</h2>
        <ul className="list-disc space-y-1 pl-5 text-ink-muted">
          <li>Daftar kosong berarti tidak ada kesalahan teknis yang tercatat. Ini normal dan baik.</li>
          <li>Satu masalah yang berulang digabung menjadi satu baris dengan jumlah kejadian.</li>
          <li>Hanya pesan teknis yang disimpan. Email, nomor panjang, dan id disamarkan; isi data siswa tidak disimpan.</li>
          <li>Bila ada yang muncul terus-menerus, salin pesan dan kode kesalahannya lalu laporkan ke pengembang lewat tombol WhatsApp. Setelah ditangani, tekan "Tandai selesai".</li>
          <li>Catatan ini hanya mencakup kesalahan dalam aplikasi. Gangguan di Supabase atau Vercel sendiri dilihat di dashboard layanan tersebut.</li>
        </ul>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="dev-title">
        <h2 id="dev-title" className="text-base font-semibold">Hubungi pengembang</h2>
        <p className="mt-1 text-sm">{DEVELOPER.name} ({DEVELOPER.role}) | WhatsApp <span className="tabular font-medium">{DEVELOPER.phoneDisplay}</span></p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href={waLink("Halo Pak Viky, saya dari SDN Pandian 1 Sumenep. Saya ingin menanyakan soal aplikasi Pandian Smart Attendance.")} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg bg-[#1a7f4b] px-4 text-sm font-medium text-white hover:bg-[#15683d]"><MessageCircle className="h-4 w-4" aria-hidden />Buka WhatsApp pengembang</a>
        </div>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-ink-muted">
          <li>Pada error yang bermasalah, tekan <span className="font-medium text-ink">Laporkan lewat WhatsApp</span>. WhatsApp terbuka dengan pesan yang sudah terisi, lalu tekan kirim.</li>
          <li>Bila WhatsApp tidak terbuka (misalnya di komputer tanpa WhatsApp), tekan <span className="font-medium text-ink">Salin laporan</span>, buka WhatsApp, pilih kontak pengembang, tempel (Ctrl+V di komputer, tekan lama lalu Tempel di HP), lalu kirim.</li>
          <li>Setelah masalah selesai ditangani, tekan "Tandai selesai".</li>
        </ol>
        <p className="mt-3 text-xs text-ink-muted">Laporan hanya berisi pesan teknis yang sudah disamarkan. Periksa isinya sebelum mengirim; jangan menambahkan kata sandi atau data pribadi siswa.</p>
      </section>

      <section aria-labelledby="open-title">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 id="open-title" className="text-base font-semibold">Belum ditangani ({open.length})</h2>
          {open.length > 0 && (
            <form action={resolveAllErrorsAction}><Button type="submit" variant="outline" size="sm">Tandai semua selesai</Button></form>
          )}
        </div>
        {open.length === 0 ? (
          <div className="card"><EmptyState title="Tidak ada error" description="Tidak ada kesalahan teknis yang menunggu ditangani." /></div>
        ) : (
          <ul className="space-y-3">
            {open.map((r) => (
              <li key={r.id} className="card p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="break-words text-sm font-semibold">{r.message}</p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {SOURCE[r.source] ?? r.source}{r.route ? ` | ${r.route}` : ""}
                    </p>
                    <p className="tabular mt-1 text-xs text-ink-muted">
                      {r.occurrences} kali | pertama {formatTanggal(r.first_seen)} {formatWaktu(r.first_seen)} | terakhir {formatTanggal(r.last_seen)} {formatWaktu(r.last_seen)}
                      {r.digest ? ` | kode ${r.digest}` : ""}
                    </p>
                    {r.detail && (
                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer text-brand">Rincian teknis</summary>
                        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-canvas p-2">{r.detail}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <a href={waLink(errorReportText({ ...r, last_seen: `${formatTanggal(r.last_seen)} ${formatWaktu(r.last_seen)}` }))} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#1a7f4b] px-3 text-sm font-medium text-white hover:bg-[#15683d]"><MessageCircle className="h-4 w-4" aria-hidden />Laporkan lewat WhatsApp</a>
                    <CopyReport text={errorReportText({ ...r, last_seen: `${formatTanggal(r.last_seen)} ${formatWaktu(r.last_seen)}` })} />
                    <form action={resolveErrorAction}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" variant="outline" size="sm" className="w-full"><CheckCircle2 className="h-4 w-4" aria-hidden />Tandai selesai</Button>
                    </form>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {done.length > 0 && (
        <section aria-labelledby="done-title">
          <h2 id="done-title" className="mb-3 text-base font-semibold">Sudah ditandai selesai (10 terakhir)</h2>
          <ul className="card divide-y divide-line text-sm">
            {done.map((r) => (
              <li key={r.id} className="p-3">
                <p className="break-words">{r.message}</p>
                <p className="tabular text-xs text-ink-muted">{r.occurrences} kali | selesai {formatTanggal(r.resolved_at as string)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}