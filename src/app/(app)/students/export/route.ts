import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { APPROVER_ROLES } from "@/lib/auth/roles";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { safeCell, toCsv } from "@/lib/export-safe";
import { asUuid } from "@/lib/data/lookups";
import { openClassName, type AssignmentEmbed } from "@/lib/data/students";
import { sanitizeSearch } from "@/lib/validation/common";
import { STUDENT_STATUS_LABEL } from "@/lib/validation/student";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (!user.roles.some((r) => APPROVER_ROLES.includes(r))) return NextResponse.json({ error: "Anda tidak berwenang mengekspor data siswa." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const format = sp.get("format") === "csv" ? "csv" : "xlsx";
  const status = ["active", "transferred", "graduated", "inactive"].includes(sp.get("status") ?? "") ? sp.get("status")! : "active";
  const classId = asUuid(sp.get("class"));
  const q = sanitizeSearch(sp.get("q"));

  const supabase = await createClient();
  const embed = classId ? "student_class_assignments!inner(class_id, end_date, classes(name))" : "student_class_assignments(class_id, end_date, classes(name))";
  let query = supabase.from("students").select(`nis, nisn, full_name, gender, status, ${embed}`).eq("status", status).order("full_name").limit(5000);
  if (classId) query = query.eq("student_class_assignments.class_id", classId).is("student_class_assignments.end_date", null);
  if (q) query = query.or(`full_name.ilike.%${q}%,nis.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Data tidak dapat diekspor. Coba lagi." }, { status: 500 });

  const head = ["NIS", "NISN", "Nama", "JK", "Kelas", "Status"];
  const body = (data as unknown as { nis: string; nisn: string | null; full_name: string; gender: string | null; status: string; student_class_assignments: AssignmentEmbed[] }[]).map((s) => [
    s.nis, s.nisn ?? "", s.full_name, s.gender ?? "", openClassName(s.student_class_assignments) ?? "", STUDENT_STATUS_LABEL[s.status] ?? s.status,
  ]);

  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "csv") {
    return new NextResponse(toCsv([head, ...body]), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="siswa-${stamp}.csv"`, "Cache-Control": "no-store" },
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([head, ...body.map((r) => r.map((c) => safeCell(c)))]);
  ws["!cols"] = [{ wch: 12 }, { wch: 16 }, { wch: 32 }, { wch: 5 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Siswa");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="siswa-${stamp}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
