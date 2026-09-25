import { endOfMonth, startOfMonth } from "date-fns";

import { Pagina } from "@/components/pagina";
import { UrenregelFormulier } from "@/components/uren/urenregel-formulier";
import { Voortgangsbalk } from "@/components/uren/voortgangsbalk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  haalContractVanJaar,
  huidigeMedewerker,
  jaarnormBalans,
  urenregelsInPeriode,
} from "@/lib/data/queries";
import {
  formatteerUren,
  formatteerUrenKlok,
  naarIsoDatum,
} from "@/lib/formatteer";

export const metadata = { title: "Mijn uren · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

/** Eigen uren en de stand ten opzichte van de jaarnorm (SPEC.md 6.5). */
export default async function MijnUrenPagina() {
  const medewerker = await huidigeMedewerker();
  const nu = new Date();
  const vandaag = naarIsoDatum(nu);
  const jaar = nu.getFullYear();

  // De maand bepaalt alleen welke urenregels je onderaan kunt bijwerken; de
  // verantwoording zelf gaat per jaar.
  const maandStart = naarIsoDatum(startOfMonth(nu));
  const maandEind = naarIsoDatum(endOfMonth(nu));

  const [balans, contract, urenregels] = await Promise.all([
    jaarnormBalans(medewerker.id, jaar),
    haalContractVanJaar(medewerker.id, jaar),
    urenregelsInPeriode(medewerker.id, maandStart, maandEind, "gerealiseerd"),
  ]);

  // Alleen het jaartotaal: de verantwoording gaat per jaar, niet per week of
  // maand. De ene week worden er meer uren gemaakt dan de andere.
  const perioden = [
    {
      label: `Dit jaar (${jaar})`,
      gerealiseerd: balans?.gerealiseerdeUren ?? 0,
      gepland: balans?.geplandeUren ?? 0,
    },
  ];

  return (
    <Pagina
      titel="Mijn uren"
      omschrijving={
        contract
          ? `Contract: ${formatteerUren(contract.urenPerWeek)} uur per week · deeltijdfactor ${formatteerUren(balans?.werktijdfactor ?? 0)}`
          : "Er is nog geen contract vastgelegd."
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-5 sm:max-w-xs">
          {perioden.map((periode) => (
            <Card key={periode.label}>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {periode.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-semibold tabular-nums">
                  {formatteerUren(periode.gerealiseerd)}
                  <span className="ml-2 text-base font-normal text-muted-foreground">
                    uur · {formatteerUrenKlok(periode.gerealiseerd)}
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Gepland: {formatteerUren(periode.gepland)} uur
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {balans ? (
          <Card>
            <CardHeader>
              <CardTitle>Jaarurennorm {jaar}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <Voortgangsbalk
                gerealiseerd={balans.gerealiseerdeUren}
                norm={balans.normPeriode}
              />

              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                <Kerngetal
                  label={`Jaarnorm ${jaar}`}
                  waarde={`${formatteerUren(balans.normPeriode)} uur`}
                />
                <Kerngetal
                  label="Gerealiseerd"
                  waarde={`${formatteerUren(balans.gerealiseerdeUren)} uur`}
                />
                <Kerngetal
                  label={balans.nogTeGaan >= 0 ? "Nog te gaan" : "Boven de norm"}
                  waarde={`${formatteerUren(Math.abs(balans.nogTeGaan))} uur`}
                  nadruk={balans.nogTeGaan >= 0 ? undefined : "goed"}
                />
                <Kerngetal
                  label="Deeltijdfactor"
                  waarde={formatteerUren(balans.werktijdfactor)}
                />
              </dl>

              <p className="text-xs text-muted-foreground">
                {balans.dagenPeriode < balans.dagenJaar
                  ? `De norm is naar rato berekend over ${balans.dagenPeriode} van de ${balans.dagenJaar} dagen van dit jaar. `
                  : ""}
                Het gaat om het totaal over het hele jaar; de ene week maak je
                meer uren dan de andere. Alleen voltooide afspraken en
                handmatige urenregels tellen mee als gerealiseerd.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="p-6 text-sm text-muted-foreground">
            Zonder contract is er geen jaarnorm te berekenen. Leg de contracturen
            per week en de ingangsdatum vast bij Beheer › Medewerkers.
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Uren boeken</CardTitle>
            <p className="text-sm text-muted-foreground">
              Alle uren van deze maand. De uren uit je afspraken staan er
              automatisch bij; daaronder boek je zelf wat je verder hebt
              gedaan.
            </p>
          </CardHeader>
          <CardContent>
            <UrenregelFormulier vandaag={vandaag} regels={urenregels} />
          </CardContent>
        </Card>
      </div>
    </Pagina>
  );
}

function Kerngetal({
  label,
  waarde,
  nadruk,
}: {
  label: string;
  waarde: string;
  nadruk?: "goed" | "let-op";
}) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={
          nadruk === "goed"
            ? "font-semibold tabular-nums text-merk-hardgroen"
            : nadruk === "let-op"
              ? "font-semibold tabular-nums text-amber-600"
              : "font-medium tabular-nums"
        }
      >
        {waarde}
      </dd>
    </div>
  );
}
