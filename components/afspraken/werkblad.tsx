"use client";

import * as React from "react";

import { AfspraakFormulier } from "@/components/afspraken/afspraak-formulier";
import { Agenda } from "@/components/afspraken/agenda";
import { Trainingslijst } from "@/components/afspraken/trainingslijst";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Activiteitsoort,
  AfspraakMetContext,
  Contactpersoon,
  Klant,
  NietInzetbareDag,
} from "@/lib/data/types";

/**
 * Tweekolomsindeling van het hoofdscherm: links het formulier, rechts de
 * permanente agenda. Deze component houdt bij welke afspraak of datum is
 * aangeklikt en geeft dat door aan het formulier.
 */
export function Werkblad({
  klanten,
  contactpersonen,
  trainingsoorten,
  afspraken,
  nietInzetbareDagen,
}: {
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  trainingsoorten: Activiteitsoort[];
  afspraken: AfspraakMetContext[];
  nietInzetbareDagen: NietInzetbareDag[];
}) {
  const [afspraakId, setAfspraakId] = React.useState<string | null>(null);
  const [gekozenDatum, setGekozenDatum] = React.useState<string | null>(null);

  // Is de afspraak intussen verwijderd, dan levert dit `null` op en toont het
  // formulier vanzelf weer een lege invoer.
  const gekozenAfspraak =
    afspraken.find((afspraak) => afspraak.id === afspraakId) ?? null;

  // De school waar het formulier op staat bepaalt welke trainingslijst er
  // onder de agenda hoort.
  const klantVanFormulier = gekozenAfspraak?.klant ?? null;

  const trainingenVanKlant = klantVanFormulier
    ? afspraken.filter(
        (afspraak) =>
          afspraak.klantId === klantVanFormulier.id &&
          afspraak.status === "gepland",
      )
    : [];

  // Alleen afspraken met een datum kunnen in de agenda staan.
  const inDeAgenda = afspraken.filter((afspraak) => afspraak.datum);

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(420px,520px)_1fr]">
      <Card className="overflow-y-auto p-5">
        <AfspraakFormulier
          klanten={klanten}
          contactpersonen={contactpersonen}
          trainingsoorten={trainingsoorten}
          afspraak={gekozenAfspraak}
          gekozenDatum={gekozenDatum}
          onNieuw={() => {
            setAfspraakId(null);
            setGekozenDatum(null);
          }}
        />
      </Card>

      <div className="flex min-h-0 flex-col gap-5">
        <Card className="min-h-[560px] flex-1 p-4">
          <Agenda
            afspraken={inDeAgenda}
            nietInzetbareDagen={nietInzetbareDagen}
            geselecteerdeAfspraakId={afspraakId}
            onKiesAfspraak={(id) => {
              setAfspraakId(id);
              setGekozenDatum(null);
            }}
            onKiesDatum={(datum) => {
              setAfspraakId(null);
              setGekozenDatum(datum);
            }}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Afgesproken trainingen</CardTitle>
          </CardHeader>
          <CardContent>
            {klantVanFormulier ? (
              <Trainingslijst
                klantId={klantVanFormulier.id}
                klantNaam={klantVanFormulier.naam}
                trainingen={trainingenVanKlant}
                trainingsoorten={trainingsoorten}
                onKiesAfspraak={(id) => {
                  setAfspraakId(id);
                  setGekozenDatum(null);
                }}
                compact
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Klik een afspraak aan in de agenda om te zien wat er verder met
                die school is afgesproken. De volledige lijst per school staat
                bij Klanten.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
