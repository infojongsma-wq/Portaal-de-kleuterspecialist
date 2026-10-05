"use client";

import * as React from "react";
import { Eye } from "lucide-react";

import { MaandOverzicht } from "@/components/ritten/maand-overzicht";
import { RitFormulier } from "@/components/ritten/rit-formulier";
import {
  ThuisadresKaart,
  thuisadresInEenRegel,
  type Thuisadres,
} from "@/components/ritten/thuisadres-kaart";
import { Card, CardContent } from "@/components/ui/card";
import type { Rit } from "@/lib/data/types";
import type { School } from "@/lib/ritten/plaatsen";

/**
 * Indeling van het tabblad Ritten (SPEC.md 6.7): links het thuisadres en het
 * formulier, rechts de ritten van de gekozen maand. Deze component houdt bij
 * welke rit er wordt gewijzigd.
 *
 * Bekijkt de beheerder de ritten van iemand anders, dan staat links alleen
 * uitleg: wijzigen doet de medewerker zelf, net als bij de afspraken.
 */
export function RittenWerkblad({
  naam,
  voornaam,
  thuis,
  magWijzigen,
  maandRitten,
  eerderGebruikt,
  scholen,
  maand,
  vorigeMaand,
  volgendeMaand,
  dezeMaand,
  medewerkerParameter,
  vergoedingPerKm,
  vandaag,
}: {
  naam: string;
  voornaam: string;
  thuis: Thuisadres;
  magWijzigen: boolean;
  maandRitten: Rit[];
  eerderGebruikt: string[];
  scholen: School[];
  maand: string;
  vorigeMaand: string;
  volgendeMaand: string;
  dezeMaand: string;
  /** Alleen bij de beheerder die iemand anders bekijkt. */
  medewerkerParameter: string | null;
  vergoedingPerKm: number | null;
  vandaag: string;
}) {
  const [teWijzigen, setTeWijzigen] = React.useState<Rit | null>(null);

  // Is de rit intussen verwijderd, of staat er een andere maand, dan valt hij
  // weg en toont het formulier weer een nieuwe rit.
  const gekozenRit =
    maandRitten.find((rit) => rit.id === teWijzigen?.id) ?? null;

  const zoekreeks = (gekozenMaand: string) => {
    const parameters = new URLSearchParams({ maand: gekozenMaand });
    if (medewerkerParameter) parameters.set("medewerker", medewerkerParameter);
    return parameters.toString();
  };

  const thuisOmschrijving = thuisadresInEenRegel(thuis);

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(400px,480px)_1fr] print:block">
      <div className="afdruk-verbergen grid content-start gap-5">
        {magWijzigen ? (
          <>
            <ThuisadresKaart thuis={thuis} />
            <Card className="p-5">
              <RitFormulier
                rit={gekozenRit}
                vandaag={vandaag}
                eerderGebruikt={eerderGebruikt}
                scholen={scholen}
                thuis={thuis}
                vergoedingPerKm={vergoedingPerKm}
                onKlaar={() => setTeWijzigen(null)}
              />
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="grid gap-2 pt-6 text-sm">
              <p className="flex items-center gap-2 font-medium">
                <Eye className="size-4" aria-hidden />
                Je bekijkt de ritten van {naam}.
              </p>
              <p className="text-muted-foreground">
                Afdrukken en de Excel downloaden kan hier gewoon. Wijzigen doet{" "}
                {voornaam} zelf.
              </p>
              <p className="text-muted-foreground">
                Thuisadres: {thuisOmschrijving ?? "nog niet ingesteld"}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      <MaandOverzicht
        ritten={maandRitten}
        maand={maand}
        vorigeMaand={vorigeMaand}
        volgendeMaand={volgendeMaand}
        dezeMaand={dezeMaand}
        paginaAdres={(gekozenMaand) => `/ritten?${zoekreeks(gekozenMaand)}`}
        excelAdres={`/ritten/excel?${zoekreeks(maand)}`}
        naam={naam}
        thuisadres={thuisOmschrijving}
        vergoedingPerKm={vergoedingPerKm}
        vandaag={vandaag}
        magWijzigen={magWijzigen}
        geselecteerdeRitId={gekozenRit?.id ?? null}
        onWijzig={setTeWijzigen}
      />
    </div>
  );
}
