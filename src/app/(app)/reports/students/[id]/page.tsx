import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { PrintButton } from "@/components/ui/print-button";
import { StatusBadge } from "@/components/ui/status-badge";
import { asUuid } from "@/lib/data/lookups";
import { one, openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { CATEGORY_LABEL } from "@/lib/validation/permission";
import { DISPENSATION_CATEGORY, PARTICIPATION_LABEL } from "@/lib/validation/dispensation";
import { formatTanggal } from "@/lib/utils";

const Badge = StatusBadge;

export const metadata: Metadata = { title: "Riwayat Siswa" };
export const dynamic = "force-dynamic";

type Rec = { id: string; status: string; source: string; checked_in_at: string | null; note: string | null; attendance_sessions: { session_date: string } | { session_date: string }[] | null; attendance_corrections: { id: string; previous_status: string; new_status: string; reason: string; corrected_at: string }[] };

export default async function StudentHistoryPage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const supabase = await createClient();

  const { data: s } = await supabase.from("students").select("id, nis, full_name, status, student_class_assignments(class_id, end_date, classes(name))").eq("id", id).maybeSingle();
  if (!s) notFound(); // RLS: guru tidak dapat membuka siswa di luar kelasnya.

  const [recs, perms, disps] = await Promise.all([
    supabase.from("attendance_records").select("id, status, source, checked_in_at, note, attendance_sessions(session_date), attendance_corrections(id, previous_status, new_status, reason, corrected_at)").eq("student_id", id).limit(400),
    supabase.from("permission_requests").select("id, category, start_date, end_date, status, is_retrospective").eq("student_id", id).order("start_date", { ascending: false }).limit(100),
    supabase.from("dispensation_students").select("id, participation, needs_review, dispensations(id, name, category, starts_at, status)").eq("student_id", id).limit(100),
  ]);

  const records = ((recs.data ?? []) as unknown as Rec[])
    .map((r) => ({ ...r, date: one(r.attendance_sessions)?.session_date ?? "" }))
    .sort((a, b) => b.date.localeCompare(a.date));
  const absences = records.filter((r) => ["sick", "permission", "unexcused", "unverified"].includes(r.status));
  const corrections = records.flatMap((r) => r.attendance_corrections.map((c) => ({ ...c, date: r.date })));
  const SOURCE: Record<string, string> = { qr: "Pindai QR", manual: "Manual", permission: "Dari izin", dispensation: "Dari dispensasi", system: "Sistem" };

  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <section className="card p-5 print:break-inside-avoid"><h2 className="mb-3 text-base font-semibold">{title}</h2>{children}</section>;

  return (
    <>
      <PageHeader title={s.full_name} description={`NIS ${s.nis} | Kelas ${openClassName(s.student_class_assignments as AssignmentEmbed[]) ?? "-"}`} actions={<PrintButton />} />
      <div className="space-y-6">
        <Section title={`Riwayat kehadiran (${records.length})`}>
          {records.length === 0 ? <p className="text-sm text-ink-muted">Belum ada catatan.</p> : (
            <div className="overflow-x-auto"><table className="w-full text-sm"><caption className="sr-only">Riwayat kehadiran</caption>
              <thead><tr className="border-b border-line text-left text-xs text-ink-muted"><th scope="col" className="py-2 pr-3 font-medium">Tanggal</th><th scope="col" className="py-2 pr-3 font-medium">Status</th><th scope="col" className="py-2 pr-3 font-medium">Sumber</th><th scope="col" className="py-2 font-medium">Catatan</th></tr></thead>
              <tbody className="divide-y divide-line">{records.map((r) => (
                <tr key={r.id}><td className="tabular whitespace-nowrap py-2 pr-3">{r.date && formatTanggal(r.date, "EEE, d MMM yyyy")}</td><td className="py-2 pr-3"><StatusBadge status={r.status} /></td><td className="py-2 pr-3">{SOURCE[r.source] ?? r.source}{r.checked_in_at ? ` ${formatTanggal(r.checked_in_at, "HH:mm")}` : ""}</td><td className="py-2">{r.note}</td></tr>
              ))}</tbody></table></div>
          )}
        </Section>

        <Section title={`Riwayat ketidakhadiran (${absences.length})`}>
          {absences.length === 0 ? <p className="text-sm text-ink-muted">Tidak ada ketidakhadiran tercatat.</p> : (
            <ul className="flex flex-wrap gap-2">{absences.map((r) => <li key={r.id} className="flex items-center gap-2 rounded-lg border border-line px-3 py-1.5 text-sm"><span className="tabular">{formatTanggal(r.date, "d MMM yyyy")}</span><Badge status={r.status} /></li>)}</ul>
          )}
        </Section>

        <Section title={`Riwayat izin dan sakit (${perms.data?.length ?? 0})`}>
          {(perms.data ?? []).length === 0 ? <p className="text-sm text-ink-muted">Tidak ada pengajuan.</p> : (
            <ul className="divide-y divide-line">{(perms.data ?? []).map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{CATEGORY_LABEL[p.category]} | <span className="tabular">{formatTanggal(p.start_date, "d MMM yyyy")}{p.end_date !== p.start_date ? ` - ${formatTanggal(p.end_date, "d MMM yyyy")}` : ""}</span>{p.is_retrospective ? " | retroaktif" : ""}</span><StatusBadge kind="request" status={p.status} /></li>
            ))}</ul>
          )}
        </Section>

        <Section title={`Dispensasi (${disps.data?.length ?? 0})`}>
          {(disps.data ?? []).length === 0 ? <p className="text-sm text-ink-muted">Tidak ada dispensasi.</p> : (
            <ul className="divide-y divide-line">{(disps.data ?? []).map((d) => {
              const x = one(d.dispensations as { id: string; name: string; category: string; starts_at: string; status: string } | { id: string; name: string; category: string; starts_at: string; status: string }[] | null);
              return <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"><span>{x?.name} ({x ? DISPENSATION_CATEGORY[x.category] : ""}) | <span className="tabular">{x && formatTanggal(x.starts_at, "d MMM yyyy")}</span> | {PARTICIPATION_LABEL[d.participation]}{d.needs_review ? " | perlu ditinjau" : ""}</span>{x && <StatusBadge kind="dispensation" status={x.status} />}</li>;
            })}</ul>
          )}
        </Section>

        <Section title={`Koreksi absensi (${corrections.length})`}>
          {corrections.length === 0 ? <p className="text-sm text-ink-muted">Tidak ada koreksi.</p> : (
            <ul className="divide-y divide-line">{corrections.map((c) => (
              <li key={c.id} className="py-2 text-sm"><p className="flex flex-wrap items-center gap-2"><span className="tabular">{formatTanggal(c.date, "d MMM yyyy")}</span><Badge status={c.previous_status} />ke<Badge status={c.new_status} /></p><p className="text-xs text-ink-muted">{c.reason} | <span className="tabular">{formatTanggal(c.corrected_at, "d MMM yyyy, HH:mm")}</span></p></li>
            ))}</ul>
          )}
        </Section>
      </div>
    </>
  );
}
