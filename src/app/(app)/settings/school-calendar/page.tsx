import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input, Select } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { ConfirmAction } from "@/components/settings/row-action";
import { CALENDAR_KIND_LABEL } from "@/lib/validation/settings";
import { formatTanggal, todayISO } from "@/lib/utils";
import { addCalendarAction, deleteCalendarAction } from "../actions";

export const metadata: Metadata = { title: "Kalender Sekolah" };
export const dynamic = "force-dynamic";

export default async function SchoolCalendarPage() {
  await requireRole(ADMIN_ROLES);
  const supabase = await createClient();
  const from = `${Number(todayISO().slice(0, 4)) - 1}-01-01`;
  const { data } = await supabase.from("school_calendar").select("id, calendar_date, kind, description").gte("calendar_date", from).order("calendar_date", { ascending: false }).limit(300);
  return (
    <>
      <PageHeader title="Kalender sekolah" description="Hari libur dilewati saat persetujuan izin dan tidak memiliki sesi absensi. Hari sekolah tambahan berlaku walau di luar hari sekolah biasa." />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="card p-5 lg:col-span-2">
          <h2 className="mb-3 text-base font-semibold">Entri kalender</h2>
          {(data ?? []).length === 0 ? <p className="text-sm text-ink-muted">Belum ada entri.</p> : (
            <ul className="divide-y divide-line rounded-lg border border-line">
              {(data ?? []).map((e) => (
                <li key={e.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <div><p className="tabular text-sm font-medium">{formatTanggal(e.calendar_date)}</p><p className="text-xs text-ink-muted">{CALENDAR_KIND_LABEL[e.kind]} | {e.description}</p></div>
                  <ConfirmAction label="Hapus" title="Hapus entri kalender?" description="Catatan absensi yang sudah ada tidak berubah." confirmLabel="Hapus" danger run={deleteCalendarAction.bind(null, e.id)} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-5">
          <h2 className="mb-3 text-base font-semibold">Tambah entri</h2>
          <SimpleForm action={addCalendarAction} submitLabel="Tambah" resetOnSuccess>
            <Field label="Tanggal" htmlFor="calendar_date" required><Input id="calendar_date" name="calendar_date" type="date" /></Field>
            <Field label="Jenis" htmlFor="kind" required>
              <Select id="kind" name="kind" defaultValue="holiday">{Object.entries(CALENDAR_KIND_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            </Field>
            <Field label="Keterangan" htmlFor="description" required><Input id="description" name="description" maxLength={200} /></Field>
          </SimpleForm>
        </section>
      </div>
    </>
  );
}
