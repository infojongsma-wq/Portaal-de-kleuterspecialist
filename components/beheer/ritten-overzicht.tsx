import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatteerBedrag, formatteerKm } from "@/lib/formatteer";
import { maandNaam } from "@/lib/ritten/maand";
import type { Rittenmaand } from "@/lib/ritten/overzicht";

/**
 * Ritten in Beheer (SPEC.md 6.6): per maand, per medewerker het aantal
 * ritten, de kilometers en het bedrag, met onderaan het totaal. Per
 * medewerker kun je de ritten bekijken (en daar afdrukken) of de Excel
 * downloaden.
 */
export function RittenOverzicht({
  overzicht,
  maand,
  vorigeMaand,
  volgendeMaand,
  dezeMaand,
  ikId,
}: {
  overzicht: Rittenmaand;
  maand: string;
  vorigeMaand: string;
  volgendeMaand: string;
  dezeMaand: string;
  ikId: string;
}) {
  const naamVanMaand = maandNaam(maand);
  const beheerAdres = (gekozen: string) => `/beheer?ritmaand=${gekozen}#ritten`;
  const rittenAdres = (medewerkerId: string) => {
    const parameters = new URLSearchParams({ maand });
    if (medewerkerId !== ikId) parameters.set("medewerker", medewerkerId);
    return parameters.toString();
  };

  return (
    <div className="grid gap-0">
      <div className="flex flex-wrap items-center gap-2 border-b px-6 pb-4">
        <Button variant="outline" size="icon" asChild>
          <Link href={beheerAdres(vorigeMaand)} aria-label="Vorige maand" scroll={false}>
            <ChevronLeft aria-hidden />
          </Link>
        </Button>
        <span className="min-w-40 text-center font-medium">{naamVanMaand}</span>
        <Button variant="outline" size="icon" asChild>
          <Link href={beheerAdres(volgendeMaand)} aria-label="Volgende maand" scroll={false}>
            <ChevronRight aria-hidden />
          </Link>
        </Button>
        {maand !== dezeMaand ? (
          <Button variant="ghost" size="sm" asChild>
            <Link href={beheerAdres(dezeMaand)} scroll={false}>
              Naar deze maand
            </Link>
          </Button>
        ) : null}
      </div>

      {overzicht.regels.length === 0 ? (
        <p className="px-6 py-4 text-sm text-muted-foreground">
          Er zijn nog geen medewerkers.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Medewerker</TableHead>
              <TableHead className="text-right">Ritten</TableHead>
              <TableHead className="text-right">Km</TableHead>
              <TableHead className="text-right">Bedrag</TableHead>
              <TableHead className="pr-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {overzicht.regels.map((regel) => (
              <TableRow key={regel.id}>
                <TableCell className="pl-6 font-medium">{regel.naam}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {regel.totaal.aantal}
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatteerKm(regel.totaal.km)} km
                </TableCell>
                <TableCell className="whitespace-nowrap text-right tabular-nums">
                  {formatteerBedrag(regel.totaal.bedrag)}
                </TableCell>
                <TableCell className="pr-6">
                  <span className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <Link href={`/ritten?${rittenAdres(regel.id)}`}>
                        <Eye aria-hidden />
                        Bekijken
                      </Link>
                    </Button>
                    <Button variant="outline" size="sm" asChild>
                      <a href={`/ritten/excel?${rittenAdres(regel.id)}`}>
                        <FileSpreadsheet aria-hidden />
                        Excel
                      </a>
                    </Button>
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-semibold">
              <TableCell className="pl-6">Totaal {naamVanMaand}</TableCell>
              <TableCell className="text-right tabular-nums">
                {overzicht.totaal.aantal}
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatteerKm(overzicht.totaal.km)} km
              </TableCell>
              <TableCell className="whitespace-nowrap text-right tabular-nums">
                {formatteerBedrag(overzicht.totaal.bedrag)}
              </TableCell>
              <TableCell className="pr-6" />
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
