import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { createClient } from "@/lib/supabase/server";
import { ResetPasswordForm } from "./reset-form";

export const metadata: Metadata = { title: "Buat Kata Sandi" };
export const dynamic = "force-dynamic";

export default async function ResetPasswordPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return (
    <AuthShell title="Buat kata sandi baru" description="Gunakan kata sandi yang unik dan belum pernah dipakai di layanan lain.">
      {user ? <ResetPasswordForm /> : (
        <p role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">
          Tautan tidak valid atau sudah kedaluwarsa. <Link href="/forgot-password" className="font-medium underline">Minta tautan baru</Link>.
        </p>
      )}
    </AuthShell>
  );
}
