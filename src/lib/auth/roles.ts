export const ROLES = [
  "super_admin",
  "school_admin",
  "principal",
  "teacher",
  "operator",
  "parent",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Super Admin",
  school_admin: "Administrator Sekolah",
  principal: "Kepala Sekolah / Penyetuju",
  teacher: "Guru / Wali Kelas",
  operator: "Operator Absensi",
  parent: "Orang Tua / Wali",
};

/** Peran staf (bukan orang tua). */
export const STAFF_ROLES: Role[] = ["super_admin", "school_admin", "principal", "teacher", "operator"];
export const ADMIN_ROLES: Role[] = ["super_admin", "school_admin"];
/** Peran yang berwenang menyetujui izin, dispensasi, dan pulang lebih awal. */
export const APPROVER_ROLES: Role[] = ["super_admin", "school_admin", "principal"];

/**
 * Peta akses halaman berdasarkan awalan rute. Ini lapisan navigasi/gerbang halaman;
 * keamanan data yang sebenarnya tetap ditegakkan oleh RLS dan pengecekan server.
 */
export const ROUTE_ACCESS: { prefix: string; roles: Role[] }[] = [
  { prefix: "/parent", roles: ["parent"] },
  { prefix: "/settings/backup", roles: ["super_admin"] },
  { prefix: "/settings", roles: ["super_admin", "school_admin"] },
  { prefix: "/students/new", roles: ADMIN_ROLES },
  { prefix: "/students", roles: STAFF_ROLES },
  { prefix: "/classes/promotion", roles: ADMIN_ROLES },
  { prefix: "/classes", roles: STAFF_ROLES },
  { prefix: "/attendance/scanner", roles: ["super_admin", "school_admin", "teacher", "operator"] },
  { prefix: "/attendance", roles: STAFF_ROLES },
  { prefix: "/permissions", roles: STAFF_ROLES },
  { prefix: "/dispensations", roles: STAFF_ROLES },
  { prefix: "/early-dismissal", roles: STAFF_ROLES },
  { prefix: "/reports", roles: ["super_admin", "school_admin", "principal", "teacher"] },
  { prefix: "/dashboard", roles: STAFF_ROLES },
];

export function canAccess(role: Role, pathname: string): boolean {
  const rule = ROUTE_ACCESS.find((r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`));
  return rule ? rule.roles.includes(role) : false;
}

export function homePathFor(role: Role): string {
  return role === "parent" ? "/parent/dashboard" : "/dashboard";
}

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}