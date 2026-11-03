import type { Metadata } from "next";
import Link from "next/link";
import { Paperclip, Plus } from "lucide-react";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { StatusBadge, REQUEST_STATUS } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/states";
import { one } from "@/lib/data/students";
import { sanitizeSearch } from "@/lib/validation/common";
import { CATEGORY_LABEL } from "@/lib/validation/permission";
import { formatTanggal } from "@/lib/utils";

export const metadata: Metadata = { title: "Izin dan Sakit" };
export const dynamic = "force-dynamic";

type StudentEmbed = { full_name: string; student_class_assignments: { end_date: string | null; classes: { name: string } | { name: string }[] | null }[] };
type Row = {
  id: string; category: string; start_date: string; end_date: string; status: string; is_retrospective: boolean; submitted_at: string; entered_manually: boolean;
  students: StudentEmbed | StudentEmbed[] | null;
  permission_documents: { id: string }[];
};

function classOf(s: StudentEmbed | null) {
  const open = s?.student_class_assignments.find((a) => a.end_date === null);
  return open ? (one(open.classes)?.name ?? null) : null;
}

export default async function PermissionsPage({ searchParams }: { searchParams: Promise<{ status?: string; q?: string; page?: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const page = parsePage(sp.page);
  const q = sanitizeSearch(sp.q);
  const status = sp.status === "all" ? "" : (Object.keys(REQUEST_STATUS) as string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const canRecord = user.roles.some((r) => ADMIN_ROLES.includes(r));

  let query = supabase
    .from("permission_requests")
    .select("id, category, start_date, end_date, status, is_retrospective, submitted_at, entered_manually, students!inner(full_name, student_class_assignments(end_date, classes(name))), permission_documents(id)", { count: "exact" })
    .order("submitted_at", { ascending: status === "pending" })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  if (q) query = query.ilike("students.full_name", `%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "student", header: "Siswa", cell: (r) => { const s = one(r.students); const cls = classOf(s); return <div><Link href={`/permissions/${r.id}`} className="font-medium hover:text-brand">{s?.full_name}</Link><p className="text-xs text-ink-muted">{cls ? `Kelas ${cls}` : ""}</p></div>; } },
    { key: "cat", header: "Kategori", cell: (r) => CATEGORY_LABEL[r.category] },
    { key: "dates", header: "Tanggal", cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.start_date, "d MMM yyyy")}{r.end_date !== r.start_date ? ` - ${formatTanggal(r.end_date, "d MMM")}` : ""}</span> },
    { key: "sub", header: "Dikirim", hideOnMobile: true, cell: (r) => <span className="tabular whitespace-nowrap">{formatTanggal(r.submitted_at, "d MMM yyyy, HH:mm")}</span> },
    { key: "flags", header: "Catatan", hideOnMobile: true, cell: (r) => <div className="flex flex-wrap gap-1.5 text-xs">{r.is_retrospective && <span className="rounded-full bg-warning/10 px-2 py-0.5 font-medium text-[#9a6510]">Retroaktif</span>}{r.entered_manually && <span className="rounded-full bg-info/10 px-2 py-0.5 font-medium text-info">Dicatat sekolah</span>}{r.permission_documents.length > 0 && <span className="inline-flex items-center gap-1 text-ink-muted"><Paperclip className="h-3.5 w-3.5" aria-hidden />Dokumen</span>}</div> },
    { key: "status", header: "Status", cell: (r) => <StatusBadge kind="request" status={r.status} /> },
  ];

  return (
    <>
      <PageHeader
        title="Izin dan sakit"
        description="Tinjau pengajuan orang tua. Hanya pengajuan yang disetujui yang memengaruhi data absensi."
        actions={canRecord ? <Link href="/permissions/new" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]"><Plus className="h-4 w-4" aria-hidden />Catat manual</Link> : undefined}
      />
      <div className="card">
        <FilterBar action="/permissions" resetHref="/permissions">
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status || "all"}>
              <option value="all">Semua status</option>
              {Object.entries(REQUEST_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Cari nama siswa" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Ketik nama siswa" /></FilterField>
        </FilterBar>
        {error ? <ErrorState message="Daftar pengajuan tidak dapat dimuat." /> : (
          <>
            <DataTable caption="Pengajuan izin dan sakit" columns={columns} rows={rows} rowKey={(r) => r.id} emptyTitle="Tidak ada pengajuan" emptyDescription={status === "pending" ? "Tidak ada pengajuan yang menunggu. Ubah filter status untuk melihat yang lain." : "Tidak ada pengajuan dengan filter ini."} />
            <Pagination page={page} total={count ?? 0} basePath="/permissions" params={{ status: sp.status, q }} />
          </>
        )}
      </div>
    </>
  );
}
