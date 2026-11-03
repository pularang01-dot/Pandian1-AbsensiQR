import type { Metadata } from "next";
import Link from "next/link";
import { FilePlus2, Paperclip } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { one } from "@/lib/data/students";
import { CATEGORY_LABEL } from "@/lib/validation/permission";
import { formatTanggal } from "@/lib/utils";
import { CancelRequestButton } from "./cancel-button";

export const metadata: Metadata = { title: "Izin Saya" };
export const dynamic = "force-dynamic";

export default async function ParentPermissionsPage({ searchParams }: { searchParams: Promise<{ sent?: string }> }) {
  await requireRole(["parent"]);
  const sp = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("permission_requests")
    .select("id, category, start_date, end_date, reason, status, is_retrospective, review_note, submitted_at, students(full_name), permission_documents(id)")
    .order("submitted_at", { ascending: false })
    .limit(50);

  return (
    <>
      <PageHeader
        title="Izin dan sakit"
        description="Pantau status pengajuan dan pesan dari sekolah."
        actions={<Link href="/parent/permissions/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><FilePlus2 className="h-4 w-4" aria-hidden />Ajukan baru</Link>}
      />
      {sp.sent && <p role="status" className="mb-4 rounded-lg border border-success/20 bg-success/10 px-4 py-3 text-sm text-success">Pengajuan terkirim dan menunggu peninjauan sekolah. Status belum disetujui sampai Anda melihat statusnya berubah.</p>}

      {(data ?? []).length === 0 ? (
        <div className="card"><EmptyState title="Belum ada pengajuan" description="Pengajuan izin dan pemberitahuan sakit Anda akan tampil di sini." /></div>
      ) : (
        <ul className="space-y-3">
          {(data ?? []).map((r) => (
            <li key={r.id} className="card p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{one(r.students as unknown as { full_name: string } | { full_name: string }[] | null)?.full_name} | {CATEGORY_LABEL[r.category]}</p>
                  <p className="tabular text-sm text-ink-muted">{formatTanggal(r.start_date, "d MMM yyyy")}{r.end_date !== r.start_date ? ` - ${formatTanggal(r.end_date, "d MMM yyyy")}` : ""}</p>
                </div>
                <StatusBadge kind="request" status={r.status} />
              </div>
              <p className="mt-2 text-sm">{r.reason}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-ink-muted">
                <span>Dikirim {formatTanggal(r.submitted_at, "d MMM yyyy, HH:mm")}</span>
                {r.is_retrospective && <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-[#9a6510]">Diajukan setelah tanggal ketidakhadiran</span>}
                {(r.permission_documents as unknown[]).length > 0 && <span className="inline-flex items-center gap-1"><Paperclip className="h-3.5 w-3.5" aria-hidden />Dokumen terlampir</span>}
              </div>
              {r.review_note && <p className="mt-3 rounded-lg bg-canvas px-3 py-2.5 text-sm"><span className="font-medium">Pesan sekolah:</span> {r.review_note}</p>}
              {["pending", "under_review", "needs_clarification"].includes(r.status) && <div className="mt-3"><CancelRequestButton id={r.id} /></div>}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}