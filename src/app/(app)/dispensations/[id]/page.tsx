import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { APPROVER_ROLES, ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { asUuid } from "@/lib/data/lookups";
import { one, openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { DISPENSATION_CATEGORY, PARTICIPATION_LABEL } from "@/lib/validation/dispensation";
import { formatTanggal } from "@/lib/utils";
import { ApprovalPanel, CompleteButton, ParticipationButtons } from "./panels";

export const metadata: Metadata = { title: "Rincian Dispensasi" };
export const dynamic = "force-dynamic";

type Participant = {
  id: string; student_id: string; participation: string; needs_review: boolean;
  students: { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] } | { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] }[] | null;
};

export default async function DispensationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const supabase = await createClient();

  const { data: d } = await supabase
    .from("dispensations")
    .select("id, name, category, location, description, starts_at, ends_at, supervisor_id, requested_by, status, review_note, reviewed_by, reviewed_at, created_at, dispensation_students(id, student_id, participation, needs_review, students(full_name, nis, student_class_assignments(class_id, end_date, classes(name))))")
    .eq("id", id)
    .maybeSingle();
  if (!d) notFound();

  const ids = [...new Set([d.supervisor_id, d.requested_by, d.reviewed_by].filter(Boolean))] as string[];
  const names = new Map<string, string>();
  const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  for (const p of profs ?? []) names.set(p.id, p.full_name);

  const participants = ((d.dispensation_students ?? []) as unknown as Participant[])
    .map((p) => ({ ...p, s: one(p.students) }))
    .sort((a, b) => (a.s?.full_name ?? "").localeCompare(b.s?.full_name ?? "", "id"));
  const isApprover = user.roles.some((r) => APPROVER_ROLES.includes(r));
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const isSupervisor = d.supervisor_id === user.id;
  const canConfirm = (isSupervisor || isAdmin) && (d.status === "approved" || d.status === "completed");
  const canCancel = isApprover || d.requested_by === user.id;

  return (
    <>
      <PageHeader title={d.name} description={DISPENSATION_CATEGORY[d.category]} actions={<StatusBadge kind="dispensation" status={d.status} />} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Mulai</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(d.starts_at, "d MMM yyyy, HH:mm")} WIB</dd></div>
              <div><dt className="text-ink-muted">Selesai</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(d.ends_at, "d MMM yyyy, HH:mm")} WIB</dd></div>
              <div><dt className="text-ink-muted">Lokasi</dt><dd className="mt-0.5 font-medium">{d.location ?? "-"}</dd></div>
              <div><dt className="text-ink-muted">Guru pendamping</dt><dd className="mt-0.5 font-medium">{names.get(d.supervisor_id) ?? "-"}</dd></div>
              <div><dt className="text-ink-muted">Diajukan oleh</dt><dd className="mt-0.5 font-medium">{names.get(d.requested_by) ?? "-"}</dd></div>
              <div><dt className="text-ink-muted">Diajukan pada</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(d.created_at, "d MMM yyyy, HH:mm")}</dd></div>
              {d.description && <div className="sm:col-span-2"><dt className="text-ink-muted">Deskripsi</dt><dd className="mt-0.5">{d.description}</dd></div>}
              {d.review_note && <div className="sm:col-span-2"><dt className="text-ink-muted">Catatan keputusan{d.reviewed_by ? ` (${names.get(d.reviewed_by) ?? "-"})` : ""}</dt><dd className="mt-0.5 rounded-lg bg-canvas px-3 py-2">{d.review_note}</dd></div>}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Siswa peserta ({participants.length})</h2>
            <p className="mb-3 text-xs text-ink-muted">Dispensasi yang disetujui bukan bukti siswa ikut serta. Absensi Kegiatan Resmi Sekolah hanya dicatat setelah guru pendamping mengonfirmasi.</p>
            <ul className="divide-y divide-line rounded-lg border border-line">
              {participants.map((p) => (
                <li key={p.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.s?.full_name}</p>
                    <p className="text-xs text-ink-muted">Kelas {openClassName(p.s?.student_class_assignments) ?? "-"} | NIS <span className="tabular">{p.s?.nis}</span></p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full border border-line bg-canvas px-2 py-0.5 font-medium">{PARTICIPATION_LABEL[p.participation]}</span>
                      {p.needs_review && <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-[#9a6510]">Perlu ditinjau</span>}
                    </p>
                  </div>
                  {canConfirm && <ParticipationButtons dispensationId={d.id} studentId={p.student_id} name={p.s?.full_name ?? "siswa"} current={p.participation} />}
                </li>
              ))}
            </ul>
            {canConfirm && d.status === "approved" && <div className="mt-4"><CompleteButton id={d.id} /></div>}
            {!canConfirm && (d.status === "approved" || d.status === "completed") && <p className="mt-3 text-xs text-ink-muted">Hanya guru pendamping atau administrator yang dapat mengonfirmasi partisipasi.</p>}
          </section>
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Keputusan</h2>
            <ApprovalPanel id={d.id} status={d.status} isApprover={isApprover} canCancel={canCancel} />
          </section>
        </aside>
      </div>
    </>
  );
}
