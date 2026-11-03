"use client";

import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { ActionState } from "@/lib/validation/common";

const initial: ActionState = { ok: false };

/** Formulir pengaturan sederhana: kolom tidak terkendali (name=...), galat dirangkum di atas formulir. */
export function SimpleForm({
  action, submitLabel = "Simpan", children, resetOnSuccess = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  submitLabel?: string;
  children: ReactNode;
  resetOnSuccess?: boolean;
}) {
  const [state, run, pending] = useActionState(action, initial);
  useEffect(() => { if (state.ok && state.message) toast.success(state.message); }, [state]);
  const errors = Object.values(state.fieldErrors ?? {});

  return (
    <form action={run} key={resetOnSuccess && state.ok ? "done" : "form"} className="space-y-4" noValidate>
      {(state.message && !state.ok) || errors.length > 0 ? (
        <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          {state.message && !state.ok && <p>{state.message}</p>}
          {errors.length > 0 && <ul className="list-disc pl-5">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
        </div>
      ) : null}
      {children}
      <div className="flex justify-end"><Button type="submit" loading={pending}>{submitLabel}</Button></div>
    </form>
  );
}
