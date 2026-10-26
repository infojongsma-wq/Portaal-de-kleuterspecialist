"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { zetFactuurVerstuurd } from "@/app/beheer/acties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatteerDatum } from "@/lib/formatteer";
import { vandaagInNederland } from "@/lib/ritten/maand";
import type {
  GedaneTraining,
  TrainingenVanMedewerker,
} from "@/lib/trainingen/gedaan";

type Filter = "alles" | "zonder-factuur";

/**
 * Trainingen gedaan in Beheer (SPEC.md 6.6): per medewerker de trainingen op
 * school die als gedaan zijn afgevinkt, met het vinkje "Factuur verstuurd".
 */
export function TrainingenGedaan({
  lijst,
}: {
  lijst: TrainingenVanMedewerker[];
}) {
  const [filter, setFilter] = React.useState<Filter>("alles");

  const zonderFactuur = lijst.reduce(
    (som, medewerker) =>
      som + medewerker.trainingen.filter((t) => !t.factuurVerstuurdOp).length,
    0,
  );

  if (lijst.length === 0) {
    return (
      <p className="px-6 pb-6 text-sm text-muted-foreground">
        Er zijn nog geen medewerkers.
      </p>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-6 pb-4">
        <Button
          type="button"
          size="sm"
          variant={filter === "alles" ? "default" : "outline"}
          aria-pressed={filter === "alles"}
          onClick={() => setFilter("alles")}
        >
          Alles
        </Button>
        <Button
          type="button"
          size="sm"
          variant={filter === "zonder-factuur" ? "default" : "outline"}
          aria-pressed={filter === "zonder-factuur"}
          onClick={() => setFilter("zonder-factuur")}
        >
          Nog geen factuur ({zonderFactuur})
        </Button>
      </div>

      {lijst.map((medewerker) => (
        <MedewerkerBlok key={medewerker.id} medewerker={medewerker} filter={filter} />
      ))}
    </div>
  );
}

function MedewerkerBlok({
  medewerker,
  filter,
}: {
  medewerker: TrainingenVanMedewerker;
  filter: Filter;
}) {
  const totaal = medewerker.trainingen.length;
  const zonderFactuur = medewerker.trainingen.filter(
    (training) => !training.factuurVerstuurdOp,
  ).length;
  const zichtbaar =
    filter === "alles"
      ? medewerker.trainingen
      : medewerker.trainingen.filter((training) => !training.factuurVerstuurdOp);

  return (
    <section className="border-b last:border-b-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-6 pt-4 pb-2">
        <h3 className="font-semibold">{medewerker.naam}</h3>
        <p className="text-sm text-muted-foreground">
          {totaal === 0
            ? "Nog niets afgevinkt"
            : `${totaal} gedaan · ${zonderFactuur} zonder factuur`}
        </p>
      </div>

      {zichtbaar.length === 0 ? (
        <p className="px-6 pb-4 text-sm text-muted-foreground">
          {totaal === 0
            ? "Zodra een training als gedaan is afgevinkt, staat hij hier."
            : "Bij alles is de factuur verstuurd."}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Datum</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Training</TableHead>
              <TableHead className="pr-6">Factuur verstuurd</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {zichtbaar.map((training) => (
              <TrainingRegel key={training.afspraakId} training={training} />
            ))}
          </TableBody>
        </Table>
      )}
    </section>
  );
}

function TrainingRegel({ training }: { training: GedaneTraining }) {
  const router = useRouter();
  // Begint bij wat de database zegt. Na opslaan staat hier dezelfde datum als
  // in de database: die van vandaag.
  const [verstuurdOp, setVerstuurdOp] = React.useState(training.factuurVerstuurdOp);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);

  const datum = training.datum ? formatteerDatum(training.datum) : "zonder datum";
  const vinkId = `factuur-${training.afspraakId}`;

  async function wissel(aan: boolean) {
    const vorige = verstuurdOp;
    // Meteen tonen; terugzetten als het opslaan mislukt.
    setVerstuurdOp(aan ? vandaagInNederland() : null);
    setBezig(true);
    setMelding(null);
    try {
      const resultaat = await zetFactuurVerstuurd({
        afspraakId: training.afspraakId,
        verstuurd: aan,
      });
      if (!resultaat.gelukt) {
        setVerstuurdOp(vorige);
        setMelding(resultaat.melding ?? "Dat ging mis.");
        return;
      }
      router.refresh();
    } catch {
      setVerstuurdOp(vorige);
      setMelding("Het portaal is niet bereikbaar. Probeer het zo nog eens.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap pl-6 tabular-nums align-top">
        {datum}
      </TableCell>
      <TableCell className="align-top">
        <div className="font-medium">{training.school}</div>
        <div className="text-xs text-muted-foreground">{training.plaats}</div>
      </TableCell>
      <TableCell className="align-top">
        <div className="flex flex-wrap items-center gap-2">
          <span>{training.titel}</span>
          {!training.gemeld ? (
            <Badge variant="secondary" title="Staat nog niet in een weekmail">
              Nieuw
            </Badge>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">{training.soort}</div>
      </TableCell>
      <TableCell className="pr-6 align-top">
        <div className="flex items-center gap-2">
          <Checkbox
            id={vinkId}
            checked={verstuurdOp !== null}
            disabled={bezig}
            onCheckedChange={(waarde) => wissel(waarde === true)}
            aria-label={`Factuur verstuurd aan ${training.school}, training van ${datum}`}
          />
          {/* Altijd "Ja" naast het vakje: aanvinken betekent "ja, verstuurd". */}
          <label htmlFor={vinkId} className="text-sm whitespace-nowrap">
            Ja
            {verstuurdOp !== null ? (
              <span className="text-muted-foreground">
                , {formatteerDatum(verstuurdOp)}
              </span>
            ) : null}
          </label>
        </div>
        {melding ? (
          <p role="alert" className="mt-1 text-xs text-destructive">
            {melding}
          </p>
        ) : null}
      </TableCell>
    </TableRow>
  );
}
