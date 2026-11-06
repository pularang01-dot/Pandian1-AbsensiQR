import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export const BACKUP_STALE_DAYS = 7;
const NOTIFY_EVERY_DAYS = 3;

export type BackupStatus = { lastAt: string | null; ageDays: number | null; stale: boolean };

/** Status cadangan terakhir dari jejak audit. Dipanggil hanya untuk super admin. */
export async function loadBackupStatus(): Promise<BackupStatus> {
  const admin = createAdminClient();
  const { data } = await admin.from("audit_logs").select("created_at").eq("action", "backup_completed").order("created_at", { ascending: false }).limit(1);
  const lastAt = (data?.[0]?.created_at as string | undefined) ?? null;
  const ageDays = lastAt ? Math.floor((Date.now() - new Date(lastAt).getTime()) / 86400000) : null;
  return { lastAt, ageDays, stale: ageDays === null || ageDays >= BACKUP_STALE_DAYS };
}

/** Membuat notifikasi pengingat (maksimal sekali per 3 hari) bila cadangan sudah usang. */
export async function ensureBackupReminder(userId: string, st: BackupStatus) {
  if (!st.stale) return;
  const admin = createAdminClient();
  const since = new Date(Date.now() - NOTIFY_EVERY_DAYS * 86400000).toISOString();
  const { data: recent } = await admin.from("notifications").select("id").eq("user_id", userId).eq("type", "backup_reminder").gte("created_at", since).limit(1);
  if (recent && recent.length > 0) return;
  await admin.from("notifications").insert({
    user_id: userId,
    type: "backup_reminder",
    title: "Waktunya membuat cadangan data",
    body: st.ageDays === null ? "Belum pernah ada cadangan tercatat. Buat cadangan pertama sekarang." : `Cadangan terakhir ${st.ageDays} hari lalu. Buat cadangan baru.`,
    link: "/settings/backup",
  });
}