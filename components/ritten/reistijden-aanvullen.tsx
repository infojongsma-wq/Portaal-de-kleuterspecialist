"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";

import { vulReistijdenAan } from "@/app/ritten/acties";
import { Button } from "@/components/ui/button";

/**
 * Ritten zonder reistijd, bijvoorbeeld van vóór de reistijd bij de ritten
 * kwam (SPEC.md 6.7). De knop berekent de reisduur zoals bij een nieuwe rit.
 */
export function ReistijdenAanvullen({
  aantal,
  medewerkerId,
}: {
  /** Hoeveel ritten nog geen reistijd hebben, over alle maanden. */
  aantal: number;
  /** Alleen als de beheerder de ritten van iemand anders bekijkt. */
  medewerkerId: string | null;
}) {
  const router = useRouter();
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);

  if (aantal === 0 && !melding) return null;

  async function vulAan() {
    setBezig(true);
    setMelding(null);
    try {
      const resultaat = await vulReistijdenAan(medewerkerId ?? undefined);
      setMelding(resultaat.melding ?? null);
      router.refresh();
    } catch {
      setMelding("Het portaal is niet bereikbaar. Probeer het zo nog eens.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <div className="afdruk-verbergen grid gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-50">
      {aantal > 0 ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="flex items-start gap-2">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              {aantal === 1 ? "1 rit heeft" : `${aantal} ritten hebben`} nog geen
              reistijd. Die {aantal === 1 ? "telt" : "tellen"} daardoor nog niet mee
              voor de uren.
            </span>
          </p>
          <Button type="button" onClick={vulAan} disabled={bezig}>
            {bezig ? "Bezig met berekenen…" : "Reistijden aanvullen"}
          </Button>
        </div>
      ) : null}
      {melding ? <p role="status">{melding}</p> : null}
    </div>
  );
}
