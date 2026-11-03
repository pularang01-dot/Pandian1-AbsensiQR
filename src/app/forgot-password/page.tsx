import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "./forgot-form";

export const metadata: Metadata = { title: "Lupa Kata Sandi" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell title="Pulihkan kata sandi" description="Masukkan email akun Anda. Kami akan mengirim tautan untuk membuat kata sandi baru.">
      <ForgotPasswordForm />
      <p className="mt-6 text-center text-sm text-ink-muted">
        <Link href="/login" className="font-medium text-brand hover:underline">
          Kembali ke halaman masuk
        </Link>
      </p>
    </AuthShell>
  );
}
