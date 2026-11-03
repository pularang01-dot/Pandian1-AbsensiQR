"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { forgotPasswordAction } from "@/app/login/actions";
import type { ActionState } from "@/lib/validation/auth";

const initial: ActionState = { ok: false };

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState(forgotPasswordAction, initial);

  return (
    <form action={action} className="space-y-5" noValidate>
      {state.message && (
        <div
          role={state.ok ? "status" : "alert"}
          className={
            state.ok
              ? "rounded-lg border border-success/20 bg-success/10 px-3.5 py-3 text-sm text-success"
              : "rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger"
          }
        >
          {state.message}
        </div>
      )}
      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" />
      </Field>
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Kirim tautan pemulihan
      </Button>
    </form>
  );
}
