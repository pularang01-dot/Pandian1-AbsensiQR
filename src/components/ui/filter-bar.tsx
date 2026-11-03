import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "./button";

/** Formulir filter metode GET: state tersimpan di URL sehingga dapat dibagikan dan dicetak. */
export function FilterBar({ children, action, resetHref }: { children: ReactNode; action: string; resetHref: string }) {
  return (
    <form action={action} method="get" className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:flex-wrap sm:items-end">
      {children}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary"><Search className="h-4 w-4" aria-hidden />Terapkan</Button>
        <a href={resetHref} className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-medium text-ink-muted hover:bg-canvas">Atur ulang</a>
      </div>
    </form>
  );
}

export function FilterField({ label, htmlFor, children, grow }: { label: string; htmlFor: string; children: ReactNode; grow?: boolean }) {
  return (
    <div className={grow ? "flex-1 sm:min-w-56" : "sm:w-48"}>
      <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}
