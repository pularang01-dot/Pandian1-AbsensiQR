import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FileDown } from "lucide-react";
import { APPROVER_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { asUuid } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";
import { CATEGORY_LABEL } from "@/lib/validation/permission";
import { formatTanggal } from "@/lib/utils";
import { ReviewPanel } from "./review-panel";

export const metadata: Metadata = { title: "Rincian Pengajuan" };
export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  submitted: "Diajukan", start_review: "Mulai ditinjau", request_clarification: "Diminta klarifikasi", approve: "Disetujui",
  reject: "Ditolak", cancel_approval: "Persetujuan dibatalkan",
};

export default async function PermissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("permission_requests")
    .select("id, student_id, requested_by, entered_manually, category, start_date, end_date, reason, status, is_retrospective, review_note, reviewed_by, reviewed_at, submitted_at, students(full_name, nis, status, student_class_assignments(end_date, classes(name))), permission_documents(id, file_name, mime_type, size_bytes)")
    .eq("id", id)
    .maybeSingle();
  if (!r) notFound();

  const { data: events } = await supabase.from("permission_request_events").select("id, action, actor_id, note, created_at").eq("request_id", id).order("created_at");
  const actorIds = [...new Set([r.requested_by, r.reviewed_by, ...(events ?? []).map((e) => e.actor_id)].filter(Boolean))] as string[];
  const names = new Map<string, string>();
  if (actorIds.length) {
    const { data } = await supabase.from("profiles").select("id, full_name").in("id", actorIds);
    for (const p of data ?? []) names.set(p.id, p.full_name);
  }

  const s = one(r.students as unknown as { full_name: string; nis: string; status: string; student_class_assignments: { end_date: string | null; classes: { name: string } | { name: string }[] | null }[] } | { full_name: string; nis: string; status: string; student_class_assignments: { end_date: string | null; classes: { name: string } | { name: string }[] | null }[] }[] | null);
  const open = s?.student_class_assignments.find((a) => a.end_date === null);
  const cls = open ? one(open.classes)?.name : null;
  const docs = (r.permission_documents ?? []) as { id: string; file_name: string; mime_type: string; size_bytes: number }[];
  const isApprover = user.roles.some((x) => APPROVER_ROLES.includes(x));

  return (
    <>
      <PageHeader title="Rincian pengajuan" description={`${CATEGORY_LABEL[r.category]} | ${s?.full_name ?? "Siswa"}`} actions={<StatusBadge kind="request" status={r.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Siswa</dt><dd className="mt-0.5 font-medium">{s?.full_name}</dd></div>
              <div><dt className="text-ink-muted">Kelas / NIS</dt><dd className="mt-0.5 font-medium">{cls ?? "-"} | <span className="tabular">{s?.nis}</span></dd></div>
              <div><dt className="text-ink-muted">Kategori</dt><dd className="mt-0.5 font-medium">{CATEGORY_LABEL[r.category]}</dd></div>
              <div><dt className="text-ink-muted">Tanggal</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(r.start_date)}{r.end_date !== r.start_date ? ` s.d. ${formatTanggal(r.end_date)}` : ""}</dd></div>
              <div><dt className="text-ink-muted">Pengaju</dt><dd className="mt-0.5 font-medium">{names.get(r.requested_by) ?? "-"}{r.entered_manually ? " (dicatat oleh sekolah atas nama orang tua)" : ""}</dd></div>
              <div><dt className="text-ink-muted">Dikirim</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(r.submitted_at, "d MMM yyyy, HH:mm")}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-muted">Alasan singkat</dt><dd className="mt-0.5">{r.reason}</dd></div>
            </dl>
            {r.is_retrospective && <p className="mt-4 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#8a5a0e]">Diajukan setelah tanggal ketidakhadiran (retroaktif). Memerlukan peninjauan tambahan dan tidak pernah disetujui otomatis.</p>}
            {s && s.status !== "active" && <p className="mt-4 rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">Siswa tidak berstatus aktif. Persetujuan akan ditolak sistem.</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Dokumen pendukung</h2>
            {docs.length === 0 ? <p className="text-sm text-ink-muted">Tidak ada dokumen terlampir.</p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {docs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0"><p className="truncate text-sm font-medium">{d.file_name}</p><p className="tabular text-xs text-ink-muted">{(d.size_bytes / 1024).toFixed(0)} KB</p></div>
                    <a href={`/permissions/${r.id}/document/${d.id}`} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border border-line px-3 text-sm font-medium hover:bg-canvas"><FileDown className="h-4 w-4" aria-hidden />Buka</a>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-xs text-ink-muted">Dokumen bersifat privat. Tautan hanya berlaku sekitar satu menit.</p>
          </section>

          {isApprover && (
            <section className="card p-5">
              <h2 className="mb-3 text-base font-semibold">Keputusan</h2>
              <ReviewPanel requestId={r.id} status={r.status} retrospective={r.is_retrospective} canCancelApproval={isApprover} />
            </section>
          )}
          {!isApprover && <p className="text-sm text-ink-muted">Hanya kepala sekolah atau administrator yang dapat memutuskan pengajuan ini.</p>}
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold">Riwayat</h2>
            {(events ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum ada riwayat.</p> : (
              <ol className="relative space-y-4 border-l border-line pl-4">
                {(events ?? []).map((e) => (
                  <li key={e.id}>
                    <span aria-hidden className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-surface bg-brand" />
                    <p className="text-sm font-medium">{ACTION_LABEL[e.action] ?? e.action}</p>
                    <p className="text-xs text-ink-muted">{e.actor_id ? names.get(e.actor_id) ?? "Pengguna" : "Sistem"} | <span className="tabular">{formatTanggal(e.created_at, "d MMM yyyy, HH:mm")}</span></p>
                    {e.note && <p className="mt-1 rounded-lg bg-canvas px-2.5 py-1.5 text-xs">{e.note}</p>}
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>
      </div>
    </>
  );
}