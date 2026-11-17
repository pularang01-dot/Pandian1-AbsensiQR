import { loadSettings, str } from "@/lib/data/settings";

/** Kop surat laporan. Hanya tampil saat dicetak; di layar aplikasi memakai tampilan biasa. */
export async function Letterhead() {
  const s = await loadSettings();
  const name = str(s["school.name"], "SDN PANDIAN I SUMENEP") || "SDN PANDIAN I SUMENEP";
  const address = str(s["school.address"]);
  const phone = str(s["school.phone"]);
  return (
    <div className="mb-4 hidden items-center gap-4 border-b-2 border-ink pb-3 print:flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo.png" alt="" width={64} height={65} loading="eager" className="h-16 w-auto" />
      <div className="leading-tight">
        <p className="text-base font-bold uppercase tracking-wide">{name}</p>
        {address && <p className="text-xs">{address}</p>}
        {phone && <p className="text-xs">Telepon {phone}</p>}
      </div>
    </div>
  );
}