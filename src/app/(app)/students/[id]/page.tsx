import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { ADMIN_ROLES, STAFF_ROLES } from "@/lib/auth/roles";
import { requireRole } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState } from "@/components/ui/states";
import { QrCard } from "@/components/students/qr-card";
import { asUuid, loadClasses, loadYears, pickYear } from "@/lib/data/lookups";
import { one, type AssignmentEmbed } from "@/lib/data/students";
import { STUDENT_STATUS_LABEL } from "@/lib/validation/student";
import { formatTanggal } from "@/lib/utils";
import { AssignClassForm, LinkParentForm, RegenerateQrButton, StatusButton, UnlinkButton } from "./student-actions";

export const metadata: Metadata = { title: "Rincian Siswa" };
export const dynamic = "force-dynamic";

type LinkRow = { id: string; relationship: string; is_active: boolean; parents: { id: string; profiles: { full_name: string; phone: string | null } | { full_name: string; phone: string | null }[] | null } | { id: string; profiles: unknown }[] | null };

export default async function StudentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireRole(STAFF_ROLES);
  const id = asUuid((await params).id);
  if (!id) notFound();
  const isAdmin = user.roles.some((r) => ADMIN_ROLES.includes(r));
  const supabase = await createClient();

  const { data: s } = await supabase
    .from("students")
    .select("id, nis, nisn, full_name, gender, status, is_demo, created_at, student_class_assignments(class_id, end_date, start_date, classes(name))")
    .eq("id", id)
    .maybeSingle();
  if (!s) notFound();

  const year = pickYear(await loadYears());
  const [classes, att, links, tokenRes, parentsRes, schoolRes] = await Promise.all([
    isAdmin ? loadClasses(year?.id) : Promise.resolve([]),
    supabase
      .from("attendance_records")
      .select("id, status, checked_in_at, source, note, attendance_sessions(session_date)")
      .eq("student_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("parent_student_links").select("id, relationship, is_active, parents(id, profiles(full_name, phone))").eq("student_id", id).eq("is_active", true),
    isAdmin ? supabase.from("student_qr_tokens").select("token").eq("student_id", id).eq("is_active", true).maybeSingle() : Promise.resolve({ data: null }),
    isAdmin ? supabase.from("parents").select("id, profiles(full_name)").order("created_at") : Promise.resolve({ data: [] }),
    supabase.from("system_settings").select("value").eq("key", "school.name").maybeSingle(),
  ]);

  const assignments = (s.student_class_assignments ?? []) as unknown as (AssignmentEmbed & { start_date: string })[];
  const open = assignments.find((a) => a.end_date === null);
  const className = open ? (one(open.classes)?.name ?? null) : null;
  const schoolName = typeof schoolRes.data?.value === "string" && schoolRes.data.value ? schoolRes.data.value : "SDN PANDIAN 1 SUMENEP";

  const linked = ((links.data ?? []) as unknown as LinkRow[]).map((l) => {
    const p = one(l.parents as unknown as { id: string; profiles: unknown } | null);
    const prof = one(p?.profiles as { full_name: string; phone: string | null } | null);
    return { id: l.id, relationship: l.relationship, name: prof?.full_name ?? "Akun orang tua", phone: prof?.phone ?? null, parentId: p?.id ?? "" };
  });
  const linkedIds = new Set(linked.map((l) => l.parentId));
  const parentOptions = ((parentsRes.data ?? []) as unknown as { id: string; profiles: unknown }[])
    .filter((p) => !linkedIds.has(p.id))
    .map((p) => ({ id: p.id, label: one(p.profiles as unknown as { full_name: string } | null)?.full_name ?? "Akun orang tua" }));

  return (
    <>
      <PageHeader
        title={s.full_name}
        description={`NIS ${s.nis}${className ? ` | Kelas ${className}` : " | Belum ditempatkan di kelas"}`}
        actions={isAdmin ? <Link href={`/students/${s.id}/edit`} className="inline-flex h-11 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-canvas"><Pencil className="h-4 w-4" aria-hidden />Ubah</Link> : undefined}
      />
      {s.is_demo && <p role="note" className="mb-4 rounded-lg border border-warning/30 bg-warning/10 px-4 py-3 text-sm text-[#9a6510]">Data demonstrasi. Bukan data siswa sebenarnya.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card p-5">
            <h2 className="mb-4 text-base font-semibold">Data siswa</h2>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-muted">Nama lengkap</dt><dd className="mt-0.5 font-medium">{s.full_name}</dd></div>
              <div><dt className="text-ink-muted">Status</dt><dd className="mt-0.5 font-medium">{STUDENT_STATUS_LABEL[s.status] ?? s.status}</dd></div>
              <div><dt className="text-ink-muted">NIS</dt><dd className="tabular mt-0.5 font-medium">{s.nis}</dd></div>
              <div><dt className="text-ink-muted">NISN</dt><dd className="tabular mt-0.5 font-medium">{s.nisn ?? "-"}</dd></div>
              <div><dt className="text-ink-muted">Jenis kelamin</dt><dd className="mt-0.5 font-medium">{s.gender === "L" ? "Laki-laki" : s.gender === "P" ? "Perempuan" : "-"}</dd></div>
              <div><dt className="text-ink-muted">Kelas saat ini</dt><dd className="mt-0.5 font-medium">{className ?? "-"}</dd></div>
            </dl>
            {isAdmin && (
              <div className="mt-5 space-y-4 border-t border-line pt-5">
                <AssignClassForm studentId={s.id} classes={classes.filter((c) => c.is_active)} currentClassId={open?.class_id ?? null} />
                <StatusButton studentId={s.id} status={s.status} />
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="mb-1 text-base font-semibold">Orang tua / wali</h2>
            <p className="mb-4 text-sm text-ink-muted">Hanya akun yang dihubungkan di sini yang dapat melihat data anak ini.</p>
            {linked.length === 0 ? (
              <EmptyState title="Belum ada orang tua terhubung" description="Orang tua belum dapat mengajukan izin atau melihat kehadiran anak." />
            ) : (
              <ul className="divide-y divide-line rounded-lg border border-line">
                {linked.map((l) => (
                  <li key={l.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="text-sm font-medium">{l.name}</p>
                      <p className="text-xs capitalize text-ink-muted">{l.relationship}{l.phone ? ` | ${l.phone}` : ""}</p>
                    </div>
                    {isAdmin && <UnlinkButton linkId={l.id} studentId={s.id} name={l.name} />}
                  </li>
                ))}
              </ul>
            )}
            {isAdmin && <div className="mt-5 border-t border-line pt-5"><LinkParentForm studentId={s.id} parents={parentOptions} /></div>}
          </section>

          <section className="card">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <h2 className="text-base font-semibold">Riwayat absensi terbaru</h2>
              <Link href={`/attendance/history?student=${s.id}`} className="text-sm font-medium text-brand hover:underline">Lihat semua</Link>
            </div>
            {(att.data ?? []).length === 0 ? (
              <EmptyState title="Belum ada catatan absensi" />
            ) : (
              <ul className="divide-y divide-line">
                {(att.data ?? []).map((r) => {
                  const sess = one(r.attendance_sessions as unknown as { session_date: string } | { session_date: string }[] | null);
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium">{sess ? formatTanggal(sess.session_date) : "-"}</p>
                        {r.note && <p className="text-xs text-ink-muted">{r.note}</p>}
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {isAdmin && (
          <aside className="space-y-4">
            <section className="card p-5">
              <h2 className="mb-1 text-base font-semibold">Kartu QR absensi</h2>
              <p className="mb-4 text-sm text-ink-muted">QR berisi kode acak yang dapat dicabut, tanpa data pribadi. QR hanya membantu identifikasi; kehadiran tetap diawasi petugas.</p>
              <div className="flex justify-center">
                <QrCard token={tokenRes.data?.token ?? null} name={s.full_name} nis={s.nis} className={className} schoolName={schoolName} />
              </div>
              <div className="mt-4 flex justify-center"><RegenerateQrButton studentId={s.id} /></div>
            </section>
          </aside>
        )}
      </div>
    </>
  );
}