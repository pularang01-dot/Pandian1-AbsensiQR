"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import type { ActionState } from "@/lib/validation/common";

/** Tombol tindakan baris dengan konfirmasi. `run` adalah server action yang dibungkus di komponen pemanggil. */
export function ConfirmAction({
  label, title, description, confirmLabel, danger, run,
}: {
  label: string; title: string; description: string; confirmLabel: string; danger?: boolean;
  run: () => Promise<ActionState>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const go = () => start(async () => {
    setError("");
    try {
      const r = await run();
      if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else setError(r.message ?? "Gagal.");
    } catch { setError("Tidak dapat terhubung ke server. Perubahan BELUM tersimpan."); }
  });
  return (
    <>
      <Button variant={danger ? "danger" : "outline"} onClick={() => setOpen(true)}>{label}</Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} description={description}
        footer={<><Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Kembali</Button><Button variant={danger ? "danger" : "primary"} onClick={go} loading={pending}>{confirmLabel}</Button></>}>
        {error && <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{error}</p>}
      </Modal>
    </>
  );
}
