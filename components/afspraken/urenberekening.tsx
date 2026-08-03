"use client";

import { AlertTriangle, Info } from "lucide-react";

import { formatteerUren, formatteerUrenKlok } from "@/lib/formatteer";
import { berekenDag, type AfspraakInvoer } from "@/lib/uren";
import type { Instellingen } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * Live urenberekening onder het afspraakformulier (SPEC.md 6.2). Rekent met
 * dezelfde pure functies als de server — daarom staat de rekenlogica in
 * `lib/uren/` en niet in een server action.
 */
export function Urenberekening({
  concept,
  andereAfsprakenOpDezeDag: andereAfspraken,
  instellingen,
}: {
  concept: AfspraakInvoer;
  andereAfsprakenOpDezeDag: AfspraakInvoer[];
  instellingen: Instellingen;
}) {
  const dag = berekenDag({
    datum: concept.datum,
    afspraken: [concept, ...andereAfspraken],
    handmatigeUrenregels: [],
    eigenReistijdUrenPerDag: instellingen.eigenReistijdUrenPerDag,
    maxUrenPerDagWaarschuwing: instellingen.maxUrenPerDagWaarschuwing,
    telwijze: "gepland",
  });

  const voorbereidingOpAndereDag =
    concept.voorbereidingDatum !== concept.datum;

  return (
    <div className="rounded-lg border bg-muted/50 p-4">
      <h3 className="text-sm font-semibold">Urenberekening</h3>

      <dl className="mt-3 space-y-1.5 text-sm">
        <Regel label="Op locatie" uren={dag.urenOpLocatie} />
        <Regel
          label={
            voorbereidingOpAndereDag
              ? "Voorbereiding (op andere dag geboekt)"
              : "Voorbereiding"
          }
          uren={voorbereidingOpAndereDag ? concept.urenVoorbereiding : dag.urenVoorbereiding}
          gedempt={voorbereidingOpAndereDag}
        />
        <Regel
          label={
            dag.langsteEnkeleReisMinuten > 0
              ? `Reistijd (${formatteerUren(dag.brutoReistijdUren)} retour − ${formatteerUren(
                  dag.eigenReistijdUren,
                )} eigen tijd)`
              : "Reistijd"
          }
          uren={dag.reistijdUren}
        />

        <div className="flex items-baseline justify-between border-t pt-2 font-semibold">
          <dt>Totaal deze dag</dt>
          <dd className="tabular-nums">
            {formatteerUren(dag.totaalUren)} uur
            <span className="ml-2 font-normal text-muted-foreground">
              {formatteerUrenKlok(dag.totaalUren)}
            </span>
          </dd>
        </div>
      </dl>

      {voorbereidingOpAndereDag ? (
        <Melding soort="info">
          De voorbereiding van {formatteerUren(concept.urenVoorbereiding)} uur
          wordt op een andere dag geboekt en telt daarom niet mee in dit
          dagtotaal.
        </Melding>
      ) : null}

      {dag.meerdereBestemmingen ? (
        <Melding soort="waarschuwing">
          Meerdere afspraken op deze dag. De reistijd is berekend op basis van de
          verste bestemming — pas handmatig aan als de werkelijke route langer
          was.
        </Melding>
      ) : null}

      {dag.overschrijdtMaximum ? (
        <Melding soort="waarschuwing">
          Meer dan {formatteerUren(instellingen.maxUrenPerDagWaarschuwing)} uur
          op één dag. Dat is boven de grens uit de Arbeidstijdenwet.
        </Melding>
      ) : null}
    </div>
  );
}

function Regel({
  label,
  uren,
  gedempt,
}: {
  label: string;
  uren: number;
  gedempt?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-4",
        gedempt && "text-muted-foreground",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatteerUren(uren)}</dd>
    </div>
  );
}

function Melding({
  soort,
  children,
}: {
  soort: "info" | "waarschuwing";
  children: React.ReactNode;
}) {
  const Pictogram = soort === "waarschuwing" ? AlertTriangle : Info;
  return (
    <p
      className={cn(
        "mt-3 flex items-start gap-1.5 rounded-md p-2 text-xs",
        soort === "waarschuwing"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "bg-background text-muted-foreground",
      )}
    >
      <Pictogram className="mt-px size-3.5 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
