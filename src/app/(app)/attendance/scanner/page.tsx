import type { Metadata } from "next";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { PageHeader } from "@/components/ui/page-header";
import { Scanner } from "@/components/attendance/scanner";
import { loadDaySummary } from "@/lib/data/today";
import { loadDayInfo } from "@/lib/data/day-info";
import { NoSessionNotice } from "@/components/attendance/no-session-notice";
import { loadSettings } from "@/lib/data/settings";
import { formatTanggal, todayISO } from "@/lib/utils";

export const metadata: Metadata = { title: "Pemindai QR" };
export const dynamic = "force-dynamic";

export default async function ScannerPage() {
  const user = await requireRole(["super_admin", "school_admin", "teacher", "operator"]);
  const date = todayISO();
  const [day, settings, dayInfo] = await Promise.all([loadDaySummary(date), loadSettings(), loadDayInfo(date)]);
  const autoRecord = settings["attendance.qr_auto_record"] === true;
  const c = day.counts;

  return (
    <>
      <PageHeader
        title="Pemindai QR absensi"
        description={autoRecord ? "Mode cepat aktif: kartu yang terbaca langsung dicatat tanpa konfirmasi. Kehadiran tetap hanya dianggap tercatat setelah server mengonfirmasi penyimpanan." : "Pindai kartu QR, pastikan identitas siswa secara langsung, lalu konfirmasi. Kehadiran hanya tercatat setelah server mengonfirmasi penyimpanan."}
      />
      <NoSessionNotice info={dayInfo} />
      <Scanner
        isAdmin={user.roles.some((r) => ADMIN_ROLES.includes(r))}
        dateLabel={formatTanggal(date)}
        autoRecord={autoRecord}
        scanAllowed={day.isSchoolDay && day.sessionStatus !== "closed"}
        summary={{
          total: day.total, present: c.present, late: c.late, sick: c.sick, permission: c.permission,
          official: c.official_activity, unexcused: c.unexcused, unverified: c.unverified, unrecorded: day.unrecorded,
        }}
      />
    </>
  );
}