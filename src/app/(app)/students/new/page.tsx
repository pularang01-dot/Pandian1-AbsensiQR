import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { StudentForm } from "../student-form";

export const metadata: Metadata = { title: "Tambah Siswa" };

export default async function NewStudentPage() {
  await requireRole(ADMIN_ROLES);
  const year = pickYear(await loadYears());
  const classes = await loadClasses(year?.id);
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tambah siswa" description="QR siswa diterbitkan otomatis setelah data disimpan." />
      <StudentForm classes={classes.filter((c) => c.is_active)} cancelHref="/students" />
    </div>
  );
}
