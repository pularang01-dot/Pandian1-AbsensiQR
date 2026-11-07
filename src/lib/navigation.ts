import {
  LayoutDashboard, Users, School, ScanLine, ClipboardList, FileText, Flag, DoorOpen, BarChart3, Settings,
  Baby, CalendarCheck, UserCheck, type LucideIcon,
} from "lucide-react";
import { STAFF_ROLES, ADMIN_ROLES, type Role } from "@/lib/auth/roles";

export type NavItem = { href: string; label: string; icon: LucideIcon; roles: Role[] };
export type NavGroup = { title: string; items: NavItem[] };

const SCAN_ROLES: Role[] = ["super_admin", "school_admin", "teacher", "operator"];
const REPORT_ROLES: Role[] = ["super_admin", "school_admin", "principal", "teacher"];

export const NAV_GROUPS: NavGroup[] = [
  {
    title: "Utama",
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: STAFF_ROLES },
      { href: "/parent/dashboard", label: "Beranda", icon: LayoutDashboard, roles: ["parent"] },
      { href: "/parent/children", label: "Anak Saya", icon: Baby, roles: ["parent"] },
      { href: "/parent/attendance", label: "Riwayat Kehadiran", icon: CalendarCheck, roles: ["parent"] },
      { href: "/parent/permissions", label: "Izin Saya", icon: FileText, roles: ["parent"] },
      { href: "/parent/early-dismissal", label: "Pulang Lebih Awal", icon: DoorOpen, roles: ["parent"] },
    ],
  },
  {
    title: "Absensi",
    items: [
      { href: "/attendance/class", label: "Absen Kelas", icon: UserCheck, roles: SCAN_ROLES },
      { href: "/attendance/scanner", label: "Pemindai QR", icon: ScanLine, roles: SCAN_ROLES },
      { href: "/attendance", label: "Data Absensi", icon: ClipboardList, roles: STAFF_ROLES },
    ],
  },
  {
    title: "Administrasi",
    items: [
      { href: "/students", label: "Siswa", icon: Users, roles: STAFF_ROLES },
      { href: "/classes", label: "Kelas", icon: School, roles: STAFF_ROLES },
      { href: "/permissions", label: "Izin & Sakit", icon: FileText, roles: STAFF_ROLES },
      { href: "/dispensations", label: "Dispensasi", icon: Flag, roles: STAFF_ROLES },
      { href: "/early-dismissal", label: "Pulang Lebih Awal", icon: DoorOpen, roles: STAFF_ROLES },
    ],
  },
  {
    title: "Laporan",
    items: [{ href: "/reports", label: "Laporan", icon: BarChart3, roles: REPORT_ROLES }],
  },
  {
    title: "Sistem",
    items: [{ href: "/settings", label: "Pengaturan", icon: Settings, roles: ADMIN_ROLES }],
  },
];

export function navForRole(role: Role): NavGroup[] {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.roles.includes(role)) })).filter(
    (g) => g.items.length > 0,
  );
}

/** Item aktif = awalan terpanjang yang cocok, agar /attendance tidak aktif saat di /attendance/scanner. */
export function isActive(href: string, pathname: string, all: NavItem[]) {
  const matches = all.filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const best = matches.sort((a, b) => b.href.length - a.href.length)[0];
  return best?.href === href;
}