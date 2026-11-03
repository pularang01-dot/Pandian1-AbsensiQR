import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge, DISMISSAL_STATUS } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { one } from "@/lib/data/students";
import { sanitizeSearch } from "@/lib/validation/common";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Pulang Lebih Awal" };
export const dynamic = "force-dynamic";

type Row = { id: string; requested_time: string; status: string; authorized_pickup_name: string; students: { full_name: string } | { full_name: string }[] | null };

export default async function EarlyDismissalPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const q = sanitizeSearch(sp.q);
  const status = sp.status === "all" ? "" : (Object.keys(DISMISSAL_STATUS) as string[]).includes(sp.status ?? "") ? sp.status! : "pending";

  let query = supabase
    .from("early_dismissal_requests")
    .select("id, requested_time, status, authorized_pickup_name, students!inner(full_name)", { count: "exact" })
    .order("requested_time", { ascending: status === "pending" || status === "approved" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("students.full_name", `%${q}%`);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "s", header: "Siswa", cell: (r) => <Link href={`/early-dismissal/${r.id}`} className="font-medium hover:text-brand">{one(r.students)?.full_name}</Link> },
    { key: "t", header: "Waktu jemput", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.requested_time, "d MMM yyyy, HH:mm")}</span> },
    { key: "p", header: "Penjemput diizinkan", hideOnMobile: true, cell: (r) => r.authorized_pickup_name },
    { key: "st", header: "Status", cell: (r) => <StatusBadge kind="dismissal" status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Pulang lebih awal"
        description="Persetujuan bukan bukti siswa sudah pulang. Serah terima harus dicatat setelah identitas penjemput diverifikasi."
        actions={<Link href="/early-dismissal/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><Plus className="h-4 w-4" aria-hidden />Catat permintaan</Link>}
      />
      <div className="card">
        <FilterBar action="/early-dismissal" resetHref="/early-dismissal">
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status || "all"}>
              <option value="all">Semua status</option>
              {Object.entries(DISMISSAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cari nama siswa" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Ketik nama siswa" /></FilterField>
        </FilterBar>
        {error ? <ErrorState message="Daftar permintaan tidak dapat dimuat." /> : (
          <>
            <DataTable caption="Permintaan pulang lebih awal" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Tidak ada permintaan" emptyDescription="Tidak ada permintaan dengan filter ini." />
            <Pagination page={page} total={count ?? 0} basePath="/early-dismissal" params={{ status: sp.status, q }} />
          </>
        )}
      </div>
    </>
  );
}
