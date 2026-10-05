import { ShieldAlert } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Vaste waarschuwing bij elk vrij tekstveld (CLAUDE.md, "Privacy";
 * SPEC.md 4.6). De tekst staat hier één keer, zodat hij overal gelijk is.
 */
export function PrivacyWaarschuwing({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-500",
        className,
      )}
    >
      <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>
        Alleen zakelijke afspraken. Geen namen of bijzonderheden van individuele
        leerlingen.
      </span>
    </p>
  );
}
