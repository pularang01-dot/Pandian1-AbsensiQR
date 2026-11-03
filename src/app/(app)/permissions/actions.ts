"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { differenceInCalendarDays, parseISO, subDays, addDays } from "date-fns";
import { ADMIN_ROLES, APPROVER_ROLES } from "@/lib/auth/roles";
import { requireRole, requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { DOC_MAX_BYTES, DOC_TYPES, detectDocType, permissionSchema, reviewSchema } from "@/lib/validation/permission";
import { todayISO } from "@/lib/utils";

async function docRequiredDays(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data } = await supabase.from("system_settings").select("value").eq("key", "permission.document_required_for_sick_days").maybeSingle();
  const n = Number(data?.value);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/** Dipakai bersama oleh orang tua (portal) dan staf (pencatatan manual atas nama orang tua). */
async function submit(formData: FormData, mode: "parent" | "staff"): Promise<ActionState> {
  const user = mode === "parent" ? await requireRole(["parent"]) : await requireRole(ADMIN_ROLES);

  const parsed = permissionSchema.safeParse({
    student_id: formData.get("student_id"),
    category: formData.get("category"),
    start_date: formData.get("start_date"),
    end_date: formData.get("end_date"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;

  const today = parseISO(todayISO());
  if (parseISO(v.start_date) < subDays(today, 30)) return { ok: false, fieldErrors: { start_date: "Pengajuan lebih dari 30 hari ke belakang tidak dapat diajukan di sini. Hubungi sekolah." } };
  if (parseISO(v.start_date) > addDays(today, 60)) return { ok: false, fieldErrors: { start_date: "Tanggal terlalu jauh ke depan." } };

  const file = formData.get("document");
  const hasFile = file instanceof File && file.size > 0;
  const days = differenceInCalendarDays(parseISO(v.end_date), parseISO(v.start_date)) + 1;

  const supabase = await createClient();
  const needDoc = mode === "parent" && v.category === "sick" && days > (await docRequiredDays(supabase));
  if (needDoc && !hasFile) return { ok: false, fieldErrors: { document: "Sakit lebih dari beberapa hari memerlukan surat keterangan (PDF/foto)." } };

  let bytes: Uint8Array | null = null;
  let mime: ReturnType<typeof detectDocType> = null;
  if (hasFile) {
    if (file.size > DOC_MAX_BYTES) return { ok: false, fieldErrors: { document: "Ukuran berkas maksimal 5 MB." } };
    bytes = new Uint8Array(await file.arrayBuffer());
    mime = detectDocType(bytes);
    if (!mime) return { ok: false, fieldErrors: { document: "Berkas harus PDF, JPG, atau PNG yang valid." } };
  }

  const id = randomUUID();
  const { error } = await supabase.from("permission_requests").insert({
    id,
    student_id: v.student_id,
    requested_by: user.id,
    category: v.category,
    start_date: v.start_date,
    end_date: v.end_date,
    reason: v.reason,
    entered_manually: mode === "staff",
    status: "pending",
  });
  if (error) return { ok: false, message: friendlyDbError(error) };

  if (bytes && mime) {
    const path = `${id}/${randomUUID()}.${DOC_TYPES[mime]}`;
    const up = await supabase.storage.from("permission-documents").upload(path, bytes, { contentType: mime, upsert: false });
    const ins = up.error ? null : await supabase.from("permission_documents").insert({
      request_id: id, storage_path: path, file_name: (file as File).name.slice(0, 150), mime_type: mime, size_bytes: bytes.byteLength, uploaded_by: user.id,
    });
    if (up.error || ins?.error) {
      // Jangan biarkan pengajuan menggantung tanpa dokumen yang dijanjikan.
      await supabase.from("permission_requests").update({ status: "cancelled" }).eq("id", id);
      return { ok: false, message: "Dokumen gagal diunggah sehingga pengajuan dibatalkan otomatis dan BELUM terkirim. Periksa koneksi lalu kirim ulang." };
    }
  }

  revalidatePath("/permissions");
  revalidatePath("/parent/permissions");
  redirect(mode === "parent" ? "/parent/permissions?sent=1" : `/permissions/${id}`);
}

export async function submitPermissionAction(_prev: ActionState, formData: FormData) { return submit(formData, "parent"); }
export async function recordPermissionManuallyAction(_prev: ActionState, formData: FormData) { return submit(formData, "staff"); }

export async function cancelOwnPermissionAction(requestId: string): Promise<ActionState> {
  await requireRole(["parent"]);
  const supabase = await createClient();
  const { data, error } = await supabase.from("permission_requests").update({ status: "cancelled" }).eq("id", requestId).in("status", ["pending", "under_review", "needs_clarification"]).select("id");
  if (error) return { ok: false, message: friendlyDbError(error) };
  if (!data?.length) return { ok: false, message: "Pengajuan tidak dapat dibatalkan pada status ini." };
  revalidatePath("/parent/permissions");
  return { ok: true, message: "Pengajuan dibatalkan." };
}

export async function reviewPermissionAction(input: unknown): Promise<ActionState> {
  await requireRole(APPROVER_ROLES);
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const supabase = await createClient();
  // Seluruh validasi (siswa aktif, tautan orang tua, konflik, wewenang) dan penerapan absensi terjadi dalam SATU transaksi di database.
  const { error } = await supabase.rpc("review_permission", { p_request_id: parsed.data.request_id, p_action: parsed.data.action, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/permissions");
  revalidatePath(`/permissions/${parsed.data.request_id}`);
  revalidatePath("/dashboard");
  return { ok: true, message: "Keputusan tersimpan." };
}

export async function markNotificationsReadAction(): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
  revalidatePath("/", "layout");
}
