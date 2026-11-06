import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { ConfirmAction } from "@/components/settings/row-action";
import { loadSettings, num } from "@/lib/data/settings";
import { formatTanggal } from "@/lib/utils";
import { runHygieneNowAction, saveHygieneSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Kebersihan Akun" };
export const dynamic = "force-dynamic";

export default async function HygienePage() {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const s = await loadSettings();
  const [{ data: preview }, { data: schedule }, { data: runs }] = await Promise.all([
    supabase.rpc("run_account_hygiene_now", { p_dry: true }),
    supabase.rpc("account_hygiene_schedule"),
    supabase.from("audit_logs").select("id, created_at, new_data").eq("action", "account_hygiene_run").order("created_at", { ascending: false }).limit(5),
  ]);
  const p = (preview ?? {}) as { orphan_parents?: number; stale_accounts?: number };
  const pending = Number(p.orphan_parents ?? 0) + Number(p.stale_accounts ?? 0);
  const orphanDays = num(s["hygiene.orphan_parent_days"], 30);
  const staleDays = num(s["hygiene.stale_account_days"], 0);

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Kebersihan akun" description="Menonaktifkan akun yang tidak lagi terpakai agar daftar pengguna tetap bersih. Hanya menonaktifkan, tidak pernah menghapus. Akun dapat diaktifkan kembali." />

      <section className="card p-5 sm:p-6" aria-labelledby="sch">
        <h2 id="sch" className="mb-1 text-base font-semibold">Jadwal</h2>
        {schedule
          ? <p className="text-sm">Berjalan otomatis setiap hari pukul 02:00 WIB (jadwal <span className="font-mono">{String(schedule)}</span> UTC).</p>
          : <p role="note" className="rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#8a5a0e]">Jadwal otomatis belum aktif. Aktifkan ekstensi pg_cron di Supabase (menu Database, lalu Extensions), lalu jalankan baris <span className="font-mono">select cron.schedule(&apos;pandian-account-hygiene&apos;, &apos;0 19 * * *&apos;, &apos;select public.account_hygiene_run()&apos;);</span> di SQL Editor. Sebelum itu aktif, gunakan tombol Jalankan sekarang.</p>}
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="rules">
        <h2 id="rules" className="mb-1 text-base font-semibold">Aturan</h2>
        <p className="mb-4 text-sm text-ink-muted">Isi 0 untuk mematikan sebuah aturan. Akun Super Admin, Administrator Sekolah, Kepala Sekolah, dan guru yang sedang menjadi wali kelas tidak pernah disentuh.</p>
        <SimpleForm action={saveHygieneSettingsAction}>
          <Field label="Orang tua tanpa anak aktif: tunggu (hari)" htmlFor="orphan_days" required hint="Akun orang tua dinonaktifkan bila semua anaknya lulus, pindah, atau nonaktif dan tidak ada perubahan selama jumlah hari ini. Masa tunggu mencegah akun terkunci bila status anak salah diubah. Disarankan 30.">
            <Input id="orphan_days" name="orphan_days" type="number" min={0} max={365} defaultValue={orphanDays} />
          </Field>
          <Field label="Akun belum pernah masuk: batas (hari sejak dibuat)" htmlFor="stale_days" required hint="Berlaku untuk guru, operator, dan orang tua yang belum pernah login. Undangan yang tidak diterima ikut tercakup. Disarankan 60 bila ingin dipakai. Bawaan 0 (mati).">
            <Input id="stale_days" name="stale_days" type="number" min={0} max={365} defaultValue={staleDays} />
          </Field>
        </SimpleForm>
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="now">
        <h2 id="now" className="mb-1 text-base font-semibold">Jalankan sekarang</h2>
        <p className="mb-3 text-sm">Berdasarkan aturan di atas, saat ini <span className="tabular font-semibold">{Number(p.orphan_parents ?? 0)}</span> akun orang tua dan <span className="tabular font-semibold">{Number(p.stale_accounts ?? 0)}</span> akun tidak terpakai akan dinonaktifkan.</p>
        {pending > 0
          ? <ConfirmAction label={`Nonaktifkan ${pending} akun sekarang`} title="Jalankan penonaktifan akun?" description="Akun yang memenuhi aturan akan dinonaktifkan dan tidak dapat masuk. Riwayat tetap tersimpan dan akun dapat diaktifkan kembali di Pengaturan > Pengguna." confirmLabel="Nonaktifkan" danger run={runHygieneNowAction} />
          : <p className="text-sm text-ink-muted">Tidak ada akun yang perlu dinonaktifkan.</p>}
      </section>

      <section className="card p-5 sm:p-6" aria-labelledby="hist">
        <h2 id="hist" className="mb-3 text-base font-semibold">Proses terakhir</h2>
        {(runs ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum pernah berjalan.</p> : (
          <ul className="divide-y divide-line text-sm">
            {(runs ?? []).map((r) => {
              const d = (r.new_data ?? {}) as { orphan_parents?: number; stale_accounts?: number };
              return <li key={r.id as number} className="flex flex-wrap justify-between gap-2 py-2"><span className="tabular text-ink-muted">{formatTanggal(r.created_at as string, "d MMM yyyy, HH:mm")}</span><span>{d.orphan_parents ?? 0} orang tua, {d.stale_accounts ?? 0} akun tidak terpakai</span></li>;
            })}
          </ul>
        )}
      </section>
    </div>
  );
}