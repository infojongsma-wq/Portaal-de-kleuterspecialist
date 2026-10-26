"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Mail } from "lucide-react";

import { verstuurWeekmailNu } from "@/app/beheer/acties";
import { Button } from "@/components/ui/button";

/**
 * De weekmail in Beheer (SPEC.md 6.6): waar en wanneer hij heen gaat, wanneer
 * de laatste ging, en de knop om hem meteen te versturen.
 */
export function WeekmailBlok({
  ontvanger,
  ontbreekt,
  laatste,
  aantalNieuw,
}: {
  /** `null` als de weekmail nog niet is ingesteld. */
  ontvanger: string | null;
  /** De omgevingsvariabelen die nog ontbreken. */
  ontbreekt: string[];
  /** Al opgemaakt in Nederlandse tijd, met het aantal trainingen. */
  laatste: { tijdstip: string; aantal: number } | null;
  aantalNieuw: number;
}) {
  const router = useRouter();
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<{ gelukt: boolean; tekst: string } | null>(
    null,
  );

  async function verstuur() {
    setBezig(true);
    setMelding(null);
    try {
      const resultaat = await verstuurWeekmailNu();
      setMelding({
        gelukt: resultaat.gelukt,
        tekst: resultaat.melding ?? (resultaat.gelukt ? "Verstuurd." : "Dat ging mis."),
      });
      if (resultaat.gelukt) router.refresh();
    } catch {
      setMelding({
        gelukt: false,
        tekst: "Het portaal is niet bereikbaar. Probeer het zo nog eens.",
      });
    } finally {
      setBezig(false);
    }
  }

  const nieuwTekst =
    aantalNieuw === 0
      ? "Er is nu niets nieuws; de mail zegt dat dan ook."
      : `${aantalNieuw === 1 ? "De training" : `De ${aantalNieuw} trainingen`} met het label Nieuw ${aantalNieuw === 1 ? "gaat" : "gaan"} dan meteen; maandag komt alleen wat daarna is afgevinkt.`;

  return (
    <div className="mx-6 mb-4 grid gap-3 rounded-md bg-muted p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <p className="flex items-center gap-2 font-medium">
            <Mail className="size-4" aria-hidden />
            Weekmail
          </p>
          {ontvanger ? (
            <p className="text-muted-foreground">
              Elke maandag om 08:00 naar {ontvanger}, met de trainingen die
              sinds de vorige weekmail als gedaan zijn afgevinkt en waarvan de
              factuur nog niet is verstuurd.
            </p>
          ) : (
            <p className="text-muted-foreground">
              Nog niet ingesteld. In Vercel ontbreekt: {ontbreekt.join(", ")}.
              Zie PUBLICEREN.md, stap 4e.
            </p>
          )}
          <p className="text-muted-foreground">
            {laatste
              ? `Laatst verstuurd: ${laatste.tijdstip}, ${
                  laatste.aantal === 1 ? "1 training" : `${laatste.aantal} trainingen`
                }.`
              : "Er is nog geen weekmail verstuurd. In de eerste staat alles wat al is afgevinkt."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={verstuur}
          disabled={bezig || !ontvanger}
        >
          {bezig ? "Bezig met versturen…" : "Weekmail nu versturen"}
        </Button>
      </div>
      {ontvanger ? <p className="text-xs text-muted-foreground">{nieuwTekst}</p> : null}
      {melding ? (
        <p
          role={melding.gelukt ? "status" : "alert"}
          className={melding.gelukt ? "text-merk-turquoise" : "text-destructive"}
        >
          {melding.tekst}
        </p>
      ) : null}
    </div>
  );
}
