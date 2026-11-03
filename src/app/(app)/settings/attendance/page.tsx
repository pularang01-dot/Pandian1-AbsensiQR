import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { loadSettings, num, nums, str } from "@/lib/data/settings";
import { DAY_LABEL } from "@/lib/validation/settings";
import { saveAttendanceSettingsAction } from "../actions";

export const metadata: Metadata = { title: "Aturan Absensi" };
export const dynamic = "force-dynamic";

export default async function AttendanceSettingsPage() {
  await requireRole(ADMIN_ROLES);
  const s = await loadSettings();
  const days = nums(s["attendance.school_days"], [1, 2, 3, 4, 5]);
  return (
    <div className="max-w-2xl">
      <PageHeader title="Aturan absensi" description="Perubahan berlaku untuk sesi absensi yang dibuat setelahnya. Sesi yang sudah ada tidak diubah." />
      <p className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-3 text-sm text-[#8a5a0e]">Nilai awal (07:00, 07:15, 09:00, Senin sampai Jumat) hanya contoh. Pihak sekolah wajib mengonfirmasi jam dan hari sekolah yang berlaku.</p>
      <section className="card p-5 sm:p-6">
        <SimpleForm action={saveAttendanceSettingsAction}>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Jam masuk" htmlFor="start_time" required><Input id="start_time" name="start_time" type="time" defaultValue={str(s["attendance.start_time"], "07:00")} /></Field>
            <Field label="Batas terlambat" htmlFor="late_after" required hint="Pindai setelah jam ini berstatus Terlambat."><Input id="late_after" name="late_after" type="time" defaultValue={str(s["attendance.late_after"], "07:15")} /></Field>
            <Field label="Jam penutupan" htmlFor="close_time" required hint="Rekonsiliasi baru dapat dilakukan setelah jam ini."><Input id="close_time" name="close_time" type="time" defaultValue={str(s["attendance.close_time"], "09:00")} /></Field>
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium">Hari sekolah</legend>
            <div className="flex flex-wrap gap-3">
              {Object.entries(DAY_LABEL).map(([n, label]) => (
                <label key={n} className="flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm"><input type="checkbox" name="school_days" value={n} defaultChecked={days.includes(Number(n))} className="h-5 w-5" />{label}</label>
              ))}
            </div>
          </fieldset>
          <Field label="Dokumen wajib bila sakit lebih dari (hari)" htmlFor="doc_days" required><Input id="doc_days" name="doc_days" type="number" min={1} max={30} defaultValue={num(s["permission.document_required_for_sick_days"], 3)} /></Field>
        </SimpleForm>
      </section>
    </div>
  );
}
