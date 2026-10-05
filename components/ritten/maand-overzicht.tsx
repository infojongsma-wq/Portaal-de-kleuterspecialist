"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeftRight,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  Pencil,
  Trash2,
} from "lucide-react";

import { verwijderRit } from "@/app/ritten/acties";
import { Afdrukknop } from "@/components/afdrukknop";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { Rit } from "@/lib/data/types";
import {
  formatteerBedrag,
  formatteerDatum,
  formatteerDatumKort,
  formatteerKm,
} from "@/lib/formatteer";
import { maandNaam } from "@/lib/ritten/maand";
import { bedragVanRit, kmVanRit, rittenTotaal } from "@/lib/uren";
import { cn } from "@/lib/utils";

/**
 * De ritten van één maand, met de totalen, en de knoppen om de maand af te
 * drukken of als Excel te downloaden (SPEC.md 6.7). Kan op elk moment, ook
 * halverwege de maand.
 */
export function MaandOverzicht({
  ritten,
  maand,
  vorigeMaand,
  volgendeMaand,
  dezeMaand,
  paginaAdres,
  excelAdres,
  naam,
  thuisadres,
  vergoedingPerKm,
  vandaag,
  magWijzigen,
  geselecteerdeRitId,
  onWijzig,
}: {
  ritten: Rit[];
  maand: string;
  vorigeMaand: string;
  volgendeMaand: string;
  dezeMaand: string;
  /** Het adres van deze pagina voor een andere maand. */
  paginaAdres: (maand: string) => string;
  /** Het adres van de Excel-download van deze maand. */
  excelAdres: string;
  naam: string;
  thuisadres: string | null;
  vergoedingPerKm: number | null;
  vandaag: string;
  magWijzigen: boolean;
  geselecteerdeRitId: string | null;
  onWijzig: (rit: Rit) => void;
}) {
  const router = useRouter();
  const [teVerwijderen, setTeVerwijderen] = React.useState<Rit | null>(null);
  const [melding, setMelding] = React.useState<string | null>(null);

  const totaal = rittenTotaal(ritten);
  const naamVanMaand = maandNaam(maand);

  // Staat er in de hele maand één en dezelfde vergoeding, dan in de kop; anders
  // per rit in de tabel.
  const vergoedingen = [...new Set(ritten.map((rit) => rit.vergoedingPerKm))];
  const vergoedingInKop =
    vergoedingen.length === 1 ? vergoedingen[0] : ritten.length === 0 ? vergoedingPerKm : null;

  async function verwijder() {
    if (!teVerwijderen) return;
    const resultaat = await verwijderRit(teVerwijderen.id);
    setTeVerwijderen(null);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  return (
    <Card className="gap-0 p-0">
      {/* Op papier staat dit al in de kop hieronder. */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="icon" asChild className="afdruk-verbergen">
            <Link href={paginaAdres(vorigeMaand)} aria-label="Vorige maand">
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
          <h2 className="min-w-48 text-center text-lg font-semibold">
            Ritten van {naamVanMaand}
          </h2>
          <Button variant="outline" size="icon" asChild className="afdruk-verbergen">
            <Link href={paginaAdres(volgendeMaand)} aria-label="Volgende maand">
              <ChevronRight aria-hidden />
            </Link>
          </Button>
          {maand !== dezeMaand ? (
            <Button variant="ghost" size="sm" asChild className="afdruk-verbergen">
              <Link href={paginaAdres(dezeMaand)}>Naar deze maand</Link>
            </Button>
          ) : null}
        </div>

        <div className="afdruk-verbergen flex flex-wrap gap-2">
          <Afdrukknop label="Afdrukken" />
          <Button variant="outline" asChild>
            <a href={excelAdres}>
              <FileSpreadsheet aria-hidden />
              Excel downloaden
            </a>
          </Button>
        </div>
      </div>

      {/* Alleen op papier: wie, waar vandaan en tegen welk tarief. */}
      <div className="hidden gap-0.5 px-4 pt-4 text-sm print:grid">
        <p className="text-base font-semibold">Rittenregistratie {naamVanMaand}</p>
        <p>Medewerker: {naam}</p>
        {thuisadres ? <p>Thuisadres: {thuisadres}</p> : null}
        {vergoedingInKop != null ? (
          <p>Vergoeding: {formatteerBedrag(vergoedingInKop)} per km</p>
        ) : null}
        <p>Afgedrukt op {formatteerDatum(vandaag)}</p>
      </div>

      {ritten.length === 0 ? (
        <p className="p-6 text-sm text-muted-foreground">
          Nog geen ritten in {naamVanMaand}.
          {magWijzigen ? " Vul links je eerste rit in." : ""}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28">Datum</TableHead>
              <TableHead>Doel van de rit</TableHead>
              <TableHead>Van – naar</TableHead>
              <TableHead className="text-right">Km</TableHead>
              {vergoedingInKop == null ? (
                <TableHead className="text-right">Per km</TableHead>
              ) : null}
              <TableHead className="text-right">Bedrag</TableHead>
              {magWijzigen ? <TableHead className="afdruk-verbergen w-24" /> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {ritten.map((rit) => (
              <TableRow
                key={rit.id}
                className={cn(
                  rit.id === geselecteerdeRitId && "bg-accent/60 print:bg-transparent",
                )}
              >
                <TableCell className="tabular-nums">
                  <span className="print:hidden">{formatteerDatumKort(rit.datum)}</span>
                  <span className="hidden print:inline">{formatteerDatum(rit.datum)}</span>
                </TableCell>
                <TableCell className="max-w-64 truncate print:max-w-none print:whitespace-normal">
                  {rit.doel}
                </TableCell>
                <TableCell>
                  <span className="inline-flex flex-wrap items-center gap-1.5">
                    {rit.vanPlaats}
                    {rit.heenEnTerug ? (
                      <ArrowLeftRight className="size-3.5 text-muted-foreground" aria-label="heen en terug" />
                    ) : (
                      <ArrowRight className="size-3.5 text-muted-foreground" aria-label="naar" />
                    )}
                    {rit.naarPlaats}
                    {rit.heenEnTerug ? (
                      <span className="text-xs text-muted-foreground">(heen en terug)</span>
                    ) : null}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatteerKm(kmVanRit(rit))}
                </TableCell>
                {vergoedingInKop == null ? (
                  <TableCell className="whitespace-nowrap text-right tabular-nums">
                    {formatteerBedrag(rit.vergoedingPerKm)}
                  </TableCell>
                ) : null}
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatteerBedrag(bedragVanRit(rit))}
                </TableCell>
                {magWijzigen ? (
                  <TableCell className="afdruk-verbergen">
                    <span className="flex justify-end gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Rit van ${formatteerDatum(rit.datum)} wijzigen`}
                        onClick={() => {
                          setMelding(null);
                          onWijzig(rit);
                        }}
                      >
                        <Pencil aria-hidden />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Rit van ${formatteerDatum(rit.datum)} verwijderen`}
                        onClick={() => setTeVerwijderen(rit)}
                      >
                        <Trash2 className="text-destructive" aria-hidden />
                      </Button>
                    </span>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell colSpan={3}>
                Totaal {naamVanMaand} ({totaal.aantal}{" "}
                {totaal.aantal === 1 ? "rit" : "ritten"})
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatteerKm(totaal.km)} km
              </TableCell>
              {vergoedingInKop == null ? <TableCell /> : null}
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatteerBedrag(totaal.bedrag)}
              </TableCell>
              {magWijzigen ? <TableCell className="afdruk-verbergen" /> : null}
            </TableRow>
          </TableFooter>
        </Table>
      )}

      {melding ? (
        <p className="afdruk-verbergen px-4 pb-4 text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}

      <Dialog
        open={teVerwijderen !== null}
        onOpenChange={(open) => {
          if (!open) setTeVerwijderen(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rit verwijderen?</DialogTitle>
            <DialogDescription>
              {teVerwijderen
                ? `${formatteerDatum(teVerwijderen.datum)}: ${teVerwijderen.vanPlaats} naar ${teVerwijderen.naarPlaats}, ${formatteerKm(kmVanRit(teVerwijderen))} km. Dit kun je niet ongedaan maken.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => setTeVerwijderen(null)}>
              Nee, laten staan
            </Button>
            <Button type="button" variant="destructive" onClick={verwijder}>
              Ja, verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
