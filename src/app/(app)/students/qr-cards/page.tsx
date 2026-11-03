import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { FilterBar, FilterField } from "@/components/ui/filter-bar";
import { Select } from "@/components/ui/field";
import { QrCard } from "@/components/students/qr-card";
import { PrintButton } from "@/components/ui/print-button";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { one } from "@/lib/data/students";

export const metadata: Metadata = { title: "Cetak Kartu QR" };
export const dynamic = "force-dynamic";

export default async function QrCardsPage({ searchParams }: { searchParams: Promise<{ class?: string }> }) {
  await requireRole(ADMIN_ROLES);
  const sp = await searchParams;
  const supabase = await createClient();
  const year = pickYear(await loadYears());
  const classes = await loadClasses(year?.id);
  const classId = classes.some((c) => c.id === asUuid(sp.class)) ? asUuid(sp.class) : null;

  const { data: school } = await supabase.from("system_settings").select("value").eq("key", "school.name").maybeSingle();
  const schoolName = typeof school?.value === "string" && school.value ? school.value : "SDN PANDIAN 1 SUMENEP";

  let cards: { id: string; name: string; nis: string; className: string | null; token: string | null }[] = [];
  if (classId) {
    const { data } = await supabase
      .from("student_class_assignments")
      .select("students!inner(id, nis, full_name, status), classes(name)")
      .eq("class_id", classId)
      .is("end_date", null)
      .eq("students.status", "active");
    const ids = (data ?? []).map((r) => one(r.students as { id: string } | { id: string }[] | null)?.id).filter(Boolean) as string[];
    const { data: tokens } = ids.length
      ? await supabase.from("student_qr_tokens").select("student_id, token").in("student_id", ids).eq("is_active", true)
      : { data: [] as { student_id: string; token: string }[] };
    const tokenBy = new Map((tokens ?? []).map((t) => [t.student_id, t.token]));
    cards = (data ?? [])
      .map((r) => {
        const st = one(r.students as { id: string; nis: string; full_name: string } | { id: string; nis: string; full_name: string }[] | null);
        return st ? { id: st.id, name: st.full_name, nis: st.nis, className: one(r.classes as { name: string } | { name: string }[] | null)?.name ?? null, token: tokenBy.get(st.id) ?? null } : null;
      })
      .filter((c): c is NonNullable<typeof c> => c !== null)
      .sort((a, b) => a.name.localeCompare(b.name, "id"));
  }

  return (
    <>
      <div className="no-print">
        <PageHeader title="Cetak kartu QR" description="Pilih kelas, lalu cetak. Simpan kartu dengan aman: siapa pun yang memegang kartu dapat dipindai oleh petugas, sehingga kartu hilang sebaiknya diterbitkan ulang." actions={cards.length > 0 ? <PrintButton /> : undefined} />
        <div className="card mb-6">
          <FilterBar action="/students/qr-cards" resetHref="/students/qr-cards">
            <FilterField label="Kelas" htmlFor="class">
              <Select id="class" name="class" defaultValue={classId ?? ""}>
                <option value="">Pilih kelas</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </FilterField>
          </FilterBar>
        </div>
      </div>

      {!classId ? (
        <div className="card no-print"><EmptyState title="Pilih kelas" description="Kartu QR dicetak per kelas agar mudah dibagikan oleh wali kelas." /></div>
      ) : cards.length === 0 ? (
        <div className="card no-print"><EmptyState title="Tidak ada siswa aktif di kelas ini" /></div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 print:grid-cols-3 print:gap-2">
          {cards.map((c) => <QrCard key={c.id} compact token={c.token} name={c.name} nis={c.nis} className={c.className} schoolName={schoolName} />)}
        </div>
      )}
    </>
  );
}
