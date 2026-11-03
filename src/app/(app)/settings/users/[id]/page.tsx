import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ADMIN_ROLES, ROLES, type Role } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Select } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { ConfirmAction } from "@/components/settings/row-action";
import { asUuid } from "@/lib/data/lookups";
import { one, openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { linkStudentAction, unlinkStudentAction } from "../actions";
import { RoleEditor } from "./role-editor";

export const metadata: Metadata = { title: "Rincian Pengguna" };
export const dynamic = "force-dynamic";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireRole(ADMIN_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const supabase = await createClient();
  const { data: p } = await supabase.from("profiles").select("id, full_name, phone, is_active").eq("id", id).maybeSingle();
  if (!p) notFound();
  const { data: rs } = await supabase.from("user_roles").select("role").eq("user_id", id);
  const roles = (rs ?? []).map((r) => r.role as Role);
  const editable: Role[] = me.roles.includes("super_admin") ? [...ROLES] : ["teacher", "operator", "parent"];
  const locked = roles.some((r) => !editable.includes(r));

  const { data: parent } = await supabase.from("parents").select("id").eq("profile_id", id).maybeSingle();
  const { data: links } = parent
    ? await supabase.from("parent_student_links").select("id, relationship, is_active, students(full_name, nis, student_class_assignments(class_id, end_date, classes(name)))").eq("parent_id", parent.id)
    : { data: [] };
  const { data: studs } = parent ? await supabase.from("students").select("id, nis, full_name").eq("status", "active").order("full_name").limit(1000) : { data: [] };

  return (
    <>
      <PageHeader title={p.full_name} description={`${p.phone ?? "Tanpa telepon"} | ${p.is_active ? "Aktif" : "Nonaktif"}`} />
      <div className="space-y-6">
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Peran</h2>
          {locked && <p className="mb-3 text-sm text-ink-muted">Akun ini memiliki peran di luar wewenang Anda. Hanya Super Admin yang dapat mengubahnya.</p>}
          <RoleEditor userId={p.id} current={roles} editable={locked ? [] : editable} />
        </section>

        {parent && (
          <section className="card p-5">
            <h2 className="mb-3 text-base font-semibold">Siswa yang dihubungkan</h2>
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {(links ?? []).length === 0 && <li className="px-4 py-3 text-sm text-ink-muted">Belum ada siswa terhubung.</li>}
              {(links ?? []).map((l) => {
                const s = one(l.students as unknown as { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] } | { full_name: string; nis: string; student_class_assignments: AssignmentEmbed[] }[] | null);
                return (
                  <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div><p className="text-sm font-medium">{s?.full_name}</p><p className="text-xs text-ink-muted">Kelas {openClassName(s?.student_class_assignments) ?? "-"} | {l.relationship} | {l.is_active ? "Aktif" : "Dinonaktifkan"}</p></div>
                    {l.is_active && <ConfirmAction label="Putuskan" title="Putuskan tautan?" description="Orang tua langsung kehilangan akses ke data siswa ini. Riwayat tautan tetap tersimpan." confirmLabel="Putuskan" danger run={unlinkStudentAction.bind(null, l.id)} />}
                  </li>
                );
              })}
            </ul>
            <SimpleForm action={linkStudentAction} submitLabel="Hubungkan siswa" resetOnSuccess>
              <input type="hidden" name="parent_id" value={parent.id} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Siswa" htmlFor="student_id" required>
                  <Select id="student_id" name="student_id" defaultValue=""><option value="" disabled>Pilih siswa</option>{(studs ?? []).map((s) => <option key={s.id} value={s.id}>{s.full_name} (NIS {s.nis})</option>)}</Select>
                </Field>
                <Field label="Hubungan" htmlFor="relationship" required>
                  <Select id="relationship" name="relationship" defaultValue=""><option value="" disabled>Pilih</option><option value="ayah">Ayah</option><option value="ibu">Ibu</option><option value="wali">Wali</option></Select>
                </Field>
              </div>
            </SimpleForm>
          </section>
        )}
      </div>
    </>
  );
}