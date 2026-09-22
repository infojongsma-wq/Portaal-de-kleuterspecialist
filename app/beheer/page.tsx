import { Lock } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { MedewerkersBeheer } from "@/components/beheer/medewerkers-beheer";
import { SoortenBeheer } from "@/components/beheer/soorten-beheer";
import { Voortgangsbalk } from "@/components/uren/voortgangsbalk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableRow } from "@/components/ui/table";
import {
  haalAlleActiviteitsoorten,
  haalContract,
  haalInstellingen,
  haalNietInzetbareDagen,
  haalProfielen,
  huidigeMedewerker,
  isBeheerder,
  jaarnormBalans,
  urenPerCategorie,
} from "@/lib/data/queries";
import {
  formatteerBedrag,
  formatteerDatum,
  formatteerUren,
  naarIsoDatum,
} from "@/lib/formatteer";
import { CATEGORIELABELS } from "@/lib/uren";

export const metadata = { title: "Beheer · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

/** Beheerdersportaal (SPEC.md 6.6). */
export default async function BeheerPagina() {
  const nu = new Date();
  const vandaag = naarIsoDatum(nu);
  const jaar = nu.getFullYear();
  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  const beheerder = await isBeheerder();

  if (!beheerder) {
    return (
      <Pagina titel="Beheer">
        <Card className="p-6 text-sm text-muted-foreground">
          Dit scherm is alleen voor de beheerder.
        </Card>
      </Pagina>
    );
  }

  const [ik, instellingen, profielen, nietInzetbareDagen, soorten] =
    await Promise.all([
      huidigeMedewerker(),
      haalInstellingen(),
      haalProfielen(),
      haalNietInzetbareDagen(),
      haalAlleActiviteitsoorten(),
    ]);

  // Alles per medewerker vooraf ophalen; in de opmaak zelf valt niet te wachten.
  const medewerkers = await Promise.all(
    profielen
      .filter((profiel) => profiel.rol === "medewerker")
      .map(async (medewerker) => ({
        profiel: medewerker,
        balans: await jaarnormBalans(medewerker.id, jaar, vandaag),
        contract: await haalContract(medewerker.id, vandaag),
        categorieen: await urenPerCategorie(
          medewerker.id,
          jaarStart,
          jaarEind,
          "gerealiseerd",
        ),
      })),
  );

  const contractenVanIedereen = await Promise.all(
    profielen.map(async (profiel) => ({
      profiel,
      contract: await haalContract(profiel.id, vandaag),
    })),
  );

  // De fulltimenorm hoort uit de database te komen, niet uit de code. Is er nog
  // geen enkel contract, dan valt er ook geen jaarnorm te tonen.
  const normUitContracten =
    contractenVanIedereen.find((regel) => regel.contract)?.contract
      ?.normFulltime ?? null;

  const perJaar = new Map<number, number>();
  for (const dag of nietInzetbareDagen) {
    const dagJaar = Number(dag.datum.slice(0, 4));
    perJaar.set(dagJaar, (perJaar.get(dagJaar) ?? 0) + 1);
  }

  return (
    <Pagina
      titel="Beheer"
      omschrijving="Medewerkers, urenverantwoording en stamgegevens."
    >
      <div className="grid gap-5">
        {/* Urenverantwoording per medewerker */}
        {medewerkers.map(({ profiel, balans, contract, categorieen }) => {
          const totaalCategorieen = categorieen.reduce(
            (som, regel) => som + regel.uren,
            0,
          );

          return (
            <Card key={profiel.id}>
              <CardHeader>
                <CardTitle>
                  Urenverantwoording {jaar} — {profiel.voornaam}{" "}
                  {profiel.achternaam}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {contract
                    ? `${formatteerUren(contract.urenPerWeek)} uur per week vanaf ${formatteerDatum(contract.ingangsdatum)} · fulltimenorm ${formatteerUren(contract.normFulltime)} uur`
                    : "Nog geen contract vastgelegd."}
                </p>
              </CardHeader>

              <CardContent className="grid gap-6">
                {balans ? (
                  <>
                    <Voortgangsbalk
                      gerealiseerd={balans.gerealiseerdeUren}
                      norm={balans.normPeriode}
                    />

                    <div className="grid gap-6 lg:grid-cols-2">
                      <div>
                        <h3 className="mb-2 text-sm font-semibold">
                          Gepland versus gerealiseerd
                        </h3>
                        <Table>
                          <TableBody>
                            <TableRow>
                              <TableCell>Gepland</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatteerUren(balans.geplandeUren)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Gerealiseerd</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatteerUren(balans.gerealiseerdeUren)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell>Jaarnorm</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatteerUren(balans.normPeriode)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">
                                {balans.nogTeGaan >= 0
                                  ? "Nog te gaan"
                                  : "Boven de norm"}
                              </TableCell>
                              <TableCell
                                className={`text-right font-medium tabular-nums ${
                                  balans.nogTeGaan >= 0
                                    ? "text-merk-turquoise"
                                    : "text-amber-600"
                                }`}
                              >
                                {formatteerUren(Math.abs(balans.nogTeGaan))}
                              </TableCell>
                            </TableRow>
                          </TableBody>
                        </Table>
                      </div>

                      <div>
                        <h3 className="mb-2 text-sm font-semibold">
                          Uitsplitsing per categorie (gerealiseerd)
                        </h3>
                        {categorieen.length === 0 ? (
                          <p className="text-sm text-muted-foreground">
                            Nog geen gerealiseerde uren dit jaar.
                          </p>
                        ) : (
                          <ul className="grid gap-1.5">
                            {categorieen.map((regel) => (
                              <li key={regel.categorie} className="text-sm">
                                <div className="flex justify-between gap-4">
                                  <span>{CATEGORIELABELS[regel.categorie]}</span>
                                  <span className="tabular-nums">
                                    {formatteerUren(regel.uren)}
                                  </span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                                  <div
                                    className="h-full rounded-full bg-merk-turquoise"
                                    style={{
                                      width: `${(regel.uren / totaalCategorieen) * 100}%`,
                                    }}
                                  />
                                </div>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>

                    {balans.dagenPeriode < balans.dagenJaar ? (
                      <p className="text-xs text-muted-foreground">
                        Naar rato: in dienst van{" "}
                        {formatteerDatum(balans.periodeStart)} tot en met{" "}
                        {formatteerDatum(balans.periodeEind)} — dat is{" "}
                        {balans.dagenPeriode} van de {balans.dagenJaar} dagen,
                        dus {formatteerUren(balans.normPeriode)} van de{" "}
                        {formatteerUren(balans.persoonlijkeJaarnorm)} uur.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Zonder contract is er geen norm te berekenen. Leg de uren
                    per week vast bij Medewerkers, met het potloodje achter de
                    regel.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}

        {/* Medewerkers */}
        <Card className="p-0">
          <CardHeader>
            <CardTitle>Medewerkers</CardTitle>
            <p className="text-sm text-muted-foreground">
              Naam, rol, dienstverband, standplaats en contract. De datums van
              in- en uitdiensttreding bepalen over welk deel van het jaar de
              norm wordt gerekend.
            </p>
          </CardHeader>
          <MedewerkersBeheer
            medewerkers={contractenVanIedereen}
            ikId={ik.id}
            vandaag={vandaag}
            normFulltime={normUitContracten}
          />
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {/* Soorten trainingen */}
          <Card className="p-0">
            <CardHeader>
              <CardTitle>Soorten trainingen</CardTitle>
              <p className="text-sm text-muted-foreground">
                Deze uren bepalen wat een afspraak oplevert. Ze staan nergens in
                de code, en de medewerker vult ze niet in. Een wijziging geldt
                vooruit: bestaande afspraken houden de uren waarmee ze zijn
                vastgelegd.
              </p>
            </CardHeader>
            <SoortenBeheer soorten={soorten} />
          </Card>

          {/* Instellingen */}
          <Card>
            <CardHeader>
              <CardTitle>Instellingen</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2.5 text-sm">
                <Instelling
                  label="Eigen reistijd per dag"
                  waarde={`${formatteerUren(instellingen.eigenReistijdUrenPerDag)} uur`}
                />
                <Instelling
                  label="Afronding automatische reistijd"
                  waarde={`${instellingen.reistijdAfrondingMinuten} minuten`}
                />
                <Instelling
                  label="Waarschuwing boven"
                  waarde={`${formatteerUren(instellingen.maxUrenPerDagWaarschuwing)} uur per dag`}
                />
                <Instelling
                  label="Kilometervergoeding"
                  waarde={
                    instellingen.kilometervergoedingPerKm != null
                      ? `${formatteerBedrag(instellingen.kilometervergoedingPerKm)} per km`
                      : "niet ingesteld"
                  }
                />
              </dl>
            </CardContent>
          </Card>
        </div>

        {/* Niet-inzetbare dagen */}
        <Card>
          <CardHeader>
            <CardTitle>Niet-inzetbare dagen</CardTitle>
            <p className="text-sm text-muted-foreground">
              Schoolvakanties en feestdagen van regio Noord. Ze veranderen niets
              aan het <strong>aantal</strong> uren dat je moet maken — de
              jaarnorm van 1659 uur bij een voltijds dienstverband heeft de
              vakantie-uren er al uit. Ze bepalen <strong>wanneer</strong> je
              die uren geacht wordt te maken: de normlijn staat stil tijdens een
              schoolvakantie en loopt tijdens schoolweken.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
            {perJaar.size === 0 ? (
              <p className="text-sm text-muted-foreground">
                Er staan nog geen vakantiedagen in. De jaarnorm klopt wel, maar
                het portaal smeert hem uit over alle weekdagen. In een
                vakantieweek lijkt het daardoor alsof er achterstand ontstaat.
              </p>
            ) : (
              <ul className="grid gap-1.5 text-sm">
                {[...perJaar.entries()]
                  .sort(([a], [b]) => a - b)
                  .map(([dagJaar, aantal]) => (
                    <li key={dagJaar} className="flex justify-between gap-4">
                      <span>{dagJaar}</span>
                      <span className="tabular-nums">
                        {aantal} dagen vastgelegd
                      </span>
                    </li>
                  ))}
              </ul>
            )}
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              Vul per schooljaar de officiële vakantiedata van regio Noord in.
              Eén uitzondering waarbij ze wél het aantal uren bepalen: begint of
              eindigt een dienstverband midden in het jaar, dan wordt de norm
              naar rato berekend over de inzetbare dagen.
            </p>
          </CardContent>
        </Card>

        {/* Nog te bouwen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden />
              Nog niet in dit portaal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li>
                Niet-inzetbare dagen en instellingen wijzigen — nu alleen te
                lezen.
              </li>
              <li>
                Wijzigingslog — de databasetriggers vullen hem al, het scherm
                ontbreekt nog.
              </li>
              <li>Tweestapsverificatie voor de beheerder.</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </Pagina>
  );
}

function Instelling({ label, waarde }: { label: string; waarde: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{waarde}</dd>
    </div>
  );
}
