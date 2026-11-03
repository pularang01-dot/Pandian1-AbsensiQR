import { z } from "zod";
import { wibToIso } from "@/lib/validation/dispensation";

export const HANDOVER_OUTCOME_LABEL: Record<string, string> = {
  handed_over: "Diserahkan kepada penjemput",
  verification_failed: "Verifikasi gagal, siswa tetap di sekolah",
};

export const dismissalSchema = z.object({
  student_id: z.string().uuid("Pilih siswa."),
  requester_relation: z.string().trim().min(2, "Hubungan pemohon minimal 2 karakter.").max(50, "Maksimal 50 karakter."),
  reason: z.string().trim().min(3, "Alasan minimal 3 karakter.").max(500, "Alasan maksimal 500 karakter."),
  requested_time: z.string().refine((v) => wibToIso(v) !== null, "Waktu penjemputan tidak valid."),
  authorized_pickup_name: z.string().trim().min(2, "Nama penjemput minimal 2 karakter.").max(100, "Maksimal 100 karakter."),
  authorized_pickup_relation: z.string().trim().min(2, "Hubungan penjemput minimal 2 karakter.").max(50, "Maksimal 50 karakter."),
});

export const dismissalReviewSchema = z.discriminatedUnion("action", [
  z.object({
    id: z.string().uuid(), action: z.literal("approve"),
    requester_verified: z.literal(true, { errorMap: () => ({ message: "Centang bahwa identitas pemohon sudah diverifikasi." }) }),
    verification_note: z.string().trim().min(3, "Catatan verifikasi minimal 3 karakter.").max(500),
    note: z.string().trim().max(500).optional(),
  }),
  z.object({ id: z.string().uuid(), action: z.literal("reject"), note: z.string().trim().min(3, "Alasan penolakan wajib diisi.").max(500) }),
  z.object({ id: z.string().uuid(), action: z.literal("cancel"), note: z.string().trim().min(3, "Alasan pembatalan wajib diisi.").max(500) }),
]);

export const handoverSchema = z.object({
  request_id: z.string().uuid(),
  outcome: z.enum(["handed_over", "verification_failed"]),
  actual_name: z.string().trim().min(2, "Nama penjemput wajib diisi.").max(100),
  actual_relation: z.string().trim().min(2, "Hubungan penjemput wajib diisi.").max(50),
  identity_document: z.string().trim().min(2, "Jenis dokumen identitas wajib diisi.").max(100),
  matches_authorized: z.boolean(),
  note: z.string().trim().max(500).optional(),
}).refine((v) => v.outcome !== "handed_over" || v.matches_authorized, {
  path: ["matches_authorized"], message: "Serah terima hanya sah bila penjemput cocok dengan yang diizinkan.",
});
