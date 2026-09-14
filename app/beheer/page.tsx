import { AlertTriangle, Lock } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Voortgangsbalk } from "@/components/uren/voortgangsbalk";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SoortenBeheer } from "@/components/beheer/soorten-beheer";
import {
  haalAlleActiviteitsoorten,
  haalContract,
  haalInstellingen,
  haalNietInzetbareDagen,
  haalProfielen,
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
export default function BeheerPagina() {
  const nu = new Date();
  const vandaag = naarIsoDatum(nu);
  const jaar = nu.getFullYear();
  const jaarStart = `${jaar}-01-01`;
  const jaarEind = `${jaar}-12-31`;

  const instellingen = haalInstellingen();
  const medewerkers = haalProfielen().filter(
    (profiel) => profiel.rol === "medewerker",
  );
  const nietInzetbareDagen = haalNietInzetbareDagen();

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
        {medewerkers.map((medewerker) => {
          const balans = jaarnormBalans(medewerker.id, jaar, vandaag);
          const contract = haalContract(medewerker.id, vandaag);
          const categorieen = urenPerCategorie(
            medewerker.id,
            jaarStart,
            jaarEind,
            "gerealiseerd",
          );
          const totaalCategorieen = categorieen.reduce(
            (som, regel) => som + regel.uren,
            0,
          );

          return (
            <Card key={medewerker.id}>
              <CardHeader>
                <CardTitle>
                  Urenverantwoording {jaar} — {medewerker.voornaam}{" "}
                  {medewerker.achternaam}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {contract
                    ? `${formatteerUren(contract.urenPerWeek)} uur per week vanaf ${formatteerDatum(contract.ingangsdatum)} · fulltimenorm ${formatteerUren(contract.normFulltime)} uur`
                    : "Geen contract vastgelegd."}
                </p>
              </CardHeader>

              <CardContent className="grid gap-6">
                {balans ? (
                  <>
                    <Voortgangsbalk
                      gerealiseerd={balans.gerealiseerdeUren}
                      verwacht={balans.verwachteUren}
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
                              <TableCell>Verwacht tot vandaag</TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatteerUren(balans.verwachteUren)}
                              </TableCell>
                            </TableRow>
                            <TableRow>
                              <TableCell className="font-medium">Saldo</TableCell>
                              <TableCell
                                className={`text-right font-medium tabular-nums ${
                                  balans.saldo >= 0
                                    ? "text-merk-hardgroen"
                                    : "text-amber-600"
                                }`}
                              >
                                {balans.saldo >= 0 ? "+" : "−"}
                                {formatteerUren(Math.abs(balans.saldo))}
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
                                  <span>
                                    {CATEGORIELABELS[regel.categorie]}
                                  </span>
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

                    {balans.vakantiegegevensOnvolledig ? (
                      <p className="flex items-start gap-2 rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0"
                          aria-hidden
                        />
                        <span>
                          {balans.inzetbareDagenJaar} inzetbare dagen berekend,
                          terwijl er ongeveer 207 worden verwacht. Vul de
                          schoolvakanties en feestdagen aan.
                        </span>
                      </p>
                    ) : null}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Zonder contract is er geen norm te berekenen.
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
          </CardHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>E-mail</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>In dienst vanaf</TableHead>
                <TableHead className="text-right">Uren per week</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {haalProfielen().map((profiel) => {
                const contract = haalContract(profiel.id, vandaag);
                return (
                  <TableRow key={profiel.id}>
                    <TableCell className="font-medium">
                      {profiel.voornaam} {profiel.achternaam}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {profiel.email}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {profiel.rol}
                      </Badge>
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {profiel.inDienstVanaf
                        ? formatteerDatum(profiel.inDienstVanaf)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {contract ? formatteerUren(contract.urenPerWeek) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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
            <SoortenBeheer soorten={haalAlleActiviteitsoorten()} />
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
              Schoolvakanties en feestdagen van regio Noord. Ze bepalen over
              hoeveel dagen de jaarnorm wordt uitgesmeerd.
            </p>
          </CardHeader>
          <CardContent className="grid gap-3">
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
            <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
              De dagen in dit prototype zijn bij benadering ingevuld en zijn
              geen officiële vakantiedata. Vul per schooljaar de echte data van
              regio Noord in voordat de urenverantwoording wordt gebruikt.
            </p>
          </CardContent>
        </Card>

        {/* Nog te bouwen */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="size-4" aria-hidden />
              Nog niet in dit prototype
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="grid gap-1.5 text-sm text-muted-foreground">
              <li>
                Medewerkers uitnodigen per e-mail en contracten bewerken — vraagt
                Supabase Auth (fase 1 en 4).
              </li>
              <li>
                Instellingen en niet-inzetbare dagen bewerken — nu alleen te
                lezen. Soorten trainingen zijn hierboven wél te beheren.
              </li>
              <li>Wijzigingslog — de databasetriggers staan klaar in de migraties.</li>
              <li>Export naar Excel en PDF — fase 4.</li>
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
