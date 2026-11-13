import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle, ArrowRight, CheckCircle2, Clock, FileText, Flag, HelpCircle, Stethoscope, Users, UserX,
} from "lucide-react";
import { STAFF_ROLES, APPROVER_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge, ATTENDANCE_STATUS } from "@/components/ui/status-badge";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { Input, Select } from "@/components/ui/field";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { ClassBars, DistributionDonut, TrendLine } from "@/components/charts/attendance-charts";
import { loadDashboard } from "@/lib/data/dashboard";
import { ensureBackupReminder, loadBackupStatus } from "@/lib/backup/reminder";
import { asDate, asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { formatRate, STATUS_KEYS } from "@/lib/attendance-calc";
import { formatTanggal, formatWaktu, todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

type SP = { date?: string; year?: string; class?: string; status?: string };

function auditLabel(action: string, table: string) {
  const entity: Record<string, string> = {
    students: "data siswa", classes: "kelas", permission_requests: "pengajuan izin", dispensations: "dispensasi",
    early_dismissal_requests: "pulang lebih awal", system_settings: "pengaturan", user_roles: "peran pengguna",
    attendance_records: "absensi", school_calendar: "kalender sekolah", academic_years: "tahun ajaran",
    student_qr_tokens: "kode QR", profiles: "akun pengguna", attendance_sessions: "sesi absensi",
  };
  const verb: Record<string, string> = {
    insert: "Menambah", update: "Mengubah", delete: "Menghapus", correct_attendance: "Mengoreksi",
    reconcile: "Rekonsiliasi", confirm_participation: "Konfirmasi partisipasi",
  };
  const v = verb[action] ?? (action.startsWith("permission_") ? "Meninjau" : action);
  return `${v} ${entity[table] ?? table}`;
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireRole(STAFF_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();

  const date = asDate(sp.date) ?? todayISO();
  const years = await loadYears();
  const year = pickYear(years, asUuid(sp.year));
  const classes = await loadClasses(year?.id);
  const classId = classes.some((c) => c.id === asUuid(sp.class)) ? asUuid(sp.class) : null;
  const statusFilter = (STATUS_KEYS as readonly string[]).includes(sp.status ?? "") ? sp.status! : null;
  const classNames = new Map(classes.map((c) => [c.id, c.name]));
  const isApprover = user.roles.some((r) => APPROVER_ROLES.includes(r));

  const data = await loadDashboard(date, classId, classNames);

  // Pengingat cadangan: hanya super admin. Kegagalan di sini tidak boleh merusak dashboard.
  let backup: Awaited<ReturnType<typeof loadBackupStatus>> | null = null;
  if (user.roles.includes("super_admin")) {
    try {
      backup = await loadBackupStatus();
      await ensureBackupReminder(user.id, backup);
    } catch { backup = null; }
  }

  // Pengingat hari lalu yang belum selesai: siswa belum tercatat dan sesi belum ditutup (administrator dan kepala sekolah).
  // Hanya pengingat; tidak ada yang otomatis menjadi Alpa. Kegagalan di sini tidak boleh merusak dashboard.
  let pendingDays: { day: string; unrecorded: number; total: number }[] = [];
  if (user.roles.some((r) => ["super_admin", "school_admin", "principal"].includes(r))) {
    try {
      const { data: ud, error: ue } = await supabase.rpc("unrecorded_days", { p_days: 14 });
      if (!ue && Array.isArray(ud)) pendingDays = ud as typeof pendingDays;
    } catch { pendingDays = []; }
  }
  const canReconcile = user.roles.some((r) => ["super_admin", "school_admin"].includes(r));
  const yesterdayISO = (() => { const d = new Date(`${todayISO()}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();

  // Peringatan error teknis: hanya super admin. Kegagalan di sini tidak boleh merusak dashboard.
  let openErrors = 0;
  if (user.roles.includes("super_admin")) {
    try {
      const { count } = await supabase.from("app_errors").select("id", { count: "exact", head: true })
        .is("resolved_at", null).gte("last_seen", new Date(Date.now() - 7 * 86400000).toISOString());
      openErrors = count ?? 0;
    } catch { openErrors = 0; }
  }

  let recentQuery = supabase
    .from("attendance_records")
    .select("id, status, checked_in_at, created_at, source, students(full_name), attendance_sessions!inner(session_date)")
    .eq("attendance_sessions.session_date", date)
    .order("created_at", { ascending: false })
    .limit(8);
  if (classId) recentQuery = recentQuery.eq("class_id", classId);
  if (statusFilter) recentQuery = recentQuery.eq("status", statusFilter);

  const [recent, pending, notifs, audits] = await Promise.all([
    recentQuery,
    supabase
      .from("permission_requests")
      .select("id, category, start_date, end_date, status, is_retrospective, students(full_name)")
      .in("status", ["pending", "under_review", "needs_clarification"])
      .order("submitted_at", { ascending: true })
      .limit(5),
    supabase.from("notifications").select("id, title, body, link, is_read, created_at").order("created_at", { ascending: false }).limit(5),
    isApprover
      ? supabase.from("audit_logs").select("id, action, entity_table, created_at").order("created_at", { ascending: false }).limit(6)
      : Promise.resolve({ data: [] as { id: number; action: string; entity_table: string; created_at: string }[] }),
  ]);

  const c = data.counts;
  const donut = STATUS_KEYS.map((k) => ({ key: k, label: ATTENDANCE_STATUS[k].label, value: c[k] }));
  const hasAnyRecord = Object.values(c).some((n) => n > 0);

  const barData = data.byClass.map((r) => ({
    name: r.name,
    hadir: r.counts.present,
    terlambat: r.counts.late,
    tidak_hadir: Math.max(0, r.total - r.counts.present - r.counts.late),
  }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Ringkasan kehadiran ${formatTanggal(date)}${year ? ` | Tahun ajaran ${year.name}` : ""}`}
      />

      {backup?.stale && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <span>
              <span className="font-semibold">Cadangan data perlu diperbarui. </span>
              {backup.ageDays === null ? "Belum pernah ada cadangan tercatat." : `Cadangan terakhir ${backup.ageDays} hari lalu.`}
            </span>
          </p>
          <Link href="/settings/backup" className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Buat cadangan</Link>
        </div>
      )}

      {pendingDays.length > 0 && (
        <section role="status" aria-label="Absensi hari lalu belum selesai" className="mb-6 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
            <span>
              <span className="font-semibold">Ada {pendingDays.length} hari lalu yang absensinya belum selesai.</span>{" "}
              Siswa yang belum tercatat belum dianggap Alpa selama sesi belum ditutup.
            </span>
          </p>
          <ul className="mt-2 divide-y divide-warning/20 text-sm">
            {pendingDays.slice(0, 5).map((d) => (
              <li key={d.day} className="flex flex-col gap-2 py-2 sm:flex-row sm:items-center sm:justify-between">
                <span>
                  <span className="font-medium">{d.day === yesterdayISO ? "Kemarin" : formatTanggal(d.day)}</span>
                  {" "}ada <span className="tabular font-semibold">{d.unrecorded}</span> dari <span className="tabular">{d.total}</span> siswa belum tercatat dan sesi belum ditutup.
                </span>
                <Link href={`/attendance?date=${d.day}`} className="inline-flex h-10 items-center justify-center rounded-lg border border-line bg-surface px-3 text-sm font-medium hover:bg-canvas">{canReconcile ? "Lihat dan rekonsiliasi" : "Lihat"}</Link>
              </li>
            ))}
          </ul>
          {pendingDays.length > 5 && <p className="mt-1 text-xs text-ink-muted">Dan {pendingDays.length - 5} hari lain.</p>}
        </section>
      )}

      {openErrors > 0 && (
        <div role="alert" className="mb-6 flex flex-col gap-3 rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-danger" aria-hidden />
            <span><span className="font-semibold">Ada {openErrors} kesalahan teknis belum ditangani </span>dalam 7 hari terakhir.</span>
          </p>
          <Link href="/settings/errors" className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Lihat</Link>
        </div>
      )}

      <div className="card mb-6">
        <FilterBar action="/dashboard" resetHref="/dashboard">
          <FilterField label="Tanggal" htmlFor="date">
            <Input id="date" name="date" type="date" defaultValue={date} />
          </FilterField>
          <FilterField label="Tahun ajaran" htmlFor="year">
            <Select id="year" name="year" defaultValue={year?.id ?? ""}>
              {years.length === 0 && <option value="">Belum ada</option>}
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : ""}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Kelas" htmlFor="class">
            <Select id="class" name="class" defaultValue={classId ?? ""}>
              <option value="">Semua kelas</option>
              {classes.map((cl) => <option key={cl.id} value={cl.id}>{cl.name}</option>)}
            </Select>
          </FilterField>
          <FilterField label="Status (aktivitas terbaru)" htmlFor="status">
            <Select id="status" name="status" defaultValue={statusFilter ?? ""}>
              <option value="">Semua status</option>
              {STATUS_KEYS.map((k) => <option key={k} value={k}>{ATTENDANCE_STATUS[k].label}</option>)}
            </Select>
          </FilterField>
        </FilterBar>
      </div>

      {data.error && (
        <div className="card mb-6"><ErrorState message="Ringkasan kehadiran belum dapat dimuat. Muat ulang halaman; bila berlanjut, hubungi administrator." /></div>
      )}

      {data.totalStudents === 0 && !data.error ? (
        <div className="card">
          <EmptyState
            icon={Users}
            title="Belum ada data siswa"
            description="Tambahkan tahun ajaran, kelas, dan siswa terlebih dahulu. Statistik kehadiran akan muncul otomatis setelah absensi dicatat."
            action={<Link href="/students" className="inline-flex h-11 items-center rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Kelola siswa</Link>}
          />
        </div>
      ) : (
        <>
          <section aria-label="Statistik kehadiran" className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Siswa aktif" value={data.totalStudents} icon={Users} tone="brand" />
            <StatCard label="Hadir" value={c.present} icon={CheckCircle2} tone="success" helper={`Persentase kehadiran ${formatRate(data.rate)}`} />
            <StatCard label="Terlambat" value={c.late} icon={Clock} tone="warning" />
            <StatCard label="Sakit" value={c.sick} icon={Stethoscope} tone="info" />
            <StatCard label="Izin disetujui" value={c.permission} icon={FileText} tone="info" />
            <StatCard label="Kegiatan resmi sekolah" value={c.official_activity} icon={Flag} tone="neutral" />
            <StatCard label="Alpa" value={c.unexcused} icon={UserX} tone="danger" />
            <StatCard label="Belum diverifikasi" value={c.unverified} icon={HelpCircle} tone="neutral" helper={`${data.unrecorded} siswa belum memiliki catatan`} />
          </section>

          {!data.hasSession && (
            <p role="status" className="mb-6 rounded-lg border border-info/20 bg-info/10 px-4 py-3 text-sm text-info">
              Belum ada sesi absensi pada tanggal ini. Siswa tanpa catatan tidak otomatis dianggap alpa sebelum rekonsiliasi dilakukan.
            </p>
          )}

          <section className="mb-6 grid gap-6 lg:grid-cols-2">
            <div className="card p-5">
              <h2 className="text-base font-semibold">Distribusi kehadiran</h2>
              <p className="mb-2 text-sm text-ink-muted">Catatan pada tanggal terpilih</p>
              {hasAnyRecord ? <DistributionDonut data={donut} /> : <EmptyState title="Belum ada catatan" description="Grafik muncul setelah absensi tercatat." />}
            </div>
            <div className="card p-5">
              <h2 className="text-base font-semibold">Tren kehadiran 14 hari</h2>
              <p className="mb-2 text-sm text-ink-muted">Persentase kehadiran fisik per hari sekolah</p>
              {data.trend.length > 0 ? <TrendLine data={data.trend} /> : <EmptyState title="Belum ada tren" description="Data tren muncul setelah ada hari dengan absensi." />}
            </div>
          </section>

          <section className="card mb-6 p-5">
            <h2 className="text-base font-semibold">Ringkasan per kelas</h2>
            <p className="mb-4 text-sm text-ink-muted">Hadir, terlambat, dan sisanya (belum hadir atau belum tercatat)</p>
            {barData.length > 0 ? (
              <>
                <ClassBars data={barData} />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <caption className="sr-only">Tabel kehadiran per kelas</caption>
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                        <th scope="col" className="py-2 pr-4 font-semibold">Kelas</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold">Siswa</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold">Hadir</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold">Terlambat</th>
                        <th scope="col" className="px-4 py-2 text-right font-semibold">Persentase</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {data.byClass.map((r) => (
                        <tr key={r.id ?? "none"}>
                          <th scope="row" className="py-2.5 pr-4 font-medium">{r.name}</th>
                          <td className="tabular px-4 py-2.5 text-right">{r.total}</td>
                          <td className="tabular px-4 py-2.5 text-right">{r.counts.present}</td>
                          <td className="tabular px-4 py-2.5 text-right">{r.counts.late}</td>
                          <td className="tabular px-4 py-2.5 text-right font-medium">{formatRate(r.rate)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <EmptyState title="Belum ada kelas" description="Buat kelas dan tempatkan siswa agar ringkasan per kelas tersedia." />
            )}
          </section>
        </>
      )}

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">Pengajuan izin menunggu</h2>
            <Link href="/permissions" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Lihat semua<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {(pending.data ?? []).length === 0 ? (
            <EmptyState title="Tidak ada antrean" description="Semua pengajuan izin sudah ditangani." />
          ) : (
            <ul className="divide-y divide-line">
              {(pending.data ?? []).map((p) => {
                const s = (Array.isArray(p.students) ? p.students[0] : p.students) as { full_name: string } | null;
                return (
                  <li key={p.id}>
                    <Link href={`/permissions/${p.id}`} className="flex items-center justify-between gap-3 px-5 py-3 hover:bg-canvas/60">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{s?.full_name ?? "Siswa"}</p>
                        <p className="text-xs text-ink-muted">
                          {p.category === "sick" ? "Sakit" : "Izin"} | {formatTanggal(p.start_date, "d MMM")}{p.end_date !== p.start_date ? ` - ${formatTanggal(p.end_date, "d MMM")}` : ""}
                          {p.is_retrospective ? " | Retroaktif" : ""}
                        </p>
                      </div>
                      <StatusBadge kind="request" status={p.status} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="text-base font-semibold">Aktivitas absensi terbaru</h2>
            <Link href="/attendance" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">Lihat semua<ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
          {(recent.data ?? []).length === 0 ? (
            <EmptyState title="Belum ada aktivitas" description="Catatan absensi terbaru pada tanggal ini akan tampil di sini." />
          ) : (
            <ul className="divide-y divide-line">
              {(recent.data ?? []).map((r) => {
                const s = (Array.isArray(r.students) ? r.students[0] : r.students) as { full_name: string } | null;
                return (
                  <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{s?.full_name ?? "Siswa"}</p>
                      <p className="tabular text-xs text-ink-muted">{r.checked_in_at ? formatWaktu(r.checked_in_at) : formatWaktu(r.created_at)}</p>
                    </div>
                    <StatusBadge status={r.status} />
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="card">
          <div className="border-b border-line px-5 py-4"><h2 className="text-base font-semibold">Notifikasi penting</h2></div>
          {(notifs.data ?? []).length === 0 ? (
            <EmptyState title="Tidak ada notifikasi" />
          ) : (
            <ul className="divide-y divide-line">
              {(notifs.data ?? []).map((n) => (
                <li key={n.id} className="px-5 py-3">
                  {n.link ? <Link href={n.link} className="text-sm font-medium hover:text-brand">{n.title}</Link> : <p className="text-sm font-medium">{n.title}</p>}
                  {n.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-muted">{n.body}</p>}
                  <p className="mt-0.5 text-[11px] text-ink-muted">{formatTanggal(n.created_at, "d MMM yyyy, HH:mm")}{n.is_read ? "" : " | Baru"}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {isApprover && (
          <div className="card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-base font-semibold">Aktivitas administrasi terbaru</h2><Link href="/activity" className="text-sm font-medium text-brand hover:underline">Lihat semua</Link></div>
            {(audits.data ?? []).length === 0 ? (
              <EmptyState title="Belum ada aktivitas" />
            ) : (
              <ul className="divide-y divide-line">
                {(audits.data ?? []).map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-5 py-3">
                    <p className="text-sm">{auditLabel(a.action, a.entity_table)}</p>
                    <p className="tabular shrink-0 text-xs text-ink-muted">{formatTanggal(a.created_at, "d MMM, HH:mm")}</p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </>
  );
}