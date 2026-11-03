"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/modal";
import { cancelOwnPermissionAction } from "@/app/(app)/permissions/actions";

export function CancelRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Batalkan pengajuan</Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        loading={pending}
        tone="danger"
        title="Batalkan pengajuan?"
        description="Pengajuan ini tidak akan ditinjau lagi. Anda dapat mengajukan ulang kapan saja."
        confirmLabel="Ya, batalkan"
        onConfirm={() => start(async () => {
          try {
            const r = await cancelOwnPermissionAction(id);
            if (r.ok) { toast.success(r.message); setOpen(false); router.refresh(); } else toast.error(r.message);
          } catch { toast.error("Tidak dapat terhubung ke server. Pengajuan belum dibatalkan."); }
        })}
      />
    </>
  );
}
