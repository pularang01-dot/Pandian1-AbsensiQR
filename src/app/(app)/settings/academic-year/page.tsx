import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { ConfirmAction } from "@/components/settings/row-action";
import { formatTanggal } from "@/lib/utils";
import { createYearAction, yearTransitionAction } from "../actions";

export const metadata: Metadata = { title: "Tahun Ajaran" };
export const dynamic = "force-dynamic";

export default async function AcademicYearPage() {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const { data } = await supabase.from("academic_years").select("id, name, start_date, end_date, is_active, is_archived").order("start_date", { ascending: false });
  return (
    <>
      <PageHeader title="Tahun ajaran" description="Hanya satu tahun ajaran yang aktif. Mengarsipkan tidak menghapus data." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Daftar tahun ajaran</h2>
          {(data ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum ada tahun ajaran.</p> : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(data ?? []).map((y) => (
                <li key={y.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div>
                    <p className="font-medium">{y.name} <span className="ml-1 rounded-full border border-line bg-canvas px-2 py-0.5 text-xs">{y.is_active ? "Aktif" : y.is_archived ? "Diarsipkan" : "Belum aktif"}</span></p>
                    <p className="tabular text-xs text-ink-muted">{formatTanggal(y.start_date, "d MMM yyyy")} s.d. {formatTanggal(y.end_date, "d MMM yyyy")}</p>
                  </div>
                  <div className="flex gap-2">
                    {!y.is_active && !y.is_archived && <ConfirmAction label="Aktifkan" title={`Aktifkan ${y.name}?`} description="Tahun ajaran aktif yang sekarang akan dinonaktifkan." confirmLabel="Aktifkan" run={yearTransitionAction.bind(null, y.id, "activate")} />}
                    {!y.is_active && !y.is_archived && <ConfirmAction label="Arsipkan" title={`Arsipkan ${y.name}?`} description="Tahun ajaran terarsip tidak dapat diaktifkan lagi. Data kelas dan absensi tetap tersimpan." confirmLabel="Arsipkan" danger run={yearTransitionAction.bind(null, y.id, "archive")} />}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Buat tahun ajaran</h2>
          <SimpleForm action={createYearAction} submitLabel="Buat" resetOnSuccess>
            <Field label="Nama" htmlFor="name" required hint="Contoh: 2026/2027"><Input id="name" name="name" /></Field>
            <Field label="Mulai" htmlFor="start_date" required><Input id="start_date" name="start_date" type="date" /></Field>
            <Field label="Selesai" htmlFor="end_date" required><Input id="end_date" name="end_date" type="date" /></Field>
          </SimpleForm>
        </section>
      </div>
    </>
  );
}
