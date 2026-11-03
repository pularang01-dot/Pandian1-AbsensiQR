import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Scanner } from "@/components/attendance/scanner";
import { loadDaySummary } from "@/lib/data/today";
import { formatTanggal, todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Pemindai QR" };
export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const user = await requireRole(["super_admin", "school_admin", "teacher", "operator"]);
  const date = todayISO();
  const day = await loadDaySummary(date);
  const c = day.counts;

  return (
    <>
      <PageHeader
        title="Pemindai QR absensi"
        description="Pindai kartu QR, pastikan identitas siswa secara langsung, lalu konfirmasi. Kehadiran hanya tercatat setelah server mengonfirmasi penyimpanan."
      />
      <Scanner
        isAdmin={user.roles.some((r) => ADMIN_ROLES.includes(r))}
        dateLabel={formatTanggal(date)}
        scanAllowed={day.isSchoolDay && day.sessionStatus !== "closed"}
        summary={{
          total: day.total, present: c.present, late: c.late, sick: c.sick, permission: c.permission,
          official: c.official_activity, unexcused: c.unexcused, unverified: c.unverified, unrecorded: day.unrecorded,
        }}
      />
    </>
  );
}
