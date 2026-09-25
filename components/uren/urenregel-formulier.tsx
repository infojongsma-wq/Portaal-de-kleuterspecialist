"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Plus, Trash2 } from "lucide-react";

import { bewaarUrenregel, verwijderUrenregel } from "@/app/afspraken/acties";
import { Keuzelijst } from "@/components/ui/keuzelijst";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Datumveld } from "@/components/ui/datumveld";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatteerDatum, formatteerUren } from "@/lib/formatteer";
import { CATEGORIELABELS, HANDMATIGE_CATEGORIEEN } from "@/lib/uren";
import type { AfgeleideUrenregel } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * Uren boeken en terugzien (SPEC.md 6.5).
 *
 * De lijst toont álle uren van de periode: de regels die automatisch uit de
 * afspraken volgen — op locatie, voorbereiding en de reistijd boven het uur —
 * en de regels die de medewerker zelf boekt. Automatische regels zijn niet te
 * bewerken; die verander je door de afspraak zelf aan te passen.
 *
 * Verlof, ziekte en feestdagen zitten er bewust niet bij: die vallen buiten
 * versie 1 (SPEC.md 4.7 en 10).
 */
export function UrenregelFormulier({
  vandaag,
  regels,
}: {
  vandaag: string;
  regels: AfgeleideUrenregel[];
}) {
  const router = useRouter();
  const [datum, setDatum] = React.useState(vandaag);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});

  async function boek(formulier: FormData) {
    setBezig(true);
    const resultaat = await bewaarUrenregel({
      ...Object.fromEntries(formulier),
      datum,
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    setFouten(resultaat.velden ?? {});
    if (resultaat.gelukt) router.refresh();
  }

  async function verwijder(regelId: string) {
    const resultaat = await verwijderUrenregel(regelId);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  const totaal = regels.reduce((som, regel) => som + regel.uren, 0);
  const automatisch = regels
    .filter((regel) => regel.bron === "automatisch")
    .reduce((som, regel) => som + regel.uren, 0);

  return (
    <div className="grid gap-5">
      <form action={boek} className="flex flex-wrap items-end gap-3">
        <div className="grid w-36 gap-1.5">
          <Label htmlFor="regel-datum">Datum</Label>
          <Datumveld id="regel-datum" waarde={datum} onWijzig={setDatum} />
        </div>

        <div className="grid min-w-64 gap-1.5">
          <Label htmlFor="regel-categorie">Categorie</Label>
          <Keuzelijst id="regel-categorie" name="categorie" required>
            {HANDMATIGE_CATEGORIEEN.map((categorie) => (
              <option key={categorie.waarde} value={categorie.waarde}>
                {categorie.label}
              </option>
            ))}
          </Keuzelijst>
          <Fout melding={fouten.categorie} />
        </div>

        <div className="grid w-28 gap-1.5">
          <Label htmlFor="regel-uren">Uren</Label>
          <Input
            id="regel-uren"
            name="uren"
            type="number"
            step="0.25"
            min={0.25}
            max={24}
            defaultValue={1}
            required
          />
          <Fout melding={fouten.uren} />
        </div>

        <div className="grid min-w-56 flex-1 gap-1.5">
          <Label htmlFor="regel-toelichting">Toelichting</Label>
          <Input id="regel-toelichting" name="toelichting" autoComplete="off" />
        </div>

        <Button type="submit" disabled={bezig}>
          <Plus aria-hidden />
          {bezig ? "Bezig…" : "Uren boeken"}
        </Button>
      </form>

      {melding ? (
        <p className="text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}

      {regels.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nog geen uren in deze periode. Uren uit je afspraken verschijnen hier
          vanzelf zodra je een training als gedaan afvinkt.
        </p>
      ) : (
        <>
          <ul className="divide-y rounded-md border">
            {regels.map((regel) => (
              <li
                key={regel.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 text-sm",
                  regel.bron === "automatisch" && "bg-muted/40",
                )}
              >
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {formatteerDatum(regel.datum)}
                </span>

                <span className="flex w-60 shrink-0 items-center gap-2">
                  {CATEGORIELABELS[regel.categorie]}
                  {regel.bron === "automatisch" ? (
                    <Badge
                      variant="outline"
                      className="gap-1 text-[11px] font-normal"
                      title="Volgt uit een afspraak"
                    >
                      <CalendarCheck className="size-3" aria-hidden />
                      afspraak
                    </Badge>
                  ) : null}
                </span>

                <span className="w-16 shrink-0 text-right tabular-nums">
                  {formatteerUren(regel.uren)}
                </span>

                <span className="min-w-0 flex-1 truncate text-muted-foreground">
                  {regel.toelichting}
                </span>

                {regel.bron === "handmatig" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Urenregel van ${formatteerDatum(regel.datum)} verwijderen`}
                    onClick={() => verwijder(regel.id)}
                  >
                    <Trash2 className="text-destructive" aria-hidden />
                  </Button>
                ) : (
                  <span className="size-9 shrink-0" aria-hidden />
                )}
              </li>
            ))}
          </ul>

          <p className="text-sm text-muted-foreground">
            Totaal {formatteerUren(totaal)} uur, waarvan{" "}
            {formatteerUren(automatisch)} uur uit afspraken. Regels met het{" "}
            label &ldquo;afspraak&rdquo; pas je aan door de afspraak zelf te
            wijzigen.
          </p>
        </>
      )}
    </div>
  );
}

function Fout({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {melding}
    </p>
  );
}
