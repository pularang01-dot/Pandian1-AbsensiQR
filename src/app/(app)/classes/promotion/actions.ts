"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ADMIN_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/validation/common";
import { incrementClassName, parseGrade } from "@/lib/classes/grade";

const uuid = z.string().uuid();

const planSchema = z.object({
  fromYear: uuid,
  toYear: uuid,
  classMap: z.record(uuid, z.union([uuid, z.literal("graduate"), z.literal("")])),
  exceptions: z.array(z.object({
    student_id: uuid,
    action: z.enum(["repeat", "other", "transfer", "inactive", "graduate"]),
    class_id: uuid.optional(),
  })).max(1000),
  deactivateParents: z.boolean(),
});
export type PromotionPlan = z.infer<typeof planSchema>;

export type PromotionResult = {
  ok: boolean;
  message?: string;
  from?: string;
  to?: string;
  promoted?: number;
  repeated?: number;
  graduated?: number;
  transferred?: number;
  inactive?: number;
  otherClass?: number;
  alreadyPlaced?: number;
  untouched?: number;
  parentsToDeactivate?: number;
  errors?: { student: string; message: string }[];
};

async function run(plan: unknown, dry: boolean): Promise<PromotionResult> {
  await requireRole(ADMIN_ROLES);
  const parsed = planSchema.safeParse(plan);
  if (!parsed.success) return { ok: false, message: "Data rencana tidak valid. Muat ulang halaman lalu coba lagi." };
  const p = parsed.data;
  // Kelas yang tidak dipetakan ("") tidak dikirim; basis data memperlakukannya sebagai tidak diproses.
  const classMap = Object.fromEntries(Object.entries(p.classMap).filter(([, v]) => v !== ""));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("promote_students", {
    p_from: p.fromYear, p_to: p.toYear, p_class_map: classMap, p_exceptions: p.exceptions,
    p_deactivate_parents: p.deactivateParents, p_dry: dry,
  });
  if (error) return { ok: false, message: friendlyDbError(error) };
  const d = data as Record<string, unknown> & { errors?: { student: string; message: string }[] };
  return {
    ok: true, from: String(d.from), to: String(d.to),
    promoted: Number(d.promoted), repeated: Number(d.repeated), graduated: Number(d.graduated), transferred: Number(d.transferred),
    inactive: Number(d.inactive), otherClass: Number(d.other_class), alreadyPlaced: Number(d.already_placed), untouched: Number(d.untouched),
    parentsToDeactivate: Number(d.parents_to_deactivate), errors: d.errors ?? [],
  };
}

/** Pemeriksaan penuh tanpa menulis apa pun. */
export async function previewPromotionAction(plan: unknown): Promise<PromotionResult> {
  return run(plan, true);
}

export async function executePromotionAction(plan: unknown, confirm: string): Promise<PromotionResult> {
  if (confirm !== "NAIK") return { ok: false, message: "Ketik NAIK (huruf besar) untuk melanjutkan." };
  const r = await run(plan, false);
  if (r.ok) {
    for (const path of ["/classes", "/students", "/settings/users", "/dashboard", "/attendance"]) revalidatePath(path);
    r.message = "Kenaikan kelas diproses.";
  }
  return r;
}

/** Membuat kelas tahun ajaran tujuan dari kelas tahun asal (tingkat + 1). Kelas yang sudah ada dilewati. Wali kelas tidak disalin. */
export async function createNextYearClassesAction(fromYear: string, toYear: string): Promise<{ ok: boolean; message: string; created?: number; skipped?: string[] }> {
  await requireRole(ADMIN_ROLES);
  if (!uuid.safeParse(fromYear).success || !uuid.safeParse(toYear).success || fromYear === toYear) return { ok: false, message: "Tahun ajaran tidak valid." };
  const supabase = await createClient();
  const { data: ty } = await supabase.from("academic_years").select("id, is_archived").eq("id", toYear).maybeSingle();
  if (!ty || ty.is_archived) return { ok: false, message: "Tahun ajaran tujuan tidak ditemukan atau sudah diarsipkan." };
  const { data: src, error } = await supabase.from("classes").select("name, grade_level").eq("academic_year_id", fromYear).eq("is_active", true);
  if (error) return { ok: false, message: friendlyDbError(error) };
  const { data: existing } = await supabase.from("classes").select("name").eq("academic_year_id", toYear);
  const have = new Set((existing ?? []).map((c) => String(c.name).toLowerCase()));

  const rows: { academic_year_id: string; name: string; grade_level: number; is_active: boolean }[] = [];
  const skipped: string[] = [];
  for (const c of src ?? []) {
    const name = incrementClassName(String(c.name));
    const g = (c.grade_level as number | null) ?? parseGrade(String(c.name));
    if (!name || g === null || g >= 6) { if (g === null || (g < 6 && !name)) skipped.push(`${c.name} (tingkat tidak terbaca, buat manual)`); continue; }
    if (have.has(name.toLowerCase())) continue;
    have.add(name.toLowerCase());
    rows.push({ academic_year_id: toYear, name, grade_level: g + 1, is_active: true });
  }
  if (rows.length === 0) return { ok: true, message: "Tidak ada kelas baru yang perlu dibuat.", created: 0, skipped };
  const { error: insErr } = await supabase.from("classes").insert(rows);
  if (insErr) return { ok: false, message: friendlyDbError(insErr) };
  revalidatePath("/classes");
  revalidatePath("/classes/promotion");
  return { ok: true, message: `${rows.length} kelas dibuat pada tahun ajaran tujuan.`, created: rows.length, skipped };
}