import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/states";
import { Pagination, PAGE_SIZE, parsePage } from "@/components/ui/pagination";
import { formatTanggal } from "@/lib/utils";
import { MarkAllRead } from "./mark-read";

export const metadata: Metadata = { title: "Notifikasi" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  await requireUser();
  const page = parsePage((await searchParams).page);
  const supabase = await createClient();
  // RLS: setiap pengguna hanya dapat membaca notifikasinya sendiri.
  const { data, count } = await supabase
    .from("notifications")
    .select("id, title, body, link, is_read, created_at", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  const unread = (data ?? []).some((n) => !n.is_read);

  return (
    <>
      <PageHeader title="Notifikasi" description="Pemberitahuan internal sistem. Tidak memerlukan layanan pesan eksternal." actions={unread ? <MarkAllRead /> : undefined} />
      <div className="card">
        {(data ?? []).length === 0 ? (
          <EmptyState title="Belum ada notifikasi" description="Pemberitahuan tentang pengajuan, persetujuan, dan koreksi akan muncul di sini." />
        ) : (
          <ul className="divide-y divide-line">
            {(data ?? []).map((n) => (
              <li key={n.id} className="flex gap-3 px-5 py-4">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-transparent" : "bg-brand"}`} />
                <div className="min-w-0 flex-1">
                  {n.link ? <Link href={n.link} className="text-sm font-semibold hover:text-brand">{n.title}</Link> : <p className="text-sm font-semibold">{n.title}</p>}
                  {n.body && <p className="mt-0.5 text-sm text-ink-muted">{n.body}</p>}
                  <p className="tabular mt-1 text-xs text-ink-muted">{formatTanggal(n.created_at, "d MMM yyyy, HH:mm")}{n.is_read ? "" : " | Belum dibaca"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination page={page} total={count ?? 0} basePath="/notifications" />
      </div>
    </>
  );
}
