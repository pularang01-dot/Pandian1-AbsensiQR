import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { StatusBadge } from "@/components/ui/status-badge";
import { one } from "@/lib/data/students";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Pulang Lebih Awal" };
export const dynamic = "force-dynamic";

type Row = { id: string; requested_time: string; status: string; authorized_pickup_name: string; review_note: string | null; students: { full_name: string } | { full_name: string }[] | null };

export default async function ParentDismissalPage() {
  await requireRole(["parent"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("early_dismissal_requests")
    .select("id, requested_time, status, authorized_pickup_name, review_note, students(full_name)")
    .order("created_at", { ascending: false }).limit(50);
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "s", header: "Anak", cell: (r) => <span className="font-medium">{one(r.students)?.full_name}</span> },
    { key: "t", header: "Waktu jemput", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.requested_time, "d MMM yyyy, HH:mm")}</span> },
    { key: "p", header: "Penjemput", hideOnMobile: true, cell: (r) => r.authorized_pickup_name },
    { key: "st", header: "Status", cell: (r) => <div><StatusBadge kind="dismissal" status={r.status} />{r.review_note && <p className="mt-1 text-xs text-ink-muted">{r.review_note}</p>}</div> },
  ];

  return (
    <>
      <PageHeader title="Pulang lebih awal" description="Permintaan harus disetujui sekolah. Penjemput wajib membawa identitas yang akan diperiksa petugas."
        actions={<Link href="/parent/early-dismissal/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><Plus className="h-4 w-4" aria-hidden />Ajukan permintaan</Link>} />
      <div className="card">
        <DataTable caption="Permintaan pulang lebih awal" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Belum ada permintaan" emptyDescription="Permintaan yang Anda ajukan akan muncul di sini." />
      </div>
    </>
  );
}
