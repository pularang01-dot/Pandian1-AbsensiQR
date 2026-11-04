"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { googleSignInAction, signInAction } from "./actions";
import type { ActionState } from "@/lib/validation/auth";

const initial: ActionState = { ok: false };

export function LoginForm({ next, urlError, googleEnabled }: { next: string; urlError: string | null; googleEnabled: boolean }) {
  const [state, action, pending] = useActionState(signInAction, initial);

  return (
    <div className="space-y-5">
    {urlError && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{urlError}</div>}
    {googleEnabled && (
      <>
        <form action={googleSignInAction}>
          <input type="hidden" name="next" value={next} />
          <Button type="submit" variant="outline" size="lg" className="w-full">Masuk dengan Google</Button>
        </form>
        <div className="flex items-center gap-3 text-xs text-ink-muted" aria-hidden><span className="h-px flex-1 bg-line" />atau<span className="h-px flex-1 bg-line" /></div>
      </>
    )}
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />

      {state.message && !state.ok && (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          {state.message}
        </div>
      )}

      <Field label="Email" htmlFor="email" error={state.fieldErrors?.email} required>
        <Input id="email" name="email" type="email" autoComplete="username" inputMode="email" placeholder="nama@contoh.sch.id" />
      </Field>

      <Field label="Kata sandi" htmlFor="password" error={state.fieldErrors?.password} required>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </Field>

      <div className="flex justify-end">
        <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
          Lupa kata sandi?
        </Link>
      </div>

      <Button type="submit" size="lg" className="w-full" loading={pending}>
        {pending ? "Memproses" : "Masuk"}
      </Button>
    </form>
    </div>
  );
}