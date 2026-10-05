import { Pagina } from "@/components/pagina";
import { MedewerkerKiezer } from "@/components/ritten/medewerker-kiezer";
import { RittenWerkblad } from "@/components/ritten/ritten-werkblad";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rittenset, rittenVan } from "@/lib/data/ritten";
import { werkset } from "@/lib/data/werkset";
import {
  inMaand,
  isMaand,
  maandVan,
  vandaagInNederland,
  verschuifMaand,
} from "@/lib/ritten/maand";
import { eerderGebruiktePlaatsen } from "@/lib/ritten/plaatsen";

export const metadata = { title: "Ritten · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

/**
 * Rittenregistratie (SPEC.md 6.7): ritten invoeren, per maand bekijken,
 * afdrukken en als Excel downloaden.
 *
 * Een medewerker ziet en wijzigt alleen de eigen ritten. De beheerder kiest
 * bovenaan van wie hij de ritten bekijkt.
 */
export default async function RittenPagina({
  searchParams,
}: {
  searchParams: Promise<{ maand?: string; medewerker?: string }>;
}) {
  const parameters = await searchParams;
  const [gegevens, ritten] = await Promise.all([werkset(), rittenset()]);
  const { ik } = gegevens;
  const isBeheerder = ik.rol === "beheerder";

  const bekeken =
    (isBeheerder &&
      gegevens.profielen.find((profiel) => profiel.id === parameters.medewerker)) ||
    ik;
  const magWijzigen = bekeken.id === ik.id;
  const naam = `${bekeken.voornaam} ${bekeken.achternaam}`.trim();

  const vandaag = vandaagInNederland();
  const dezeMaand = maandVan(vandaag);
  const maand = isMaand(parameters.maand) ? parameters.maand : dezeMaand;

  const vanBekeken = rittenVan(ritten.ritten, bekeken.id);
  const maandRitten = vanBekeken.filter((rit) => inMaand(rit.datum, maand));

  const medewerkers = gegevens.profielen
    .filter((profiel) => profiel.actief || profiel.id === bekeken.id)
    .map((profiel) => ({
      id: profiel.id,
      naam: `${profiel.voornaam} ${profiel.achternaam}`.trim(),
    }))
    .sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return (
    <Pagina
      titel="Ritten"
      omschrijving="Houd hier je gereden kilometers bij. Per maand kun je ze afdrukken of als Excel downloaden, ook halverwege de maand."
      acties={
        isBeheerder ? (
          <MedewerkerKiezer
            medewerkers={medewerkers}
            gekozenId={bekeken.id}
            eigenId={ik.id}
            maand={maand}
          />
        ) : undefined
      }
    >
      {ritten.beschikbaar ? (
        <RittenWerkblad
          naam={naam}
          voornaam={bekeken.voornaam}
          thuis={{
            adres: bekeken.standplaatsAdres,
            postcode: bekeken.standplaatsPostcode,
            plaats: bekeken.standplaatsPlaats,
          }}
          magWijzigen={magWijzigen}
          maandRitten={maandRitten}
          eerderGebruikt={eerderGebruiktePlaatsen(vanBekeken)}
          maand={maand}
          vorigeMaand={verschuifMaand(maand, -1)}
          volgendeMaand={verschuifMaand(maand, 1)}
          dezeMaand={dezeMaand}
          medewerkerParameter={magWijzigen ? null : bekeken.id}
          vergoedingPerKm={gegevens.instellingen.kilometervergoedingPerKm}
          vandaag={vandaag}
        />
      ) : (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Nog één stap</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            {isBeheerder ? (
              <>
                <p>
                  De rittenregistratie staat nog niet in de database. Draai in
                  Supabase, bij SQL Editor, het bestand{" "}
                  <code className="rounded bg-muted px-1">
                    supabase/migrations/20261005120000_ritten.sql
                  </code>
                  . PUBLICEREN.md legt stap voor stap uit hoe.
                </p>
                <p className="text-muted-foreground">
                  Daarna werkt dit tabblad meteen; opnieuw publiceren is niet
                  nodig.
                </p>
              </>
            ) : (
              <p>
                De rittenregistratie wordt nog ingericht. Vraag de beheerder om
                de laatste stap te doen.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </Pagina>
  );
}
