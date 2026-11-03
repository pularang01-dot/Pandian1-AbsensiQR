import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, isRole, type Role } from "./roles";

export type SessionUser = {
  id: string;
  email: string | null;
  fullName: string;
  roles: Role[];
  /** Peran utama (prioritas tertinggi) yang dipakai untuk navigasi. */
  role: Role;
};

const PRIORITY: Role[] = ["super_admin", "school_admin", "principal", "teacher", "operator", "parent"];

/** Mengambil pengguna terautentikasi beserta peran aktifnya. Mengembalikan null bila tidak valid/nonaktif. */
export async function getSessionUser(): Promise<SessionUser | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const [{ data: profile }, { data: roleRows }] = await Promise.all([
    supabase.from("profiles").select("full_name, is_active").eq("id", user.id).maybeSingle(),
    supabase.from("user_roles").select("role").eq("user_id", user.id),
  ]);

  if (!profile || !profile.is_active) return null;

  const roles = (roleRows ?? []).map((r) => r.role).filter(isRole);
  if (roles.length === 0) return null;

  const role = PRIORITY.find((r) => roles.includes(r)) ?? roles[0];
  return { id: user.id, email: user.email ?? null, fullName: profile.full_name, roles, role };
}

/** Wajib login. Mengarahkan ke /login bila tidak ada sesi yang valid. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Wajib memiliki salah satu peran. Dipakai di setiap Server Action dan halaman sensitif. */
export async function requireRole(allowed: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.roles.some((r) => allowed.includes(r))) redirect(homePathFor(user.role));
  return user;
}
