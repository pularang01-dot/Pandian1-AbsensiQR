export type AssignmentEmbed = { class_id: string; end_date: string | null; classes: { name: string } | { name: string }[] | null };

/** Nama kelas dari penempatan yang masih terbuka (end_date null). */
export function openClassName(assignments: AssignmentEmbed[] | null | undefined): string | null {
  const open = (assignments ?? []).find((a) => a.end_date === null);
  if (!open) return null;
  const c = Array.isArray(open.classes) ? open.classes[0] : open.classes;
  return c?.name ?? null;
}

export function one<T>(v: T | T[] | null | undefined): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : (v ?? null);
}
