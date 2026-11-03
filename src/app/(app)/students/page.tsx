import type { Metadata } from "next";
import Link from "next/link";
import { Download, IdCard, Plus, Upload } from "lucide-react";
import { ADMIN_ROLES, APPROVER_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ErrorState } from "@/components/ui/states";
import { loadClasses, loadYears, pickYear, asUuid } from "@/lib/data/lookups";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { sanitizeSearch } from "@/lib/validation/common";
import { STUDENT_STATUS_LABEL } from "@/lib/validation/student";

export const metadata: Metadata = { title: "Siswa" };
export const dynamic = "force-dynamic";

type Row = {
  id: string; nis: string; nisn: string | null; full_name: string; gender: string | null; status: string;
  student_class_assignments: AssignmentEmbed[];
};

const btn = "inline-flex h-11 items-center gap-2 rounded-lg px-4 text-sm font-medium";

export default async function StudentsPage({ searchParams }: { searchParams: Promise<{ q?: string; class?: string; status?: string; page?: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const canExport = user.roles.some((r) => APPROVER_ROLES.includes(r));

  const q = sanitizeSearch(sp.q);
  const page = parsePage(sp.page);
  const status = ["active", "transferred", "graduated", "inactive"].includes(sp.status ?? "") ? sp.status! : "active";
  const years = await loadYears();
  const year = pickYear(years);
  const classes = await loadClasses(year?.id);
  const classId = classes.some((c) => c.id === asUuid(sp.class)) ? asUuid(sp.class) : null;

  const embed = classId
    ? "student_class_assignments!inner(class_id, end_date, classes(name))"
    : "student_class_assignments(class_id, end_date, classes(name))";
  let query = supabase
    .from("students")
    .select(`id, nis, nisn, full_name, gender, status, ${embed}`, { count: "exact" })
    .eq("status", status)
    .order("full_name")
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (classId) query = query.eq("student_class_assignments.class_id", classId).is("student_class_assignments.end_date", null);
  if (q) query = query.or(`full_name.ilike.%${q}%,nis.ilike.%${q}%`);

  const { data, count, error } = await query;
  const rows = (data ?? []) as unknown as Row[];

  const columns: Column<Row>[] = [
    { key: "name", header: "Nama", cell: (r) => <Link href={`/students/${r.id}`} className="font-medium text-ink hover:text-brand">{r.full_name}</Link> },
    { key: "nis", header: "NIS", cell: (r) => <span className="tabular">{r.nis}</span> },
    { key: "nisn", header: "NISN", hideOnMobile: true, cell: (r) => <span className="tabular">{r.nisn ?? "-"}</span> },
    { key: "class", header: "Kelas", cell: (r) => openClassName(r.student_class_assignments) ?? <span className="text-ink-muted">Belum ditempatkan</span> },
    { key: "gender", header: "L/P", hideOnMobile: true, cell: (r) => r.gender ?? "-" },
    { key: "status", header: "Status", hideOnMobile: true, cell: (r) => STUDENT_STATUS_LABEL[r.status] ?? r.status },
  ];

  const exportQs = new URLSearchParams({ status, ...(classId ? { class: classId } : {}), ...(q ? { q } : {}) }).toString();

  return (
    <>
      <PageHeader
        title="Siswa"
        description="Data induk siswa. Perubahan data dicatat dalam jejak audit."
        actions={
          <>
            {isAdmin && <Link href="/students/new" className={`${btn} bg-brand text-white hover:bg-[#2b68bd]`}><Plus className="h-4 w-4" aria-hidden />Tambah siswa</Link>}
            {isAdmin && <Link href="/students/import" className={`${btn} border border-line bg-surface hover:bg-canvas`}><Upload className="h-4 w-4" aria-hidden />Impor</Link>}
            {isAdmin && <Link href="/students/qr-cards" className={`${btn} border border-line bg-surface hover:bg-canvas`}><IdCard className="h-4 w-4" aria-hidden />Kartu QR</Link>}
            {canExport && <a href={`/students/export?${exportQs}&format=xlsx`} className={`${btn} border border-line bg-surface hover:bg-canvas`}><Download className="h-4 w-4" aria-hidden />Ekspor Excel</a>}
          </>
        }
      />
      <div className="card">
        <FilterBar action="/students" resetHref="/students">
          <FilterField label="Cari nama atau NIS" htmlFor="q" grow>
            <Input id="q" name="q" defaultValue={q} placeholder="Ketik nama atau NIS" />
          </FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId ?? ""}>
              <option value="">Semua kelas</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Status" htmlFor="status">
            <Select id="status" name="status" defaultValue={status}>
              {Object.entries(STUDENT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          </FilterField>
        </FilterBar>

        {error ? (
          <ErrorState message="Daftar siswa tidak dapat dimuat. Coba muat ulang halaman." />
        ) : (
          <>
            <DataTable
              caption="Daftar siswa"
              columns={columns}
              rows={rows}
              rowKey={(r) => r.id}
              emptyTitle={q || classId ? "Tidak ada siswa yang cocok" : "Belum ada siswa"}
              emptyDescription={q || classId ? "Ubah kata kunci atau filter pencarian." : isAdmin ? "Tambahkan siswa satu per satu atau impor dari Excel/CSV." : "Data siswa akan muncul setelah administrator menambahkannya."}
            />
            <Pagination page={page} total={count ?? 0} basePath="/students" params={{ q, class: classId ?? undefined, status }} />
          </>
        )}
      </div>
    </>
  );
}
