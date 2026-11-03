"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { setUserRolesAction } from "../actions";

export function RoleEditor({ userId, current, editable }: { userId: string; current: Role[]; editable: Role[] }) {
  const router = useRouter();
  const [sel, setSel] = useState<Role[]>(current);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const save = () => start(async () => {
    setError("");
    try {
      const r = await setUserRolesAction(userId, sel);
      if (r.ok) { toast.success(r.message); router.refresh(); } else setError(r.message ?? "Gagal menyimpan.");
    } catch { setError("Tidak dapat terhubung ke server. Perubahan BELUM tersimpan."); }
  });
  return (
    <div className="space-y-3">
      {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap gap-2">
        {(["super_admin", "school_admin", "principal", "teacher", "operator", "parent"] as Role[]).map((r) => {
          const can = editable.includes(r);
          return (
            <label key={r} className={`flex min-h-11 items-center gap-2 rounded-lg border border-line px-3 text-sm ${can ? "" : "opacity-60"}`}>
              <input type="checkbox" className="h-5 w-5" checked={sel.includes(r)} disabled={!can} onChange={(e) => setSel((p) => (e.target.checked ? [...p, r] : p.filter((x) => x !== r)))} />
              {ROLE_LABEL[r]}
            </label>
          );
        })}
      </div>
      <Button onClick={save} loading={pending}>Simpan peran</Button>
    </div>
  );
}
