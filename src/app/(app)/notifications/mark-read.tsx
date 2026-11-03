"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { markNotificationsReadAction } from "@/app/(app)/permissions/actions";

export function MarkAllRead() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button variant="outline" loading={pending} onClick={() => start(async () => {
      try { await markNotificationsReadAction(); router.refresh(); } catch { toast.error("Tidak dapat terhubung ke server."); }
    })}>
      <CheckCheck className="h-4 w-4" aria-hidden />Tandai semua dibaca
    </Button>
  );
}
