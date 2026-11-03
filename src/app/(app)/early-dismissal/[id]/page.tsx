import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { APPROVER_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { asUuid } from "@/lib/data/lookups";
import { one, openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { HANDOVER_OUTCOME_LABEL } from "@/lib/validation/dismissal";
import { formatTanggal } from "@/lib/utils";
import { DecisionPanel, HandoverPanel } from "./panels";

export const metadata: Metadata = { title: "Rincian Pulang Lebih Awal" };
export const dynamic = "force-dynamic";

export default async function DismissalDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const supabase = await createClient();

  const { data: r } = await supabase
    .from("early_dismissal_requests")
    .select("id, requested_by, requester_relation, reason, requested_time, authorized_pickup_name, authorized_pickup_relation, requester_verified, requester_verification_note, status, review_note, reviewed_by, reviewed_at, created_at, students(full_name, nis, student_class_assignments(class_id, end_date, classes(name)))")
    .eq("id", id).maybeSingle();
  if (!r) notFound();

  const { data: logs } = await supabase
    .from("early_dismissal_handover_logs")
    .select("id, outcome, actual_pickup_name, actual_pickup_relation, identity_document, matches_authorized, verification_note, handed_over_at, responsible_staff_id, created_at")
    .eq("request_id", id).order("created_at");

  const ids = [...new Set([r.requested_by, r.reviewed_by, ...(logs ?? []).map((l) => l.responsible_staff_id)].filter(Boolean))] as string[];
  const names = new Map<string, string>();
  const { data: profs } = await supabase.from("profiles").select("id, full_name").in("id", ids);
  for (const p of profs ?? []) names.set(p.id, p.full_name);

  const s = one(r.students as unknown as { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] } | { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] }[] | null);
  const isApprover = user.roles.some((x) => APPROVER_ROLES.includes(x));

  return (
    <>
      <PageHeader title="Rincian pulang lebih awal" description={s?.full_name} actions={<StatusBadge kind="dismissal" status={r.status} />} />
      <div role="note" className="mb-6 flex gap-3 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#8a5a0e]">
        <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>Persetujuan bukan bukti siswa sudah pulang. Kode QR tidak pernah dapat mengizinkan siswa pulang. Siswa baru diserahkan setelah petugas memeriksa identitas penjemput secara langsung.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Siswa</dt><dd className="mt-0.5 font-medium">{s?.full_name}</dd></div>
              <div><dt className="text-ink-muted">Kelas / NIS</dt><dd className="mt-0.5 font-medium">{openClassName(s?.student_class_assignments) ?? "-"} | <span className="tabular">{s?.nis}</span></dd></div>
              <div><dt className="text-ink-muted">Waktu penjemputan</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(r.requested_time, "d MMM yyyy, HH:mm")} WIB</dd></div>
              <div><dt className="text-ink-muted">Pemohon</dt><dd className="mt-0.5 font-medium">{names.get(r.requested_by) ?? "-"} ({r.requester_relation})</dd></div>
              <div><dt className="text-ink-muted">Penjemput yang diizinkan</dt><dd className="mt-0.5 font-medium">{r.authorized_pickup_name} ({r.authorized_pickup_relation})</dd></div>
              <div><dt className="text-ink-muted">Diajukan</dt><dd className="tabular mt-0.5 font-medium">{formatTanggal(r.created_at, "d MMM yyyy, HH:mm")}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-muted">Alasan</dt><dd className="mt-0.5">{r.reason}</dd></div>
              <div className="sm:col-span-2"><dt className="text-ink-muted">Verifikasi identitas pemohon</dt><dd className="mt-0.5">{r.requester_verified ? `Terverifikasi: ${r.requester_verification_note}` : "Belum diverifikasi"}</dd></div>
              {r.review_note && <div className="sm:col-span-2"><dt className="text-ink-muted">Catatan keputusan{r.reviewed_by ? ` (${names.get(r.reviewed_by) ?? "-"})` : ""}</dt><dd className="mt-0.5 rounded-lg bg-canvas px-3 py-2">{r.review_note}</dd></div>}
            </dl>
          </section>

          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Riwayat serah terima</h2>
            {(logs ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum ada serah terima atau percobaan verifikasi.</p> : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {(logs ?? []).map((l) => (
                  <li key={l.id} className="px-4 py-3 text-sm">
                    <p className="font-medium">{HANDOVER_OUTCOME_LABEL[l.outcome] ?? l.outcome}</p>
                    <p className="text-ink-muted">{l.actual_pickup_name} ({l.actual_pickup_relation}) | dokumen: {l.identity_document} | {l.matches_authorized ? "cocok dengan penjemput diizinkan" : "tidak cocok"}</p>
                    <p className="tabular text-xs text-ink-muted">{formatTanggal(l.created_at, "d MMM yyyy, HH:mm")} | petugas {names.get(l.responsible_staff_id) ?? "-"}</p>
                    {l.verification_note && <p className="mt-1 rounded-lg bg-canvas px-2.5 py-1.5 text-xs">{l.verification_note}</p>}
                  </li>
                ))}
              </ul>
            )}
            {r.status === "approved" && <div className="mt-4"><HandoverPanel id={r.id} authorizedName={r.authorized_pickup_name} authorizedRelation={r.authorized_pickup_relation} /></div>}
          </section>
        </div>

        <aside>
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Keputusan</h2>
            {isApprover ? <DecisionPanel id={r.id} status={r.status} /> : <p className="text-sm text-ink-muted">Hanya kepala sekolah atau administrator yang dapat memutuskan permintaan ini.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}