import Link from "next/link";
import { Mail, MapPin, Phone, Route } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Trainingslijst } from "@/components/afspraken/trainingslijst";
import {
  haalAfgesprokenTrainingen,
  haalAfsprakenVoorKlant,
  haalContactpersonen,
  haalKlanten,
  haalTrainingsoorten,
} from "@/lib/data/queries";
import { formatteerDatum, formatteerMinuten } from "@/lib/formatteer";
import type { AfspraakMetContext } from "@/lib/data/types";
import { cn } from "@/lib/utils";

export const metadata = { title: "Klanten · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

function tekst(waarde: string | string[] | undefined): string {
  return Array.isArray(waarde) ? (waarde[0] ?? "") : (waarde ?? "");
}

/** Klantenscherm met zoekveld en klantkaart (SPEC.md 6.4). */
export default async function KlantenPagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parameters = await searchParams;
  const zoekterm = tekst(parameters.zoek).trim();
  const gekozenId = tekst(parameters.klant);

  const alleKlanten = haalKlanten();
  const gevonden =
    zoekterm.length >= 2
      ? alleKlanten.filter(
          (klant) =>
            klant.naam.toLowerCase().includes(zoekterm.toLowerCase()) ||
            klant.plaats.toLowerCase().includes(zoekterm.toLowerCase()),
        )
      : alleKlanten;

  const gekozen =
    alleKlanten.find((klant) => klant.id === gekozenId) ?? gevonden[0] ?? null;

  const afspraken = gekozen ? haalAfsprakenVoorKlant(gekozen.id) : [];
  const afgesproken = gekozen ? haalAfgesprokenTrainingen(gekozen.id) : [];
  const uitgevoerd = afspraken
    .filter((a) => a.status === "voltooid")
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));
  const aantekeningen = afspraken
    .filter((a) => a.afsprakenMetKlant || a.notitie)
    .sort((a, b) => (b.datum ?? "").localeCompare(a.datum ?? ""));

  return (
    <Pagina
      titel="Klanten"
      omschrijving="Scholen, contactpersonen en wat er is afgesproken."
      acties={
        <Button asChild>
          <Link href="/afspraken">Nieuwe afspraak inplannen</Link>
        </Button>
      }
    >
      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        <div className="flex flex-col gap-3">
          <form method="get">
            <Input
              name="zoek"
              defaultValue={zoekterm}
              placeholder="Zoek op naam of plaats…"
              aria-label="Zoek een school"
            />
          </form>

          <Card className="overflow-hidden p-0">
            <ul className="divide-y">
              {gevonden.length === 0 ? (
                <li className="p-4 text-sm text-muted-foreground">
                  Geen school gevonden.
                </li>
              ) : (
                gevonden.map((klant) => (
                  <li key={klant.id}>
                    <Link
                      href={`/klanten?klant=${klant.id}${zoekterm ? `&zoek=${encodeURIComponent(zoekterm)}` : ""}`}
                      className={cn(
                        "block px-4 py-3 text-sm transition-colors hover:bg-accent",
                        gekozen?.id === klant.id && "bg-secondary",
                      )}
                    >
                      <span className="font-medium">{klant.naam}</span>
                      <span className="block text-muted-foreground">
                        {klant.plaats}
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </Card>
        </div>

        {gekozen ? (
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl">{gekozen.naam}</CardTitle>
                <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" aria-hidden />
                    {[gekozen.adres, gekozen.postcode, gekozen.plaats]
                      .filter(Boolean)
                      .join(", ")}
                  </span>
                  {gekozen.telefoonAlgemeen ? (
                    <span className="flex items-center gap-1.5">
                      <Phone className="size-4" aria-hidden />
                      {gekozen.telefoonAlgemeen}
                    </span>
                  ) : null}
                  {gekozen.emailAlgemeen ? (
                    <span className="flex items-center gap-1.5">
                      <Mail className="size-4" aria-hidden />
                      {gekozen.emailAlgemeen}
                    </span>
                  ) : null}
                  {gekozen.reistijdEnkelMinuten != null ? (
                    <span className="flex items-center gap-1.5">
                      <Route className="size-4" aria-hidden />
                      {formatteerMinuten(gekozen.reistijdEnkelMinuten)} enkele
                      reis
                      {gekozen.reisafstandEnkelKm != null
                        ? ` · ${gekozen.reisafstandEnkelKm.toLocaleString("nl-NL")} km`
                        : ""}
                    </span>
                  ) : null}
                </div>
              </CardHeader>
              {gekozen.notitie ? (
                <CardContent>
                  <p className="rounded-md bg-muted p-3 text-sm">
                    {gekozen.notitie}
                  </p>
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Contactpersonen</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3">
                {haalContactpersonen(gekozen.id).length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog geen contactpersonen vastgelegd.
                  </p>
                ) : (
                  haalContactpersonen(gekozen.id).map((persoon) => (
                    <div
                      key={persoon.id}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="font-medium">{persoon.naam}</span>
                      {persoon.isPrimair ? (
                        <Badge variant="secondary">Primair</Badge>
                      ) : null}
                      {persoon.functie ? (
                        <span className="text-muted-foreground">
                          {persoon.functie}
                        </span>
                      ) : null}
                      {persoon.email ? (
                        <span className="text-muted-foreground">
                          {persoon.email}
                        </span>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Afgesproken trainingen</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Wat er met deze school is afgesproken. Vul een datum in om een
                  training in te plannen; die verschijnt dan in de agenda en
                  telt mee in de uren.
                </p>
              </CardHeader>
              <CardContent>
                <Trainingslijst
                  klantId={gekozen.id}
                  klantNaam={gekozen.naam}
                  trainingen={afgesproken}
                  trainingsoorten={haalTrainingsoorten()}
                />
              </CardContent>
            </Card>

            <AfsprakenLijst
              titel="Uitgevoerde trainingen"
              afspraken={uitgevoerd}
              leegtekst="Er is nog niets uitgevoerd."
            />

            <Card>
              <CardHeader>
                <CardTitle>Afspraken en notities uit eerdere bezoeken</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                {aantekeningen.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Nog niets vastgelegd.
                  </p>
                ) : (
                  aantekeningen.map((afspraak, positie) => (
                    <div key={afspraak.id} className="grid gap-1.5 text-sm">
                      {positie > 0 ? <Separator className="mb-3" /> : null}
                      <p className="font-medium">
                        {afspraak.datum
                          ? formatteerDatum(afspraak.datum)
                          : "Nog in te plannen"}{" "}
                        — {afspraak.titel}
                      </p>
                      {afspraak.afsprakenMetKlant ? (
                        <p>{afspraak.afsprakenMetKlant}</p>
                      ) : null}
                      {afspraak.notitie ? (
                        <p className="text-muted-foreground">
                          {afspraak.notitie}
                        </p>
                      ) : null}
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          <Card className="flex items-center justify-center p-12 text-sm text-muted-foreground">
            Kies een school om de gegevens te zien.
          </Card>
        )}
      </div>
    </Pagina>
  );
}

function AfsprakenLijst({
  titel,
  afspraken,
  leegtekst,
}: {
  titel: string;
  afspraken: AfspraakMetContext[];
  leegtekst: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{titel}</CardTitle>
      </CardHeader>
      <CardContent>
        {afspraken.length === 0 ? (
          <p className="text-sm text-muted-foreground">{leegtekst}</p>
        ) : (
          <ul className="grid gap-2.5 text-sm">
            {afspraken.map((afspraak) => (
              <li key={afspraak.id} className="flex items-baseline gap-3">
                <span className="w-24 shrink-0 tabular-nums text-muted-foreground">
                  {afspraak.datum ? formatteerDatum(afspraak.datum) : "—"}
                </span>
                <span>
                  {afspraak.titel}
                  <span className="text-muted-foreground">
                    {" "}
                    · {afspraak.activiteitsoort.naam}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
