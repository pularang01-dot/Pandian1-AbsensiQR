"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { friendlyDbError } from "@/lib/validation/common";

export async function resolveErrorAction(formData: FormData): Promise<void> {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return;
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_app_error", { p_id: id });
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/settings/errors");
  revalidatePath("/dashboard");
}

export async function resolveAllErrorsAction(): Promise<void> {
  await requireRole(["super_admin"]);
  const supabase = await createClient();
  const { error } = await supabase.rpc("resolve_all_app_errors");
  if (error) throw new Error(friendlyDbError(error));
  revalidatePath("/settings/errors");
  revalidatePath("/dashboard");
}