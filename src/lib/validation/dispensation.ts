import { z } from "zod";

export const DISPENSATION_CATEGORY: Record<string, string> = {
  lomba_akademik: "Lomba akademik",
  lomba_olahraga: "Lomba olahraga",
  budaya: "Kegiatan budaya",
  delegasi_sekolah: "Delegasi resmi sekolah",
  lainnya: "Kegiatan resmi lainnya",
};

export const PARTICIPATION_LABEL: Record<string, string> = {
  unconfirmed: "Belum dikonfirmasi",
  participated: "Ikut serta",
  not_participated: "Tidak ikut",
};

/** Input datetime-local dibaca sebagai waktu sekolah (WIB, UTC+7) agar tidak bergantung zona waktu perangkat. */
export function wibToIso(local: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const iso = `${local}:00+07:00`;
  return Number.isNaN(Date.parse(iso)) ? null : iso;
}

export const dispensationSchema = z
  .object({
    name: z.string().trim().min(3, "Nama kegiatan minimal 3 karakter.").max(200, "Nama kegiatan maksimal 200 karakter."),
    category: z.enum(["lomba_akademik", "lomba_olahraga", "budaya", "delegasi_sekolah", "lainnya"], { errorMap: () => ({ message: "Pilih kategori." }) }),
    location: z.string().trim().max(200, "Lokasi maksimal 200 karakter.").optional(),
    description: z.string().trim().max(1000, "Deskripsi maksimal 1000 karakter.").optional(),
    starts_at: z.string().refine((v) => wibToIso(v) !== null, "Waktu mulai tidak valid."),
    ends_at: z.string().refine((v) => wibToIso(v) !== null, "Waktu selesai tidak valid."),
    supervisor_id: z.string().uuid("Pilih guru pendamping."),
    student_ids: z.array(z.string().uuid()).min(1, "Pilih minimal satu siswa peserta.").max(200, "Maksimal 200 siswa."),
  })
  .refine((v) => (wibToIso(v.ends_at) ?? "") >= (wibToIso(v.starts_at) ?? ""), { path: ["ends_at"], message: "Waktu selesai tidak boleh sebelum waktu mulai." });

export const dispensationReviewSchema = z.object({
  id: z.string().uuid(),
  action: z.enum(["approve", "reject", "cancel"]),
  note: z.string().trim().max(500).optional(),
});

export const participationSchema = z.object({
  dispensation_id: z.string().uuid(),
  student_id: z.string().uuid(),
  participated: z.boolean(),
});
