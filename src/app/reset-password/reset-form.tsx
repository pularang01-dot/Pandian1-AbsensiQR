"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import type { ActionState } from "@/lib/validation/auth";
import { resetPasswordAction } from "./actions";

const initial: ActionState = { ok: false };

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState(resetPasswordAction, initial);
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}
      <Field label="Kata sandi baru" htmlFor="password" error={state.fieldErrors?.password} required hint="Minimal 10 karakter.">
        <PasswordInput id="password" name="password" autoComplete="new-password" />
      </Field>
      <Field label="Ulangi kata sandi" htmlFor="confirm" error={state.fieldErrors?.confirm} required>
        <PasswordInput id="confirm" name="confirm" autoComplete="new-password" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>Simpan kata sandi</Button>
    </form>
  );
}