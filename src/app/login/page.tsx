import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "./login-form";

const ERRORS: Record<string, string> = {
  not_registered: "Akun Google ini belum terdaftar atau belum aktif di sistem. Minta administrator sekolah mendaftarkan email Anda terlebih dahulu.",
  google: "Masuk dengan Google gagal. Coba lagi atau gunakan email dan kata sandi.",
};

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const { next, error } = await searchParams;
  return (
    <AuthShell title="Masuk ke akun Anda" description="Gunakan email dan kata sandi yang diberikan oleh sekolah.">
      <LoginForm next={next ?? ""} urlError={error ? ERRORS[error] ?? null : null} googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_LOGIN_ENABLED === "true"} />
    </AuthShell>
  );
}