/**
 * Pemantauan error sisi server (hook bawaan Next.js 15). Tanpa paket tambahan.
 * Hanya mencatat pesan teknis yang disamarkan; tidak mengirim apa pun keluar dari proyek Supabase sekolah.
 */
export async function onRequestError(
  err: { digest?: string; message?: string; stack?: string } | unknown,
  request: { path?: string; method?: string },
  context: { routerKind?: string; routePath?: string; routeType?: string },
) {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const e = (err ?? {}) as { digest?: string; message?: string; stack?: string };
  // Pengalihan dan halaman tidak ditemukan bukan error.
  if (typeof e.digest === "string" && (e.digest.startsWith("NEXT_REDIRECT") || e.digest.startsWith("NEXT_NOT_FOUND") || e.digest.startsWith("NEXT_HTTP_ERROR"))) return;
  if (!e.message) return;
  const { reportServerError } = await import("@/lib/monitoring/report");
  await reportServerError({
    source: context?.routeType === "action" ? "action" : "server",
    route: `${request?.method ?? ""} ${context?.routePath ?? request?.path ?? ""}`.trim(),
    message: e.message,
    digest: e.digest,
    detail: (e.stack ?? "").split("\n").slice(0, 6).join("\n"),
  });
}