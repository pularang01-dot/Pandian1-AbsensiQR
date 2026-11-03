import { NextResponse, type NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { getSessionUser } from "@/lib/auth/session";
import { safeCell, toCsv } from "@/lib/export-safe";
import { buildReport, type ReportKind } from "@/lib/data/reports";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED = ["super_admin", "school_admin", "principal", "teacher"];

export async function GET(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Sesi berakhir. Silakan masuk kembali." }, { status: 401 });
  if (!user.roles.some((r) => ALLOWED.includes(r))) return NextResponse.json({ error: "Anda tidak berwenang mengekspor laporan." }, { status: 403 });

  const sp = request.nextUrl.searchParams;
  const kind = (["daily", "monthly", "students"].includes(sp.get("type") ?? "") ? sp.get("type") : "daily") as ReportKind;
  const format = ["csv", "pdf"].includes(sp.get("format") ?? "") ? sp.get("format")! : "xlsx";

  // Data dibaca dengan sesi pengguna sehingga RLS tetap membatasi guru pada kelasnya.
  const t = await buildReport(kind, sp);
  if (t.error) return NextResponse.json({ error: t.error }, { status: 500 });

  const stamp = new Date().toISOString().slice(0, 10);
  const base = `laporan-${kind}-${stamp}`;
  const headers = { "Cache-Control": "no-store" };

  if (format === "csv") {
    return new NextResponse(toCsv([[t.title], [t.subtitle], [], t.head, ...t.rows]), {
      headers: { ...headers, "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${base}.csv"` },
    });
  }

  if (format === "pdf") {
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14); doc.text(t.title, 40, 40);
    doc.setFontSize(10); doc.text(t.subtitle, 40, 58);
    autoTable(doc, {
      startY: 72, head: [t.head], body: t.rows.map((r) => r.map(String)),
      styles: { fontSize: 8, cellPadding: 3 }, headStyles: { fillColor: [20, 43, 74] },
    });
    const y = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 72) + 18;
    doc.setFontSize(8);
    doc.text(doc.splitTextToSize(t.notes.join(" "), 760), 40, y);
    doc.text(`Dibuat ${stamp} oleh sistem PANDIAN SMART ATTENDANCE.`, 40, y + 30);
    return new NextResponse(new Uint8Array(doc.output("arraybuffer")), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${base}.pdf"` },
    });
  }

  const ws = XLSX.utils.aoa_to_sheet([[safeCell(t.title)], [safeCell(t.subtitle)], [], t.head, ...t.rows.map((r) => r.map((c) => safeCell(c)))]);
  ws["!cols"] = t.head.map((h, i) => ({ wch: i === 1 && kind !== "daily" ? 32 : Math.max(10, h.length + 2) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return new NextResponse(new Uint8Array(buf), {
    headers: { ...headers, "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": `attachment; filename="${base}.xlsx"` },
  });
}
