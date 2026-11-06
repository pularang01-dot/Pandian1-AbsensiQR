import Image from "next/image";
import { cn } from "@/lib/utils";

/** Lambang resmi SDN Pandian 1 Sumenep. Berkas: public/logo.png (latar transparan). */
export function SchoolLogo({ size = 40, className, priority = false }: { size?: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/logo.png"
      alt="Lambang SDN Pandian 1 Sumenep"
      width={size}
      height={Math.round(size * 1.018)}
      priority={priority}
      className={cn("h-auto select-none", className)}
      style={{ width: size }}
      draggable={false}
    />
  );
}