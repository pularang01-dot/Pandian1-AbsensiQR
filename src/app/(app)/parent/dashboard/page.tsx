import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2 } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { loadChildren } from "@/lib/data/children";
import { one } from "@/lib/data/students";
import { CATEGORY_LABEL } from "@/lib/validation/permission";
import { formatTanggal, todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Beranda Orang Tua" };
export const dynamic = "force-dynamic";

export default async function ParentDashboard() {
  const user = await requireRole(["parent"]);
  const supabase = await createClient();
  const today = todayISO();
  const children = await loadChildren();

  const [todayRecs, requests] = await Promise.all([
    children.length
      ? supabase.from("attendance_records").select("student_id, status, attendance_sessions!inner(session_date)").eq("attendance_sessions.session_date", today).in("student_id", children.map((c) => c.id))
      : Promise.resolve({ data: [] }),
    supabase.from("permission_requests").select("id, category, start_date, end_date, status, review_note, students(full_name)").order("submitted_at", { ascending: false }).limit(5),
  ]);
  const statusToday = new Map(((todayRecs.data ?? []) as { student_id: string; status: string }[]).map((r) => [r.student_id, r.status]));

  return (
    <>
      <PageHeader
        title={`Selamat datang, ${user.fullName}`}
        description={formatTanggal(today)}
        actions={children.length > 0 ? <Link href="/parent/permissions/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><FilePlus2 className="h-4 w-4" aria-hidden />Ajukan izin / sakit</Link> : undefined}
      />

      {children.length === 0 ? (
        <div className="card"><EmptyState title="Akun belum terhubung dengan siswa" description="Hubungi administrator sekolah agar akun Anda dihubungkan dengan data anak Anda." /></div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card">
            <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold">Kehadiran anak hari ini</h2></div>
            <ul className="divide-y divide-line">
              {children.map((c) => {
                const st = statusToday.get(c.id);
                return (
                  <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-4">
                    <div><p className="text-sm font-semibold">{c.full_name}</p><p className="text-xs text-ink-muted">{c.className ? `Kelas ${c.className}` : "Belum ada kelas"}</p></div>
                    {st ? <StatusBadge status={st} /> : <span className="text-sm text-ink-muted">Belum tercatat</span>}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">Pengajuan terbaru</h2>
              <Link href="/parent/permissions" className="text-sm font-medium text-brand hover:underline">Lihat semua</Link>
            </div>
            {(requests.data ?? []).length === 0 ? (
              <EmptyState title="Belum ada pengajuan" description="Ajukan izin atau pemberitahuan sakit bila anak berhalangan hadir." />
            ) : (
              <ul className="divide-y divide-line">
                {(requests.data ?? []).map((r) => (
                  <li key={r.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">{one(r.students as unknown as { full_name: string } | { full_name: string }[] | null)?.full_name} | {CATEGORY_LABEL[r.category]}</p>
                        <p className="text-xs text-ink-muted">{formatTanggal(r.start_date, "d MMM yyyy")}{r.end_date !== r.start_date ? ` - ${formatTanggal(r.end_date, "d MMM yyyy")}` : ""}</p>
                      </div>
                      <StatusBadge kind="request" status={r.status} />
                    </div>
                    {r.review_note && <p className="mt-2 rounded-lg bg-canvas px-3 py-2 text-xs text-ink-muted">Pesan sekolah: {r.review_note}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </>
  );
}