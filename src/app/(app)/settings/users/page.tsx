import type { Metadata } from "next";
import Link from "next/link";
import { ADMIN_ROLES, ROLE_LABEL, ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { ConfirmAction } from "@/components/settings/row-action";
import { UserCreateForm } from "@/components/settings/user-create-form";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { createUserAction, resendInviteAction, setUserActiveAction } from "./actions";

export const metadata: Metadata = { title: "Pengguna" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const me = await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const [{ data: profiles }, { data: roles }, { data: studs }] = await Promise.all([
    supabase.from("profiles").select("id, full_name, phone, is_active").order("full_name").limit(500),
    supabase.from("user_roles").select("user_id, role"),
    supabase.from("students").select("id, nis, full_name, student_class_assignments(class_id, end_date, classes(name))").eq("status", "active").order("full_name").limit(1000),
  ]);
  const roleMap = new Map<string, Role[]>();
  for (const r of roles ?? []) roleMap.set(r.user_id, [...(roleMap.get(r.user_id) ?? []), r.role as Role]);
  const isSuper = me.roles.includes("super_admin");
  const creatable = isSuper ? [...ROLES] : ["teacher", "operator", "parent"];
  const students = ((studs ?? []) as unknown as { id: string; nis: string; full_name: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => ({
    id: s.id, label: `${s.full_name} (${openClassName(s.student_class_assignments) ?? "tanpa kelas"}, NIS ${s.nis})`,
  }));

  return (
    <>
      <PageHeader title="Pengguna" description="Akun baru menerima undangan email untuk membuat kata sandi sendiri. Administrator tidak pernah menetapkan kata sandi."
        actions={<Link href="/settings/users/import" className="inline-flex h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-[#2b68bd]">Impor staf</Link>} />
      {!isSuper && <p className="mb-4 rounded-lg bg-canvas px-3.5 py-3 text-sm text-ink-muted">Administrator Sekolah dapat mengelola guru, operator, dan orang tua. Peran administratif dan kepala sekolah hanya dapat diberikan oleh Super Admin.</p>}
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Daftar pengguna ({(profiles ?? []).length})</h2>
          <ul className="divide-y divide-line rounded-lg border border-line">
            {(profiles ?? []).map((p) => {
              const rs = roleMap.get(p.id) ?? [];
              const canManage = p.id !== me.id && rs.every((r) => creatable.includes(r));
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="font-medium"><Link href={`/settings/users/${p.id}`} className="hover:text-brand">{p.full_name}</Link>{p.id === me.id && <span className="ml-2 text-xs text-ink-muted">(Anda)</span>}</p>
                    <p className="text-xs text-ink-muted">{rs.length ? rs.map((r) => ROLE_LABEL[r]).join(", ") : "Belum ada peran"} | {p.is_active ? "Aktif" : "Nonaktif"}</p>
                  </div>
                  {canManage && p.is_active && <ConfirmAction label="Kirim ulang undangan" title={`Kirim ulang undangan ke ${p.full_name}?`} description="Tautan untuk membuat atau mengganti kata sandi dikirim ke email pengguna." confirmLabel="Kirim" run={resendInviteAction.bind(null, p.id)} />}
                  {canManage && (p.is_active
                    ? <ConfirmAction label="Nonaktifkan" title={`Nonaktifkan ${p.full_name}?`} description="Pengguna tidak dapat masuk dan tidak melihat data apa pun. Riwayat tetap tersimpan." confirmLabel="Nonaktifkan" danger run={setUserActiveAction.bind(null, p.id, false)} />
                    : <ConfirmAction label="Aktifkan" title={`Aktifkan ${p.full_name}?`} description="Pengguna dapat masuk sesuai perannya." confirmLabel="Aktifkan" run={setUserActiveAction.bind(null, p.id, true)} />)}
                </li>
              );
            })}
          </ul>
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Buat akun</h2>
          <UserCreateForm action={createUserAction} roles={creatable} students={students} />
        </section>
      </div>
    </>
  );
}