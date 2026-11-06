import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { SwRegister } from "@/components/pwa/sw-register";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Pandian Smart Attendance", template: "%s | Pandian Smart Attendance" },
  description: "Sistem absensi, perizinan, dan administrasi siswa SDN Pandian 1 Sumenep.",
  applicationName: "Pandian Smart Attendance",
  appleWebApp: { capable: true, title: "Pandian Absensi", statusBarStyle: "default" },
  formatDetection: { telephone: false },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#142B4A",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={inter.variable}>
      <body>
        {children}
        <SwRegister />
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}