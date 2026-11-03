"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError, zodFieldErrors, type ActionState } from "@/lib/validation/common";
import { dispensationReviewSchema, dispensationSchema, participationSchema, wibToIso } from "@/lib/validation/dispensation";

export async function createDispensationAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["super_admin", "school_admin", "principal", "teacher"]);
  const parsed = dispensationSchema.safeParse({
    name: formData.get("name") ?? "",
    category: formData.get("category") ?? "",
    location: formData.get("location") ?? "",
    description: formData.get("description") ?? "",
    starts_at: formData.get("starts_at") ?? "",
    ends_at: formData.get("ends_at") ?? "",
    supervisor_id: formData.get("supervisor_id") ?? "",
    student_ids: formData.getAll("student_ids").map(String),
  });
  if (!parsed.success) return { ok: false, fieldErrors: zodFieldErrors(parsed.error) };
  const v = parsed.data;

  const supabase = await createClient();
  // Satu transaksi di database: kegiatan dan seluruh pesertanya tersimpan bersama atau tidak sama sekali.
  const { data, error } = await supabase.rpc("create_dispensation", {
    p_name: v.name, p_category: v.category, p_location: v.location ?? null, p_description: v.description ?? null,
    p_starts: wibToIso(v.starts_at), p_ends: wibToIso(v.ends_at), p_supervisor: v.supervisor_id, p_students: v.student_ids,
  });
  if (error || !data) return { ok: false, message: friendlyDbError(error) };

  revalidatePath("/dispensations");
  redirect(`/dispensations/${data as string}`);
}

export async function reviewDispensationAction(input: unknown): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = dispensationReviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_dispensation", { p_id: parsed.data.id, p_action: parsed.data.action, p_note: parsed.data.note ?? null });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath("/dispensations");
  revalidatePath(`/dispensations/${parsed.data.id}`);
  return { ok: true, message: "Keputusan tersimpan." };
}

export async function confirmParticipationAction(input: unknown): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  const parsed = participationSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_participation", {
    p_dispensation_id: parsed.data.dispensation_id, p_student_id: parsed.data.student_id, p_participated: parsed.data.participated,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/dispensations/${parsed.data.dispensation_id}`);
  revalidatePath("/attendance");
  return { ok: true, message: parsed.data.participated ? "Partisipasi dikonfirmasi dan absensi kegiatan resmi dicatat." : "Siswa ditandai tidak ikut dan perlu ditinjau." };
}

export async function completeDispensationAction(id: string): Promise<ActionState> {
  await requireRole(STAFF_ROLES);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return { ok: false, message: "Data tidak valid." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_dispensation", { p_id: id });
  if (error) return { ok: false, message: friendlyDbError(error) };
  revalidatePath(`/dispensations/${id}`);
  revalidatePath("/dispensations");
  return { ok: true, message: "Kegiatan ditandai selesai. Siswa yang belum dikonfirmasi ditandai perlu ditinjau." };
}
