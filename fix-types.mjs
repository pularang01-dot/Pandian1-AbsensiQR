import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const src = path.join(root, "src");
if (!fs.existsSync(src)) { console.error("GAGAL: folder src tidak ditemukan. Jalankan dari folder proyek."); process.exit(1); }

function walk(d, out = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p, out); else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

let changed = 0;

for (const f of walk(src)) {
  const s = fs.readFileSync(f, "utf8");
  const t = s.replace(/\bone\(([\w.?]+) as (?!unknown\b)\{/g, "one($1 as unknown as {");
  if (t !== s) { fs.writeFileSync(f, t); changed++; console.log("DIPERBAIKI cast  :", path.relative(root, f)); }
}

for (const rel of ["src/lib/supabase/server.ts", "src/lib/supabase/middleware.ts"]) {
  const f = path.join(root, rel);
  if (!fs.existsSync(f)) { console.log("LEWAT (tidak ada):", rel); continue; }
  let s = fs.readFileSync(f, "utf8");
  if (s.includes("CookieToSet")) { console.log("SUDAH benar      :", rel); continue; }
  s = s.replace('import { createServerClient } from "@supabase/ssr";', 'import { createServerClient, type CookieOptions } from "@supabase/ssr";');
  s = s.replace("setAll(cookiesToSet) {", "setAll(cookiesToSet: CookieToSet[]) {");
  const lines = s.split("\n");
  let last = -1;
  lines.forEach((l, i) => { if (l.startsWith("import ")) last = i; });
  lines.splice(last + 1, 0, "", "type CookieToSet = { name: string; value: string; options: CookieOptions };");
  fs.writeFileSync(f, lines.join("\n"));
  changed++;
  console.log("DIPERBAIKI cookie:", rel);
}

const bad = [];
for (const f of walk(src)) {
  const s = fs.readFileSync(f, "utf8");
  if (/\bone\(([\w.?]+) as (?!unknown\b)\{/.test(s)) bad.push(path.relative(root, f));
}
for (const rel of ["src/lib/supabase/server.ts", "src/lib/supabase/middleware.ts"]) {
  const f = path.join(root, rel);
  if (fs.existsSync(f) && !fs.readFileSync(f, "utf8").includes("setAll(cookiesToSet: CookieToSet[])")) bad.push(rel);
}
console.log(bad.length ? `\nMASIH BERMASALAH di: ${bad.join(", ")}` : `\nSELESAI. ${changed} berkas diubah. Semua pemeriksaan lolos.`);
process.exit(bad.length ? 1 : 0);