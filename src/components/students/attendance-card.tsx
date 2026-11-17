"use client";

import { GraduationCap, IdCard, School, User } from "lucide-react";
import { useQrDataUrl } from "./qr-card";
import { CARD_TAGLINE, CARD_TITLE } from "@/lib/brand/card";

/**
 * Kartu Kehadiran gaya desain sekolah, ukuran kartu ID standar (85,6 x 54 mm).
 * Seluruh ukuran memakai satuan cqw (persen lebar kartu) sehingga tampilan layar dan hasil cetak identik.
 * Isi QR HANYA token acak; nama, NISN, dan NIS tercetak sebagai teks biasa di kartu.
 */
export function AttendanceCard({
  token, name, nis, nisn, schoolName: rawSchoolName,
}: {
  token: string | null; name: string; nis: string; nisn?: string | null; className?: string | null; schoolName: string;
}) {
  const { url, failed } = useQrDataUrl(token, 360);
  // Hanya pada kartu: angka 1 pada nama sekolah ditampilkan sebagai angka romawi I.
  const schoolName = rawSchoolName.replace(/(Pandian)\s+1\b/i, "$1 I");
  // Ukuran huruf mengikuti lebar teks (huruf kapital lebih lebar), supaya nama sekolah tidak terpotong.
  const letters = schoolName.replace(/[^A-Za-z]/g, "");
  const upperShare = letters.length ? letters.replace(/[^A-Z]/g, "").length / letters.length : 0;
  const em = 0.58 + 0.16 * upperShare; // lebar rata-rata satu karakter, dalam em
  const fit = (avail: number, max: number, min: number) => Math.max(min, Math.min(max, avail / (schoolName.length * em)));
  const titleSize = Number(fit(64, 6.2, 3.2).toFixed(2));
  const nameSize = name.length <= 18 ? 3.3 : name.length <= 36 ? 2.7 : 2.3;
  // Nama panjang dibungkus ke dua baris, bukan dipotong dengan titik-titik.
  const nameWraps = name.length > 18;
  const schoolRowSize = Number(fit(42, 3.1, 1.6).toFixed(2));
  const rows: { label: string; value: string; size: number; Icon: typeof User }[] = [
    { label: "Nama Siswa", value: name, size: nameSize, Icon: User },
    { label: "NISN", value: nisn || "-", size: 3.3, Icon: IdCard },
    { label: "NIS", value: nis, size: 3.3, Icon: GraduationCap },
    { label: "Nama Sekolah", value: schoolName, size: schoolRowSize, Icon: School },
  ];
  const u = (n: number) => `${n}cqw`;

  return (
    <figure
      className="attendance-card relative m-0 overflow-hidden bg-white text-[#0b1f4d]"
      style={{ width: "85.6mm", aspectRatio: "85.6 / 54", containerType: "inline-size", borderRadius: "3.2mm", WebkitPrintColorAdjust: "exact", printColorAdjust: "exact", breakInside: "avoid" }}
      aria-label={`Kartu kehadiran ${name}`}
    >
      {/* Latar: header biru, badan langit, gedung sekolah, dan pita bawah. Tanpa teks. */}
      <svg viewBox="0 0 100 63.08" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <linearGradient id="ac-head" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0a3a9e" /><stop offset="1" stopColor="#0b2a7a" /></linearGradient>
          <linearGradient id="ac-sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f4f8ff" /><stop offset="1" stopColor="#bcd9f7" /></linearGradient>
          <linearGradient id="ac-foot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#0b2a7a" /><stop offset="1" stopColor="#0a3a9e" /></linearGradient>
        </defs>
        <rect width="100" height="63.08" fill="url(#ac-sky)" />
        {/* Awan */}
        <g fill="#ffffff" opacity="0.9"><ellipse cx="88" cy="26" rx="6" ry="2.2" /><ellipse cx="92" cy="24.4" rx="4" ry="2.4" /><ellipse cx="80" cy="30" rx="4.5" ry="1.6" /></g>
        {/* Gedung sekolah */}
        <g>
          <rect x="68" y="34" width="32" height="20" fill="#f3dfb0" />
          <polygon points="66,34 102,34 98,29.5 70,29.5" fill="#d9573c" />
          <rect x="68" y="41" width="32" height="1.2" fill="#d9573c" opacity="0.9" />
          {[71, 78, 85, 92].map((x) => <rect key={`w1${x}`} x={x} y="35.5" width="4" height="3.6" fill="#3d7fd6" stroke="#ffffff" strokeWidth="0.4" />)}
          {[71, 78, 85, 92].map((x) => <rect key={`w2${x}`} x={x} y="44" width="4" height="4.2" fill="#3d7fd6" stroke="#ffffff" strokeWidth="0.4" />)}
          <rect x="82" y="49" width="6" height="5" fill="#e9f1fb" />
        </g>
        {/* Pohon */}
        <g><circle cx="98.5" cy="45" r="4.2" fill="#3a9b57" /><circle cx="97" cy="49" r="3.4" fill="#2f8a4a" /><rect x="98" y="50" width="1" height="5" fill="#6b4a2a" /></g>
        {/* Tiang dan bendera */}
        <rect x="64.6" y="21" width="0.7" height="34" fill="#c7d0dc" />
        <path d="M65.3 21.6 h8.2 v3.4 h-8.2 z" fill="#e63946" /><path d="M65.3 25 h8.2 v3.4 h-8.2 z" fill="#ffffff" stroke="#e5e9f0" strokeWidth="0.15" />
        {/* Header */}
        <path d="M0 0 H100 V13.5 Q100 19.5 92 19.5 H8 Q0 19.5 0 13.5 Z" fill="url(#ac-head)" />
        <path d="M0 0 H34 L24 5.2 H0 Z" fill="#1c5bd6" opacity="0.55" />
        <polygon points="86,0 100,0 100,6.5 92,6.5" fill="#f4b81b" />
        <path d="M23 17.2 Q44 14.6 66 17" stroke="#f4b81b" strokeWidth="0.8" fill="none" strokeLinecap="round" />
        {/* Pita bawah */}
        <path d="M0 55.4 H100 V63.08 H0 Z" fill="url(#ac-foot)" />
        <polygon points="0,63.08 0,57 11,63.08" fill="#f4b81b" />
        <polygon points="0,63.08 0,60 6,63.08" fill="#1c5bd6" opacity="0.7" />
        {/* Buku terbuka */}
        <g transform="translate(88.5 56.4)"><path d="M0 1 Q3 -0.4 5.2 1 V5.6 Q3 4.4 0 5.6 Z" fill="#fff" /><path d="M5.2 1 Q7.4 -0.4 10.4 1 V5.6 Q7.4 4.4 5.2 5.6 Z" fill="#fff" /><path d="M0 5.6 Q3 4.4 5.2 5.6 Q7.4 4.4 10.4 5.6" stroke="#f4b81b" strokeWidth="0.7" fill="none" /></g>
      </svg>

      {/* Lambang sekolah pada lencana putih agar jelas di atas biru */}
      <div className="absolute flex items-center justify-center bg-white shadow-sm" style={{ left: u(3.2), top: u(2.4), width: u(14.6), height: u(14.6), borderRadius: u(2.2) }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Lambang sekolah" style={{ width: u(11.6), height: "auto" }} />
      </div>
      <div className="absolute bg-white/40" style={{ left: u(20.2), top: u(3.6), width: u(0.3), height: u(12) }} />

      <div className="absolute text-white" style={{ left: u(23), top: u(2.4), right: u(3) }}>
        <p style={{ fontSize: u(4.6), fontWeight: 700, lineHeight: 1.15 }}>{CARD_TITLE}</p>
        <p style={{ fontSize: u(titleSize), fontWeight: 800, fontStyle: "italic", lineHeight: 1.1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{schoolName}</p>
      </div>

      {/* QR */}
      <div className="absolute flex items-center justify-center bg-white" style={{ left: u(4), top: u(21.5), width: u(32), height: u(32), borderRadius: u(2.4), border: `${u(0.45)} solid #1c5bd6`, padding: u(1.4) }}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Kode QR absensi ${name}`} style={{ width: "100%", height: "100%" }} />
        ) : (
          <span style={{ fontSize: u(2.4) }} className="text-center text-[#5b6b8a]">{failed ? "QR gagal dibuat" : token ? "Membuat QR" : "QR belum diterbitkan"}</span>
        )}
      </div>

      {/* Data siswa */}
      <div className="absolute" style={{ left: u(40), top: u(21.5), width: u(48), display: "flex", flexDirection: "column", gap: u(0.8) }}>
        {rows.map(({ label, value, size, Icon }) => (
          <div key={label} className="flex items-center bg-white/90" style={{ height: u(label === "Nama Siswa" && nameWraps ? 10.6 : 6.7), borderRadius: u(label === "Nama Siswa" && nameWraps ? 4.2 : 3.4), paddingLeft: u(1.1), paddingRight: u(2) }}>
            <span className="flex shrink-0 items-center justify-center bg-[#1c5bd6] text-white" style={{ width: u(5.2), height: u(5.2), borderRadius: "50%" }}>
              <Icon style={{ width: u(3), height: u(3) }} aria-hidden />
            </span>
            <span className="min-w-0 flex-1" style={{ marginLeft: u(1.6) }}>
              <span className="block font-semibold text-[#1c5bd6]" style={{ fontSize: u(2), lineHeight: 1.1 }}>{label}</span>
              {label === "Nama Siswa" && nameWraps
                ? <span className="block font-bold" style={{ fontSize: u(size), lineHeight: 1.15, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", overflowWrap: "anywhere" }} title={value}>{value}</span>
                : <span className="block truncate font-bold" style={{ fontSize: u(size), lineHeight: 1.15 }} title={value}>{value}</span>}
            </span>
          </div>
        ))}
      </div>

      {/* Semboyan */}
      <p className="absolute text-center italic text-white" style={{ left: u(9), right: u(14), top: u(56.4), fontSize: u(2.6), lineHeight: 1.2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
        &ldquo;{CARD_TAGLINE}&rdquo;
      </p>
    </figure>
  );
}