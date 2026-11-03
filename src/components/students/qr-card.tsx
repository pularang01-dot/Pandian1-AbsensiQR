"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "@/lib/utils";

/** Menghasilkan data-URL QR di browser. Isi QR HANYA token acak: tanpa nama, NIS, atau data pribadi. */
export function useQrDataUrl(token: string | null, width = 240) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    setFailed(false);
    if (!token) return;
    QRCode.toDataURL(token, { errorCorrectionLevel: "M", margin: 1, width })
      .then((u) => alive && setUrl(u))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [token, width]);
  return { url, failed };
}

export function QrCard({
  token,
  name,
  nis,
  className,
  schoolName,
  compact,
}: {
  token: string | null;
  name: string;
  nis: string;
  className?: string | null;
  schoolName: string;
  compact?: boolean;
}) {
  const { url, failed } = useQrDataUrl(token, compact ? 200 : 280);
  return (
    <figure
      className={cn(
        "qr-card flex flex-col items-center rounded-xl border border-line bg-surface p-4 text-center shadow-card",
        compact ? "w-full break-inside-avoid" : "w-64",
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-navy">{schoolName}</p>
      <div className={cn("my-2 flex items-center justify-center", compact ? "h-32 w-32" : "h-44 w-44")}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={`Kode QR absensi ${name}`} className="h-full w-full" />
        ) : failed ? (
          <span className="text-xs text-danger">QR gagal dibuat</span>
        ) : token ? (
          <span className="text-xs text-ink-muted">Membuat QR</span>
        ) : (
          <span className="text-xs text-ink-muted">QR belum diterbitkan</span>
        )}
      </div>
      <figcaption>
        <p className="text-sm font-semibold leading-tight text-ink">{name}</p>
        <p className="tabular mt-0.5 text-xs text-ink-muted">NIS {nis}{className ? ` | ${className}` : ""}</p>
      </figcaption>
    </figure>
  );
}
