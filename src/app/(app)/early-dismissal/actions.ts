"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { dismissalReviewSchema, dismissalSchema, handoverSchema } from "@/lib/validation/dismissal";
import { wibToIso } from "@/lib/validation/dispensation";

async function insertRequest(formData: FormData): Promise<ActionState & { id?: string }> {
  const user = await requireRole(["super_admin", "school_admin", "principal", "teacher", "operator", "parent"]);
  const parsed = dismissalSchema.safeParse({
    student_id: formData.get("student_id") ?? "",
    requester_relation: formData.get("requester_relation") ?? "",
    reason: formData.get("reason") ?? "",
    requested_time: formData.get("requested_time") ?? "",
    authorized_pickup_name: formData.get("authorized_pickup_name") ?? "",
    authorized_pickup_relation: formData.get("authorized_pickup_relation") ?? "",
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;
  const supabase = await createClient();
  // Status dan verifikasi dipaksa oleh kebijakan RLS: pemohon tidak dapat menyetujui atau menandai terverifikasi sendiri.
  const { data, error } = await supabase.from("early_dismissal_requests").insert({
    student_id: v.student_id, requested_by: user.id, requester_relation: v.requester_relation, reason: v.reason,
    requested_time: wibToIso(v.requested_time), authorized_pickup_name: v.authorized_pickup_name,
    authorized_pickup_relation: v.authorized_pickup_relation, status: "pending", requester_verified: false,
  }).select("id").single();
  if (error || !data) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/early-dismissal");
  revalidatePath("/parent/early-dismissal");
  return { ok: true, id: data.id };
}

export async function submitDismissalParentAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["parent"]);
  const r = await insertRequest(formData);
  if (!r.ok) return r;
  redirect("/parent/early-dismissal");
}

export async function submitDismissalStaffAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const r = await insertRequest(formData);
  if (!r.ok) return r;
  redirect(`/early-dismissal/${r.id}`);
}

export async function reviewDismissalAction(input: unknown): Promise<ActionState> {
  await requireRole(["super_admin", "school_admin", "principal"]);
  const parsed = dismissalReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_dismissal", {
    p_id: v.id, p_action: v.action, p_note: v.note ?? null,
    p_requester_verified: v.action === "approve", p_verification_note: v.action === "approve" ? v.verification_note : null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/early-dismissal");
  revalidatePath(`/early-dismissal/${v.id}`);
  return { ok: true, message: v.action === "approve" ? "Disetujui. Siswa belum dianggap pulang sampai serah terima dicatat." : "Keputusan tersimpan." };
}

export async function completeHandoverAction(input: unknown): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = handoverSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const v = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_handover", {
    p_request_id: v.request_id, p_outcome: v.outcome, p_actual_name: v.actual_name, p_actual_relation: v.actual_relation,
    p_identity_document: v.identity_document, p_matches_authorized: v.matches_authorized, p_note: v.note ?? null,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/early-dismissal");
  revalidatePath(`/early-dismissal/${v.request_id}`);
  return { ok: true, message: v.outcome === "handed_over" ? "Serah terima dicatat." : "Verifikasi gagal dicatat. Siswa tetap dalam pengawasan sekolah." };
}
