/** Membaca tingkat kelas (1-6) dari nama kelas dan membuat nama kelas tingkat berikutnya. Murni, tanpa efek samping. */
const ROMAN = ["", "I", "II", "III", "IV", "V", "VI"];
const ARABIC_RE = /^(\d{1,2})(?!\d)/;
const ROMAN_RE = /^(VI|IV|V|III|II|I)(?=$|[^A-Za-z]|[A-Za-z]$)/i;

export const FINAL_GRADE = 6;

export function parseGrade(name: string): number | null {
  const t = name.trim();
  const a = ARABIC_RE.exec(t);
  if (a) { const n = Number(a[1]); return n >= 1 && n <= FINAL_GRADE ? n : null; }
  const r = ROMAN_RE.exec(t);
  if (r) { const n = ROMAN.indexOf(r[1].toUpperCase()); return n > 0 ? n : null; }
  return null;
}

/** "1A" -> "2A", "V-B" -> "VI-B", "iii c" -> "iv c". Null bila tingkat tidak terbaca atau sudah tingkat akhir. */
export function incrementClassName(name: string): string | null {
  const t = name.trim();
  const g = parseGrade(t);
  if (g === null || g >= FINAL_GRADE) return null;
  const a = ARABIC_RE.exec(t);
  if (a) return String(g + 1) + t.slice(a[1].length);
  const r = ROMAN_RE.exec(t);
  if (r) {
    const next = ROMAN[g + 1];
    return (r[1] === r[1].toLowerCase() ? next.toLowerCase() : next) + t.slice(r[1].length);
  }
  return null;
}