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
import { StatusBadge, DISPENSATION_STATUS } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { sanitizeSearch } from "@/lib/validation/common";
import { DISPENSATION_CATEGORY } from "@/lib/validation/dispensation";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Dispensasi" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; name: string; category: string; starts_at: string; ends_at: string; status: string;
  dispensation_students: { id: string; needs_review: boolean }[];
};

export default async function DispensationsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const q = sanitizeSearch(sp.q);
  const status = sp.status === "all" ? "" : (Object.keys(DISPENSATION_STATUS) as string[]).includes(sp.status ?? "") ? sp.status! : "pending";

  let query = supabase
    .from("dispensations")
    .select("id, name, category, starts_at, ends_at, status, dispensation_students(id, needs_review)", { count: "exact" })
    .order("starts_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "name", header: "Kegiatan", cell: (r) => <div><Link href={`/dispensations/${r.id}`} className="font-medium hover:text-brand">{r.name}</Link><p className="text-xs text-ink-muted">{DISPENSATION_CATEGORY[r.category]}</p></div> },
    { key: "when", header: "Waktu", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.starts_at, "d MMM yyyy, HH:mm")}</span> },
    { key: "n", header: "Peserta", hideOnMobile: true, cell: (r) => <span className="tabular">{r.dispensation_students.length} siswa</span> },
    { key: "rev", header: "Catatan", hideOnMobile: true, cell: (r) => { const n = r.dispensation_students.filter((s) => s.needs_review).length; return n > 0 ? <span className="rounded-full bg-warning/10 px-2 py-0.5 text-xs font-medium text-[#9a6510]">{n} perlu ditinjau</span> : null; } },
    { key: "status", header: "Status", cell: (r) => <StatusBadge kind="dispensation" status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Dispensasi kegiatan resmi"
        description="Dispensasi terpisah dari sakit dan izin. Persetujuan bukan bukti siswa ikut serta; guru pendamping wajib mengonfirmasi."
        actions={<Link href="/dispensations/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><Plus className="h-4 w-4" aria-hidden />Ajukan dispensasi</Link>}
      />
      <div className="card">
        <FilterBar action="/dispensations" resetHref="/dispensations">
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status || "all"}>
              <option value="all">Semua status</option>
              {Object.entries(DISPENSATION_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cari nama kegiatan" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Ketik nama kegiatan" /></FilterField>
        </FilterBar>
        {error ? <ErrorState message="Daftar dispensasi tidak dapat dimuat." /> : (
          <>
            <DataTable caption="Dispensasi" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Tidak ada dispensasi" emptyDescription="Tidak ada dispensasi dengan filter ini." />
            <Pagination page={page} total={count ?? 0} basePath="/dispensations" params={{ status: sp.status, q }} />
          </>
        )}
      </div>
    </>
  );
}
