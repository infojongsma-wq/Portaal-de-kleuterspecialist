"use client";

import * as React from "react";

import { AfspraakFormulier } from "@/components/afspraken/afspraak-formulier";
import { Agenda } from "@/components/afspraken/agenda";
import { Card } from "@/components/ui/card";
import type {
  Activiteitsoort,
  AfspraakMetContext,
  Contactpersoon,
  Instellingen,
  Klant,
  NietInzetbareDag,
} from "@/lib/data/types";
import type { AfspraakInvoer } from "@/lib/uren";

/**
 * Tweekolomsindeling van het hoofdscherm (SPEC.md 6.2): links het formulier,
 * rechts de permanente agenda. Deze component houdt bij welke afspraak of
 * datum is aangeklikt en geeft dat door aan het formulier.
 */
export function Werkblad({
  klanten,
  contactpersonen,
  activiteitsoorten,
  instellingen,
  afspraken,
  nietInzetbareDagen,
}: {
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  activiteitsoorten: Activiteitsoort[];
  instellingen: Instellingen;
  afspraken: AfspraakMetContext[];
  nietInzetbareDagen: NietInzetbareDag[];
}) {
  const [afspraakId, setAfspraakId] = React.useState<string | null>(null);
  const [gekozenDatum, setGekozenDatum] = React.useState<string | null>(null);

  const gekozenAfspraak =
    afspraken.find((afspraak) => afspraak.id === afspraakId) ?? null;

  // De afspraak kan intussen zijn verwijderd; dan terug naar een leeg formulier.
  React.useEffect(() => {
    if (afspraakId && !gekozenAfspraak) setAfspraakId(null);
  }, [afspraakId, gekozenAfspraak]);

  const alleAfspraken = React.useMemo<AfspraakInvoer[]>(
    () =>
      afspraken.map((afspraak) => ({
        id: afspraak.id,
        datum: afspraak.datum,
        voorbereidingDatum: afspraak.voorbereidingDatum,
        urenOpLocatie: afspraak.urenOpLocatie,
        urenVoorbereiding: afspraak.urenVoorbereiding,
        reistijdEnkelMinuten: afspraak.reistijdEnkelMinuten,
        status: afspraak.status,
        voorbereidingGedaan: afspraak.voorbereidingGedaan,
      })),
    [afspraken],
  );

  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-5 p-5 xl:grid-cols-[minmax(420px,520px)_1fr]">
      <Card className="overflow-y-auto p-5">
        <AfspraakFormulier
          klanten={klanten}
          contactpersonen={contactpersonen}
          activiteitsoorten={activiteitsoorten}
          instellingen={instellingen}
          afspraak={gekozenAfspraak}
          alleAfspraken={alleAfspraken}
          gekozenDatum={gekozenDatum}
          onNieuw={() => {
            setAfspraakId(null);
            setGekozenDatum(null);
          }}
        />
      </Card>

      <Card className="min-h-[640px] p-4">
        <Agenda
          afspraken={afspraken}
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
    </div>
  );
}
