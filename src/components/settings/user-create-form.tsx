"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { SimpleForm } from "@/components/settings/simple-form";
import { ROLE_LABEL } from "@/lib/auth/roles";
import type { ActionState } from "@/lib/validation/common";

export function UserCreateForm({
  action, roles, students,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  roles: string[];
  students: { id: string; label: string }[];
}) {
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const byId = useMemo(() => new Map(students.map((s) => [s.id, s.label])), [students]);
  const matches = useMemo(() => {
    const t = search.trim().toLowerCase();
    return t === "" ? [] : students.filter((s) => !selected.includes(s.id) && s.label.toLowerCase().includes(t)).slice(0, 8);
  }, [students, selected, search]);

  return (
    <SimpleForm action={action} submitLabel="Buat akun" resetOnSuccess>
      <Field label="Nama lengkap" htmlFor="full_name" required><Input id="full_name" name="full_name" maxLength={150} /></Field>
      <Field label="Email" htmlFor="email" required hint="Untuk akun Google, gunakan alamat Gmail/Google Workspace yang dipakai pengguna."><Input id="email" name="email" type="email" autoComplete="off" /></Field>
      <Field label="Telepon (opsional)" htmlFor="phone"><Input id="phone" name="phone" maxLength={30} /></Field>
      <Field label="Cara masuk" htmlFor="mode" required hint="Google: tidak ada email dikirim; pengguna menekan Masuk dengan Google memakai email ini.">
        <Select id="mode" name="mode" defaultValue="invite">
          <option value="invite">Email dan kata sandi (undangan email)</option>
          <option value="google">Akun Google</option>
        </Select>
      </Field>
      <Field label="Peran" htmlFor="role" required>
        <Select id="role" name="role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="" disabled>Pilih peran</option>
          {roles.map((r) => <option key={r} value={r}>{ROLE_LABEL[r as keyof typeof ROLE_LABEL]}</option>)}
        </Select>
      </Field>
      {role === "parent" && (
        <fieldset className="space-y-3 rounded-lg border border-line p-3">
          <legend className="px-1 text-sm font-medium">Siswa yang dihubungkan</legend>
          <Field label="Hubungan" htmlFor="relationship" required>
            <Select id="relationship" name="relationship" defaultValue=""><option value="" disabled>Pilih</option><option value="ayah">Ayah</option><option value="ibu">Ibu</option><option value="wali">Wali</option></Select>
          </Field>
          <Input aria-label="Cari siswa" placeholder="Cari nama, kelas, atau NIS" value={search} onChange={(e) => setSearch(e.target.value)} />
          {matches.length > 0 && <ul className="divide-y divide-line rounded-lg border border-line">{matches.map((s) => <li key={s.id}><button type="button" className="flex min-h-11 w-full items-center px-3 text-left text-sm hover:bg-canvas" onClick={() => { setSelected((p) => [...p, s.id]); setSearch(""); }}>{s.label}</button></li>)}</ul>}
          <ul className="flex flex-wrap gap-2">
            {selected.map((id) => (
              <li key={id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-canvas py-1 pl-3 pr-1 text-sm">
                {byId.get(id)}<input type="hidden" name="student_ids" value={id} />
                <button type="button" aria-label={`Hapus ${byId.get(id)}`} onClick={() => setSelected((p) => p.filter((x) => x !== id))} className="grid h-7 w-7 place-items-center rounded-full hover:bg-line"><X className="h-4 w-4" aria-hidden /></button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
    </SimpleForm>
  );
}