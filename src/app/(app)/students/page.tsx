import type { Metadata } from "next";
import Link from "next/link";
import { Download, IdCard, Plus, Upload, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { ADMIN_ROLES, APPROVER_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
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

  // Jumlah siswa per status untuk deretan penyaring di atas daftar.
  const STATUSES = ["active", "transferred", "graduated", "inactive"] as const;
  const statusCounts = await Promise.all(
    STATUSES.map(async (k) => {
      const { count: n } = await supabase.from("students").select("id", { count: "exact", head: true }).eq("status", k);
      return [k, n ?? 0] as const;
    }),
  );
  const tabHref = (k: string) => {
    const p = new URLSearchParams({ status: k });
    if (classId) p.set("class", classId);
    if (q) p.set("q", q);
    return `/students?${p.toString()}`;
  };
  const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const STATUS_TONE: Record<string, string> = {
    active: "bg-success/10 text-success border-success/20",
    transferred: "bg-info/10 text-info border-info/20",
    graduated: "bg-brand-light text-brand border-brand/20",
    inactive: "bg-canvas text-ink-muted border-line",
  };

  const columns: Column<Row>[] = [
    { key: "name", header: "Siswa", cell: (r) => (
      <span className="flex items-center gap-3">
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-xs font-semibold text-brand">{initials(r.full_name)}</span>
        <span className="min-w-0">
          <span className="block truncate">{r.full_name}</span>
          <span className="tabular block text-xs font-normal text-ink-muted md:hidden">NIS {r.nis}</span>
        </span>
      </span>
    ) },
    { key: "nis", header: "NIS", hideOnMobile: true, cell: (r) => <span className="tabular">{r.nis}</span> },
    { key: "nisn", header: "NISN", hideOnMobile: true, cell: (r) => <span className="tabular text-ink-muted">{r.nisn ?? "-"}</span> },
    { key: "class", header: "Kelas", cell: (r) => {
      const n = openClassName(r.student_class_assignments);
      return n
        ? <span className="inline-flex rounded-lg bg-navy px-2.5 py-1 text-xs font-semibold text-white">{n}</span>
        : <span className="inline-flex rounded-lg bg-warning/10 px-2.5 py-1 text-xs font-medium text-[#8a5a0e]">Belum ditempatkan</span>;
    } },
    { key: "gender", header: "L/P", hideOnMobile: true, cell: (r) => <span title={r.gender === "L" ? "Laki-laki" : r.gender === "P" ? "Perempuan" : undefined}>{r.gender ?? "-"}</span> },
    { key: "status", header: "Status", hideOnMobile: true, cell: (r) => <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_TONE[r.status] ?? STATUS_TONE.inactive)}>{STUDENT_STATUS_LABEL[r.status] ?? r.status}</span> },
  ];

  const exportQs = new URLSearchParams({ status, ...(classId ? { class: classId } : {}), ...(q ? { q } : {}) }).toString();

  return (
    <>
      <section className="dash-hero mb-6 overflow-hidden rounded-2xl p-6 text-white shadow-pop sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-white/70">Data induk siswa</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Siswa</h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">Perubahan data dicatat dalam jejak audit.</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15"><Users className="h-7 w-7" aria-hidden /></span>
            <p>
              <span className="tabular block text-4xl font-bold leading-none">{(count ?? 0).toLocaleString("id-ID")}</span>
              <span className="mt-1.5 block text-xs text-white/70">siswa {(STUDENT_STATUS_LABEL[status] ?? status).toLowerCase()}{classId || q ? " pada filter ini" : ""}</span>
            </p>
          </div>
        </div>
      </section>

      <div className="mb-4 flex flex-wrap gap-2">
        {isAdmin && <Link href="/students/new" className={`${btn} bg-brand text-white hover:bg-[#2b68bd]`}><Plus className="h-4 w-4" aria-hidden />Tambah siswa</Link>}
        {isAdmin && <Link href="/students/import" className={`${btn} border border-line bg-surface hover:bg-canvas`}><Upload className="h-4 w-4" aria-hidden />Impor</Link>}
        {isAdmin && <Link href="/students/qr-cards" className={`${btn} border border-line bg-surface hover:bg-canvas`}><IdCard className="h-4 w-4" aria-hidden />Kartu QR</Link>}
        {canExport && <a href={`/students/export?${exportQs}&format=xlsx`} className={`${btn} border border-line bg-surface hover:bg-canvas`}><Download className="h-4 w-4" aria-hidden />Ekspor Excel</a>}
      </div>

      <nav aria-label="Saring menurut status" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {statusCounts.map(([k, n]) => {
          const active = status === k;
          return (
            <Link
              key={k}
              href={tabHref(k)}
              aria-current={active ? "true" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                active ? "border-navy bg-navy text-white shadow-card" : "border-line bg-surface text-ink hover:border-brand/40 hover:bg-brand-light/50",
              )}
            >
              {STUDENT_STATUS_LABEL[k] ?? k}
              <span className={cn("tabular rounded-full px-2 py-0.5 text-xs font-semibold", active ? "bg-white/20 text-white" : "bg-canvas text-ink-muted")}>{n}</span>
            </Link>
          );
        })}
      </nav>

      <div className="card overflow-hidden">
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
              rowHref={(r) => `/students/${r.id}`}
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