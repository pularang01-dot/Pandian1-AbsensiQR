import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLES, ROLE_LABEL, ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Input, Select } from "@/components/ui/field";
import { ConfirmAction } from "@/components/settings/row-action";
import { UserCreateForm } from "@/components/settings/user-create-form";
import { DeleteAccountsDialog } from "@/components/settings/delete-accounts-dialog";
import { loadAuthInfo } from "@/lib/users/auth-info";
import { formatTanggal } from "@/lib/utils";
import { asUuid, loadYears, pickYear } from "@/lib/data/lookups";
import { one, openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { createUserAction, resendInviteAction, setUserActiveAction } from "./actions";

export const metadata: Metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

type GroupKey = "admin" | "teacher" | "operator" | "parent" | "none";
const GROUPS: { key: GroupKey; tab: string; title: string; hint: string }[] = [
  { key: "admin", tab: "admin", title: "Pimpinan dan administrator", hint: "Super Admin, Administrator Sekolah, Kepala Sekolah." },
  { key: "teacher", tab: "guru", title: "Wali kelas dan guru", hint: "Wali kelas hanya melihat dan mencatat absensi siswa kelasnya." },
  { key: "operator", tab: "operator", title: "Operator absensi", hint: "Membantu pencatatan absensi. Tidak memutuskan izin." },
  { key: "parent", tab: "ortu", title: "Orang tua dan wali murid", hint: "Hanya melihat anak yang tautannya aktif." },
  { key: "none", tab: "tanpa-peran", title: "Belum memiliki peran", hint: "Akun ini belum dapat memakai aplikasi. Beri peran atau nonaktifkan." },
];

function primaryGroup(rs: Role[]): GroupKey {
  if (rs.some((r) => r === "super_admin" || r === "school_admin" || r === "principal")) return "admin";
  if (rs.includes("teacher")) return "teacher";
  if (rs.includes("operator")) return "operator";
  if (rs.includes("parent")) return "parent";
  return "none";
}

type Sp = { year?: string; tab?: string; q?: string; status?: string; login?: string };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Sp> }) {
  const me = await requireRole(ADMIN_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const years = await loadYears();
  const year = pickYear(years, asUuid(sp.year));
  const tab = GROUPS.find((g) => g.tab === sp.tab)?.key ?? null;
  const q = (sp.q ?? "").trim().toLowerCase().slice(0, 80);
  const status = sp.status === "aktif" || sp.status === "nonaktif" ? sp.status : "";
  const loginFilter = sp.login === "belum" ? "belum" : "";

  const authInfo = await loadAuthInfo();
  const [{ data: profiles }, { data: roles }, { data: studs }, classesRes, parentsRes, linksRes, asgRes, totalsRes] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, is_active").order("full_name").limit(1000),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("students").select("id, nis, full_name, student_class_assignments(class_id, end_date, classes(name))").eq("status", "active").order("full_name").limit(1000),
    supabase.from("classes").select("id, name, academic_year_id, homeroom_teacher_id, is_active, academic_years(name)").not("homeroom_teacher_id", "is", null),
    supabase.from("parents").select("id, profile_id"),
    supabase.from("parent_student_links").select("parent_id, student_id, relationship, is_active"),
    year ? supabase.from("student_class_assignments").select("student_id, classes(name)").eq("academic_year_id", year.id).is("end_date", null).limit(5000) : Promise.resolve({ data: [] }),
    supabase.rpc("active_students_by_class"),
  ]);

  const roleMap = new Map<string, Role[]>();
  for (const r of roles ?? []) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as Role]);
  const isSuper = me.roles.includes("super_admin");
  const creatable = isSuper ? [...ROLES] : ["teacher", "operator", "parent"];

  // ---- data pendukung wali kelas
  type Cls = { id: string; name: string; academic_year_id: string; homeroom_teacher_id: string; is_active: boolean; academic_years: { name: string } | { name: string }[] | null };
  const count = new Map<string, number>();
  for (const r of (totalsRes.data ?? []) as { class_id: string | null; total: number | string }[]) if (r.class_id) count.set(r.class_id, Number(r.total));
  const classesByTeacher = new Map<string, Cls[]>();
  for (const c of (classesRes.data ?? []) as unknown as Cls[]) classesByTeacher.set(c.homeroom_teacher_id, [...(classesByTeacher.get(c.homeroom_teacher_id) ?? []), c]);

  // ---- data pendukung orang tua
  const parentByProfile = new Map<string, string>();
  for (const p of (parentsRes.data ?? []) as { id: string; profile_id: string }[]) parentByProfile.set(p.profile_id, p.id);
  const studentInfo = new Map<string, { name: string; nis: string }>();
  for (const s of (studs ?? []) as unknown as { id: string; nis: string; full_name: string }[]) studentInfo.set(s.id, { name: s.full_name, nis: s.nis });
  const classInYear = new Map<string, string>();
  for (const a of (asgRes.data ?? []) as unknown as { student_id: string; classes: { name: string } | { name: string }[] | null }[]) {
    const n = one(a.classes)?.name;
    if (n) classInYear.set(a.student_id, n);
  }
  const linksByParent = new Map<string, { student_id: string; relationship: string; is_active: boolean }[]>();
  for (const l of (linksRes.data ?? []) as { parent_id: string; student_id: string; relationship: string; is_active: boolean }[]) linksByParent.set(l.parent_id, [...(linksByParent.get(l.parent_id) ?? []), l]);

  // ---- susun daftar
  const all = (profiles ?? []).map((p) => {
    const rs = roleMap.get(p.id) ?? [];
    return { ...p, roles: rs, group: primaryGroup(rs) };
  });
  const matches = (p: (typeof all)[number]) => (!status || (status === "aktif") === p.is_active) && (!loginFilter || (authInfo.size > 0 && !authInfo.get(p.id)?.lastSignIn)) && (!q || p.full_name.toLowerCase().includes(q) || (p.phone ?? "").toLowerCase().includes(q));
  const shown = all.filter(matches);
  const countOf = (g: GroupKey) => all.filter((p) => p.group === g).length;

  // ---- perlu perhatian (hanya akun aktif, tahun ajaran terpilih)
  const attention: { text: string; href?: string }[] = [];
  const teachersActive = all.filter((p) => p.group === "teacher" && p.is_active);
  const idle = teachersActive.filter((p) => !(classesByTeacher.get(p.id) ?? []).some((c) => c.academic_year_id === year?.id));
  if (year && idle.length) attention.push({ text: `${idle.length} guru aktif belum memegang kelas pada tahun ajaran ${year.name}: ${idle.slice(0, 4).map((p) => p.full_name).join(", ")}${idle.length > 4 ? ", dan lainnya" : ""}.`, href: "/classes" });
  const heldByInactive = [...classesByTeacher.entries()].filter(([uid, cs]) => !all.find((p) => p.id === uid)?.is_active && cs.some((c) => c.is_active && c.academic_year_id === year?.id));
  if (heldByInactive.length) attention.push({ text: `${heldByInactive.length} akun nonaktif masih tercatat sebagai wali kelas. Tetapkan penggantinya.`, href: "/classes" });
  const parentsNoChild = all.filter((p) => p.group === "parent" && p.is_active && !(linksByParent.get(parentByProfile.get(p.id) ?? "") ?? []).some((l) => l.is_active));
  if (parentsNoChild.length) attention.push({ text: `${parentsNoChild.length} akun orang tua aktif belum terhubung ke siswa mana pun (tidak melihat data apa pun).` });
  const noRole = all.filter((p) => p.group === "none" && p.is_active);
  if (noRole.length) attention.push({ text: `${noRole.length} akun aktif belum memiliki peran.`, href: "/settings/users?tab=tanpa-peran" });

  // Akun aktif yang belum pernah masuk lebih dari 14 hari sejak dibuat (undangan tidak diterima / akun tidak terpakai).
  const STALE_DAYS = 14;
  const staleCutoff = Date.now() - STALE_DAYS * 86400000;
  const stale = authInfo.size === 0 ? [] : all.filter((p) => {
    const a = authInfo.get(p.id);
    return p.is_active && p.id !== me.id && !p.roles.includes("super_admin") && a && !a.lastSignIn && a.createdAt && new Date(a.createdAt).getTime() < staleCutoff;
  });
  if (stale.length) attention.push({ text: `${stale.length} akun aktif belum pernah masuk lebih dari ${STALE_DAYS} hari sejak dibuat (undangan belum diterima atau akun tidak terpakai): ${stale.slice(0, 3).map((p) => p.full_name).join(", ")}${stale.length > 3 ? ", dan lainnya" : ""}.`, href: "/settings/users?login=belum" });

  const students = ((studs ?? []) as unknown as { id: string; nis: string; full_name: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => ({
    id: s.id, label: `${s.full_name} (${openClassName(s.student_class_assignments) ?? "tanpa kelas"}, NIS ${s.nis})`,
  }));

  const href = (t: string | null) => {
    const u = new URLSearchParams();
    if (year) u.set("year", year.id);
    if (t) u.set("tab", t);
    if (q) u.set("q", q);
    if (status) u.set("status", status);
    if (loginFilter) u.set("login", loginFilter);
    return `/settings/users?${u.toString()}`;
  };

  function detail(p: (typeof all)[number]) {
    const other = p.roles.length > 1 ? <p className="text-xs text-ink-muted">Peran: {p.roles.map((r) => ROLE_LABEL[r]).join(", ")}</p> : null;
    if (p.group === "teacher") {
      const cs = classesByTeacher.get(p.id) ?? [];
      const mine = cs.filter((c) => c.academic_year_id === year?.id);
      const others = cs.filter((c) => c.academic_year_id !== year?.id);
      return (
        <>
          {mine.length > 0
            ? <p className="text-xs">{mine.map((c) => <Link key={c.id} href={`/classes/${c.id}`} className="mr-3 font-medium hover:text-brand">Wali kelas {c.name} <span className="font-normal text-ink-muted">| {year?.name} | {count.get(c.id) ?? 0} siswa aktif{c.is_active ? "" : " | kelas nonaktif"}</span></Link>)}</p>
            : <p className="text-xs text-[#8a5a0e]">Belum memegang kelas pada tahun ajaran {year?.name ?? "-"} (guru mata pelajaran atau belum ditempatkan).</p>}
          {others.length > 0 && <p className="text-xs text-ink-muted">Tahun lain: {others.map((c) => `${c.name} (${one(c.academic_years)?.name ?? "-"})`).join(", ")}</p>}
          {other}
        </>
      );
    }
    if (p.group === "parent") {
      const pid = parentByProfile.get(p.id);
      const ls = pid ? linksByParent.get(pid) ?? [] : [];
      return (
        <>
          {ls.length === 0
            ? <p className="text-xs text-[#8a5a0e]">Belum terhubung ke siswa. Buka rincian untuk menghubungkan.</p>
            : <ul className="text-xs">{ls.map((l) => {
                const s = studentInfo.get(l.student_id);
                const k = classInYear.get(l.student_id);
                return <li key={l.student_id} className={l.is_active ? "" : "text-ink-muted"}><span className="font-medium">{s?.name ?? "Siswa"}</span> <span className="text-ink-muted">| NIS {s?.nis ?? "-"} | {l.relationship} | {k ? `Kelas ${k} (${year?.name})` : `Tanpa kelas pada ${year?.name ?? "-"}`}{l.is_active ? "" : " | tautan nonaktif"}</span></li>;
              })}</ul>}
          {other}
        </>
      );
    }
    return <>{p.roles.length > 0 && <p className="text-xs text-ink-muted">{p.roles.map((r) => ROLE_LABEL[r]).join(", ")}</p>}</>;
  }

  function row(p: (typeof all)[number]) {
    const canManage = p.id !== me.id && p.roles.every((r) => creatable.includes(r));
    return (
      <li key={p.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0 space-y-0.5">
          <p className="font-medium"><Link href={`/settings/users/${p.id}`} className="hover:text-brand">{p.full_name}</Link>{p.id === me.id && <span className="ml-2 text-xs text-ink-muted">(Anda)</span>}</p>
          <p className="text-xs text-ink-muted">{authInfo.get(p.id)?.email ?? "Email tidak tersedia"} | {p.phone ?? "Tanpa telepon"} | {p.is_active ? "Aktif" : "Nonaktif"}</p>
          {authInfo.size > 0 && <p className="text-xs text-ink-muted">{authInfo.get(p.id)?.lastSignIn ? `Terakhir masuk ${formatTanggal(authInfo.get(p.id)!.lastSignIn!, "d MMM yyyy, HH:mm")}` : <span className="font-medium text-[#8a5a0e]">Belum pernah masuk{authInfo.get(p.id)?.createdAt ? ` (dibuat ${formatTanggal(authInfo.get(p.id)!.createdAt!, "d MMM yyyy")})` : ""}</span>}</p>}
          {detail(p)}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canManage && p.is_active && <ConfirmAction label="Kirim ulang undangan" title={`Kirim ulang undangan ke ${p.full_name}?`} description="Tautan untuk membuat atau mengganti kata sandi dikirim ke email pengguna." confirmLabel="Kirim" run={resendInviteAction.bind(null, p.id)} />}
          {canManage && (p.is_active
            ? <ConfirmAction label="Nonaktifkan" title={`Nonaktifkan ${p.full_name}?`} description={p.group === "teacher" ? "Pengguna tidak dapat masuk. Kelas yang ia pegang dikosongkan otomatis dan perlu wali pengganti. Riwayat tetap tersimpan." : "Pengguna tidak dapat masuk dan tidak melihat data apa pun. Riwayat tetap tersimpan."} confirmLabel="Nonaktifkan" danger run={setUserActiveAction.bind(null, p.id, false)} />
            : <ConfirmAction label="Aktifkan" title={`Aktifkan ${p.full_name}?`} description="Pengguna dapat masuk sesuai perannya. Wali kelas yang dikosongkan sebelumnya tidak dipulihkan otomatis." confirmLabel="Aktifkan" run={setUserActiveAction.bind(null, p.id, true)} />)}
          {isSuper && p.id !== me.id && !p.roles.includes("super_admin") && <DeleteAccountsDialog ids={[p.id]} subject={`akun ${p.full_name}`} buttonLabel="Hapus akun" />}
        </div>
      </li>
    );
  }

  const visibleGroups = GROUPS.filter((g) => (tab ? g.key === tab : true));

  return (
    <>
      <PageHeader title="Pengguna" description="Akun staf dan orang tua, dikelompokkan menurut peran. Akun baru menerima undangan email atau masuk dengan Google; administrator tidak pernah menetapkan kata sandi."
        actions={<Link href="/settings/users/import" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Impor staf</Link>} />
      {!isSuper && <p className="mb-4 rounded-lg bg-canvas px-3.5 py-3 text-sm text-ink-muted">Administrator Sekolah dapat mengelola guru, operator, dan orang tua. Peran administratif dan kepala sekolah hanya dapat diberikan oleh Super Admin.</p>}

      {attention.length > 0 && (
        <div role="note" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#8a5a0e]">
          <p className="font-medium">Perlu perhatian</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">{attention.map((a, i) => <li key={i}>{a.text}{a.href && <> <Link href={a.href} className="font-medium underline">Buka</Link></>}</li>)}</ul>
          {isSuper && stale.length > 0 && <div className="mt-3"><DeleteAccountsDialog ids={stale.map((p) => p.id)} subject={`${stale.length} akun yang belum pernah masuk`} buttonLabel={`Bersihkan ${stale.length} akun tidak terpakai`} size="md" /></div>}
        </div>
      )}

      <nav aria-label="Kelompok pengguna" className="mb-4 flex flex-wrap gap-2">
        <Link href={href(null)} aria-current={tab ? undefined : "page"} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab ? "border-line bg-surface hover:bg-canvas" : "border-brand bg-brand-light text-brand"}`}>Semua <span className="tabular text-xs">({all.length})</span></Link>
        {GROUPS.filter((g) => g.key !== "none" || countOf("none") > 0).map((g) => (
          <Link key={g.key} href={href(g.tab)} aria-current={tab === g.key ? "page" : undefined} className={`rounded-lg border px-3 py-2 text-sm font-medium ${tab === g.key ? "border-brand bg-brand-light text-brand" : "border-line bg-surface hover:bg-canvas"}`}>{g.title.split(" dan ")[0]} <span className="tabular text-xs">({countOf(g.key)})</span></Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="card"><FilterBar action="/settings/users" resetHref="/settings/users">
            {tab && <input type="hidden" name="tab" value={GROUPS.find((g) => g.key === tab)?.tab} />}
            <FilterField label="Tahun ajaran (kelas dan anak)" htmlFor="year">
              <Select id="year" name="year" defaultValue={year?.id ?? ""}>{years.map((y) => <option key={y.id} value={y.id}>{y.name}{y.is_active ? " (aktif)" : y.is_archived ? " (arsip)" : ""}</option>)}</Select>
            </FilterField>
            <FilterField label="Cari nama atau telepon" htmlFor="q" grow><Input id="q" name="q" defaultValue={q} placeholder="Nama pengguna" /></FilterField>
            <FilterField label="Status" htmlFor="status">
              <Select id="status" name="status" defaultValue={status}><option value="">Semua</option><option value="aktif">Aktif</option><option value="nonaktif">Nonaktif</option></Select>
            </FilterField>
            <FilterField label="Riwayat masuk" htmlFor="login">
              <Select id="login" name="login" defaultValue={loginFilter}><option value="">Semua</option><option value="belum">Belum pernah masuk</option></Select>
            </FilterField>
          </FilterBar></div>
          {year && <p className="text-xs text-ink-muted">Informasi kelas dan anak ditampilkan untuk tahun ajaran <span className="font-medium text-ink">{year.name}</span>{year.is_active ? " (aktif)" : ""}.</p>}

          {visibleGroups.map((g) => {
            const list = shown.filter((p) => p.group === g.key);
            if (g.key === "none" && list.length === 0) return null;
            return (
              <section key={g.key} className="card p-5" aria-labelledby={`grp-${g.key}`}>
                <h2 id={`grp-${g.key}`} className="text-base font-semibold">{g.title} <span className="tabular text-sm font-normal text-ink-muted">({list.length})</span></h2>
                <p className="mb-3 text-xs text-ink-muted">{g.hint}</p>
                {list.length === 0
                  ? <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">Tidak ada pengguna pada kelompok ini{q || status ? " untuk filter yang dipilih" : ""}.</p>
                  : <ul className="divide-y divide-line rounded-lg border border-line">{list.map(row)}</ul>}
              </section>
            );
          })}
        </div>
        <section className="card h-fit p-5">
          <h2 className="mb-3 text-base font-semibold">Buat akun</h2>
          <UserCreateForm action={createUserAction} roles={creatable} students={students} />
        </section>
      </div>
    </>
  );
}