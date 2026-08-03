"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";

import { bewaarUrenregel, verwijderUrenregel } from "@/app/afspraken/acties";
import { Keuzelijst } from "@/components/pagina";
import { Button } from "@/components/ui/button";
import { Datumveld } from "@/components/ui/datumveld";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatteerDatum, formatteerUren } from "@/lib/formatteer";
import type { Urenregel } from "@/lib/data/types";

const CATEGORIEEN = [
  { waarde: "administratie", label: "Administratie" },
  { waarde: "overleg", label: "Overleg" },
  { waarde: "scholing", label: "Scholing" },
  { waarde: "acquisitie", label: "Acquisitie" },
  { waarde: "reistijd", label: "Reistijd zonder klantbezoek" },
  { waarde: "overig", label: "Overig" },
] as const;

/**
 * Handmatige urenregels boeken en verwijderen (SPEC.md 6.5).
 * Verlof, ziekte en feestdagen staan er bewust niet bij: die vallen buiten
 * versie 1 (SPEC.md 4.7 en 10).
 */
export function UrenregelFormulier({
  vandaag,
  regels,
}: {
  vandaag: string;
  regels: Urenregel[];
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

  return (
    <div className="grid gap-5">
      <form action={boek} className="flex flex-wrap items-end gap-3">
        <div className="grid w-36 gap-1.5">
          <Label htmlFor="regel-datum">Datum</Label>
          <Datumveld id="regel-datum" waarde={datum} onWijzig={setDatum} />
        </div>

        <div className="grid min-w-56 gap-1.5">
          <Label htmlFor="regel-categorie">Categorie</Label>
          <Keuzelijst id="regel-categorie" name="categorie" required>
            {CATEGORIEEN.map((categorie) => (
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

        <div className="grid min-w-64 flex-1 gap-1.5">
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
        <p className="text-sm text-muted-foreground">
          Nog geen handmatige uren geboekt.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {regels.map((regel) => (
            <li
              key={regel.id}
              className="flex items-center gap-4 px-4 py-2.5 text-sm"
            >
              <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                {formatteerDatum(regel.datum)}
              </span>
              <span className="w-48 shrink-0">
                {CATEGORIEEN.find((c) => c.waarde === regel.categorie)?.label ??
                  regel.categorie}
              </span>
              <span className="w-16 shrink-0 text-right tabular-nums">
                {formatteerUren(regel.uren)}
              </span>
              <span className="flex-1 text-muted-foreground">
                {regel.toelichting}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Urenregel van ${formatteerDatum(regel.datum)} verwijderen`}
                onClick={() => verwijder(regel.id)}
              >
                <Trash2 className="text-destructive" aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
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
