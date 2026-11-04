import { COPYRIGHT, COPYRIGHT_LINE } from "@/lib/copyright";

export function CopyrightFooter({ tone = "light" }: { tone?: "light" | "dark" }) {
  return (
    <footer className={`print:hidden text-center text-xs leading-relaxed ${tone === "dark" ? "text-white/50" : "text-ink-muted"}`}>
      <p>{COPYRIGHT_LINE}</p>
      <p className="mt-0.5">Hak cipta dilindungi. {COPYRIGHT.app} untuk SDN Pandian 1 Sumenep.</p>
    </footer>
  );
}