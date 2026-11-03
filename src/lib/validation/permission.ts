import { z } from "zod";
import { differenceInCalendarDays, parseISO } from "date-fns";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Tanggal tidak valid.").refine((v) => !Number.isNaN(Date.parse(v)), "Tanggal tidak valid.");

export const permissionSchema = z
  .object({
    student_id: z.string().uuid("Pilih siswa."),
    category: z.enum(["sick", "permission"], { errorMap: () => ({ message: "Pilih kategori." }) }),
    start_date: isoDate,
    end_date: isoDate,
    reason: z
      .string()
      .trim()
      .min(3, "Alasan minimal 3 karakter.")
      .max(500, "Alasan maksimal 500 karakter."),
  })
  .refine((v) => v.end_date >= v.start_date, { path: ["end_date"], message: "Tanggal selesai tidak boleh sebelum tanggal mulai." })
  .refine((v) => differenceInCalendarDays(parseISO(v.end_date), parseISO(v.start_date)) <= 30, {
    path: ["end_date"],
    message: "Rentang maksimal 31 hari. Ajukan terpisah untuk periode lebih panjang.",
  });

export const reviewSchema = z.object({
  request_id: z.string().uuid(),
  action: z.enum(["start_review", "request_clarification", "reject", "approve", "cancel_approval"]),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter.").optional(),
});

export const CATEGORY_LABEL: Record<string, string> = { sick: "Sakit", permission: "Izin" };

export const DOC_MAX_BYTES = 5 * 1024 * 1024;
export const DOC_TYPES: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png" };

/** Memeriksa tanda tangan berkas (magic bytes), bukan hanya ekstensi/MIME dari klien. */
export function detectDocType(bytes: Uint8Array): "application/pdf" | "image/jpeg" | "image/png" | null {
  const hex = (n: number) => Array.from(bytes.slice(0, n)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex(4) === "25504446") return "application/pdf";
  if (hex(3) === "ffd8ff") return "image/jpeg";
  if (hex(8) === "89504e470d0a1a0a") return "image/png";
  return null;
}
