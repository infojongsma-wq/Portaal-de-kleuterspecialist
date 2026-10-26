"use client";

import * as React from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

import { Agenda } from "@/components/afspraken/agenda";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { formatteerTijd } from "@/lib/formatteer";
import type {
  AfspraakMetContext,
  NietInzetbareDag,
} from "@/lib/data/types";

export interface AgendaMedewerker {
  id: string;
  naam: string;
  voornaam: string;
  kleur: string;
}

const STATUSLABELS: Record<AfspraakMetContext["status"], string> = {
  gepland: "Gepland",
  voltooid: "Gedaan",
  geannuleerd: "Geannuleerd",
  verzet: "Verzet",
};

/**
 * Agenda medewerkers in Beheer (SPEC.md 6.6): de afspraken van alle
 * medewerkers in één agenda, elke medewerker in een eigen kleur en aan en uit
 * te zetten. Klikken toont de details. Alleen bekijken; wijzigen doet de
 * medewerker zelf.
 */
export function MedewerkersAgenda({
  medewerkers,
  afspraken,
  nietInzetbareDagen,
}: {
  medewerkers: AgendaMedewerker[];
  afspraken: AfspraakMetContext[];
  nietInzetbareDagen: NietInzetbareDag[];
}) {
  const [verborgen, setVerborgen] = React.useState<Set<string>>(new Set());
  const [gekozenId, setGekozenId] = React.useState<string | null>(null);

  const perId = React.useMemo(
    () => new Map(medewerkers.map((medewerker) => [medewerker.id, medewerker])),
    [medewerkers],
  );

  const zichtbaar = React.useMemo(
    () =>
      afspraken.filter(
        (afspraak) => afspraak.datum && !verborgen.has(afspraak.medewerkerId),
      ),
    [afspraken, verborgen],
  );

  const kleurVan = React.useCallback(
    (afspraak: AfspraakMetContext) =>
      perId.get(afspraak.medewerkerId)?.kleur ?? "#78716c",
    [perId],
  );

  const titelVan = React.useCallback(
    (afspraak: AfspraakMetContext) => {
      const wie = perId.get(afspraak.medewerkerId)?.voornaam;
      const wat = afspraak.klant
        ? `${afspraak.klant.naam} — ${afspraak.titel}`
        : afspraak.titel;
      const gedaan = afspraak.status === "voltooid" ? "✓ " : "";
      return wie ? `${gedaan}${wie}: ${wat}` : `${gedaan}${wat}`;
    },
    [perId],
  );

  const gekozen =
    zichtbaar.find((afspraak) => afspraak.id === gekozenId) ?? null;

  function wissel(medewerkerId: string, tonen: boolean) {
    setVerborgen((vorige) => {
      const volgende = new Set(vorige);
      if (tonen) volgende.delete(medewerkerId);
      else volgende.add(medewerkerId);
      return volgende;
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[320px_1fr]">
      <div className="grid content-start gap-5">
        <Card>
          <CardHeader>
            <CardTitle>Medewerkers</CardTitle>
          </CardHeader>
          <CardContent>
            {medewerkers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Er zijn nog geen medewerkers.
              </p>
            ) : (
              <ul className="grid gap-2.5">
                {medewerkers.map((medewerker) => {
                  const id = `toon-${medewerker.id}`;
                  return (
                    <li key={medewerker.id} className="flex items-center gap-2.5">
                      <Checkbox
                        id={id}
                        checked={!verborgen.has(medewerker.id)}
                        onCheckedChange={(waarde) =>
                          wissel(medewerker.id, waarde === true)
                        }
                      />
                      <span
                        aria-hidden
                        className="size-3 shrink-0 rounded-sm"
                        style={{ backgroundColor: medewerker.kleur }}
                      />
                      <label htmlFor={id} className="text-sm">
                        {medewerker.naam}
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Afspraak</CardTitle>
          </CardHeader>
          <CardContent>
            {gekozen ? (
              <Details
                afspraak={gekozen}
                medewerker={perId.get(gekozen.medewerkerId) ?? null}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Klik een afspraak aan in de agenda om te zien wat er is
                afgesproken. Wijzigen doet de medewerker zelf, in de eigen
                agenda.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="h-[640px] p-4 xl:h-[calc(100vh-11rem)] xl:min-h-[560px]">
        <Agenda
          afspraken={zichtbaar}
          nietInzetbareDagen={nietInzetbareDagen}
          geselecteerdeAfspraakId={gekozen?.id ?? null}
          onKiesAfspraak={setGekozenId}
          kleurVan={kleurVan}
          titelVan={titelVan}
        />
      </Card>
    </div>
  );
}

function dagdelenTekst(afspraak: AfspraakMetContext): string {
  const delen = afspraak.dagdelen;
  if (delen.includes("anders")) return afspraak.andersOmschrijving ?? "Anders";
  if (delen.includes("ochtend") && delen.includes("middag")) return "Hele dag";
  if (delen.includes("ochtend")) return "Ochtend";
  if (delen.includes("middag")) return "Middag";
  return "";
}

function Details({
  afspraak,
  medewerker,
}: {
  afspraak: AfspraakMetContext;
  medewerker: AgendaMedewerker | null;
}) {
  const datum = afspraak.datum
    ? format(new Date(`${afspraak.datum}T12:00:00`), "EEEE d MMMM yyyy", {
        locale: nl,
      })
    : "nog in te plannen";
  const tijd = afspraak.starttijd
    ? `${formatteerTijd(afspraak.starttijd)}${
        afspraak.eindtijd ? `–${formatteerTijd(afspraak.eindtijd)}` : ""
      }`
    : dagdelenTekst(afspraak);

  const regels: [string, React.ReactNode][] = [
    [
      "Medewerker",
      medewerker ? (
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-3 rounded-sm"
            style={{ backgroundColor: medewerker.kleur }}
          />
          {medewerker.naam}
        </span>
      ) : (
        "—"
      ),
    ],
    ["Soort", afspraak.activiteitsoort.naam],
    ["Datum", datum],
    ["Tijd", tijd || "—"],
    ["Status", STATUSLABELS[afspraak.status]],
  ];

  if (afspraak.klant) {
    regels.push([
      "School",
      `${afspraak.klant.naam}, ${afspraak.klant.plaats}`,
    ]);
  }
  if (afspraak.contactpersoon) {
    regels.push(["Contactpersoon", afspraak.contactpersoon.naam]);
  }

  return (
    <div className="grid gap-3 text-sm">
      <p className="font-semibold">{afspraak.titel}</p>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
        {regels.map(([label, waarde]) => (
          <React.Fragment key={label}>
            <dt className="text-muted-foreground">{label}</dt>
            <dd>{waarde}</dd>
          </React.Fragment>
        ))}
      </dl>
      {afspraak.afsprakenMetKlant ? (
        <div>
          <p className="text-muted-foreground">Afspraken met de school</p>
          <p className="whitespace-pre-line">{afspraak.afsprakenMetKlant}</p>
        </div>
      ) : null}
      {afspraak.notitie ? (
        <div>
          <p className="text-muted-foreground">Notitie</p>
          <p className="whitespace-pre-line">{afspraak.notitie}</p>
        </div>
      ) : null}
    </div>
  );
}
