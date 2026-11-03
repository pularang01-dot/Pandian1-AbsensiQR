"use client";

import Link from "next/link";
import { useActionState, useMemo, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { ActionState } from "@/lib/validation/common";
import { DISPENSATION_CATEGORY } from "@/lib/validation/dispensation";

const initial: ActionState = { ok: false };
type StudentOpt = { id: string; label: string };

export function DispensationForm({
  action, students, teachers, defaultSupervisor,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  students: StudentOpt[];
  teachers: { id: string; name: string }[];
  defaultSupervisor?: string;
}) {
  const [state, run, pending] = useActionState(action, initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const e = state.fieldErrors ?? {};

  const byId = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    return students.filter((s) => !selected.includes(s.id) && (t === "" || s.label.toLowerCase().includes(t))).slice(0, 30);
  }, [students, selected, search]);

  return (
    <form action={run} className="card space-y-5 p-5 sm:p-6" noValidate>
      {state.message && <div role="alert" className="rounded-lg border border-danger/20 bg-danger/10 px-3.5 py-3 text-sm text-danger">{state.message}</div>}

      <Field label="Nama kegiatan" htmlFor="name" error={e.name} required>
        <Input id="name" name="name" maxLength={200} />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Kategori" htmlFor="category" error={e.category} required>
          <Select id="category" name="category" defaultValue="">
            <option value="" disabled>Pilih kategori</option>
            {Object.entries(DISPENSATION_CATEGORY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </Field>
        <Field label="Lokasi (opsional)" htmlFor="location" error={e.location}>
          <Input id="location" name="location" maxLength={200} />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Mulai (WIB)" htmlFor="starts_at" error={e.starts_at} required><Input id="starts_at" name="starts_at" type="datetime-local" /></Field>
        <Field label="Selesai (WIB)" htmlFor="ends_at" error={e.ends_at} required><Input id="ends_at" name="ends_at" type="datetime-local" /></Field>
      </div>
      <Field label="Guru pendamping" htmlFor="supervisor_id" error={e.supervisor_id} required hint="Guru pendamping yang akan mengonfirmasi siswa benar-benar ikut serta.">
        <Select id="supervisor_id" name="supervisor_id" defaultValue={defaultSupervisor ?? ""}>
          <option value="" disabled>Pilih guru</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </Select>
      </Field>
      <Field label="Deskripsi (opsional)" htmlFor="description" error={e.description}>
        <Textarea id="description" name="description" maxLength={1000} />
      </Field>

      <fieldset>
        <legend className="mb-1.5 text-sm font-medium">Siswa peserta <span className="text-danger" aria-hidden>*</span></legend>
        <Input aria-label="Cari siswa" placeholder="Cari nama, kelas, atau NIS" value={search} onChange={(ev) => setSearch(ev.target.value)} />
        <ul className="mt-2 max-h-48 divide-y divide-line overflow-y-auto rounded-lg border border-line" aria-label="Hasil pencarian siswa">
          {matches.length === 0 ? <li className="px-3.5 py-3 text-sm text-ink-muted">Tidak ada siswa yang cocok.</li> : matches.map((s) => (
            <li key={s.id}>
              <button type="button" onClick={() => setSelected((p) => [...p, s.id])} className="flex min-h-11 w-full items-center px-3.5 py-2 text-left text-sm hover:bg-canvas">{s.label}</button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-sm font-medium">Terpilih: <span className="tabular">{selected.length}</span> siswa</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {selected.map((id) => (
            <li key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-3 pr-1 text-sm">
              {byId.get(id)?.label}
              <input type="hidden" name="student_ids" value={id} />
              <button type="button" aria-label={`Hapus ${byId.get(id)?.label ?? "siswa"}`} onClick={() => setSelected((p) => p.filter((x) => x !== id))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-line"><X className="h-4 w-4" aria-hidden /></button>
            </li>
          ))}
        </ul>
        {e.student_ids && <p role="alert" className="mt-2 text-sm text-danger">{e.student_ids}</p>}
      </fieldset>

      <p className="rounded-lg bg-canvas px-3.5 py-3 text-xs text-ink-muted">Pengajuan tidak otomatis disetujui. Setelah disetujui, absensi Kegiatan Resmi Sekolah baru tercatat ketika guru pendamping mengonfirmasi siswa ikut serta.</p>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link href="/dispensations" className="inline-flex h-11 items-center justify-center rounded-lg border border-line px-4 text-sm font-medium hover:bg-canvas">Batal</Link>
        <Button type="submit" loading={pending}>{pending ? "Mengirim" : "Kirim pengajuan"}</Button>
      </div>
    </form>
  );
}
