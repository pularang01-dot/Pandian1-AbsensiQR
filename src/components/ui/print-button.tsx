"use client";

import { Printer } from "lucide-react";
import { Button } from "./button";

export function PrintButton({ label = "Cetak" }: { label?: string }) {
  return (
    <Button variant="secondary" onClick={() => window.print()}>
      <Printer className="h-4 w-4" aria-hidden />{label}
    </Button>
  );
}
