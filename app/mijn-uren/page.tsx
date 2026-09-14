import {
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { AlertTriangle } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { UrenregelFormulier } from "@/components/uren/urenregel-formulier";
import { Voortgangsbalk } from "@/components/uren/voortgangsbalk";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  haalContract,
  huidigeMedewerker,
  jaarnormBalans,
  urenInPeriode,
  urenregelsInPeriode,
} from "@/lib/data/queries";
import {
  formatteerUren,
  formatteerUrenKlok,
  naarIsoDatum,
  weeknummer,
} from "@/lib/formatteer";

export const metadata = { title: "Mijn uren · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

/** Eigen uren per week, maand en jaar (SPEC.md 6.5). */
export default function MijnUrenPagina() {
  const medewerker = huidigeMedewerker();
  const nu = new Date();
  const vandaag = naarIsoDatum(nu);
  const jaar = nu.getFullYear();

  const weekStart = naarIsoDatum(startOfWeek(nu, { weekStartsOn: 1 }));
  const weekEind = naarIsoDatum(endOfWeek(nu, { weekStartsOn: 1 }));
  const maandStart = naarIsoDatum(startOfMonth(nu));
  const maandEind = naarIsoDatum(endOfMonth(nu));

  const balans = jaarnormBalans(medewerker.id, jaar, vandaag);
  const contract = haalContract(medewerker.id, vandaag);

  const perioden = [
    {
      label: `Deze week (week ${weeknummer(vandaag)})`,
      gerealiseerd: urenInPeriode(medewerker.id, weekStart, weekEind, "gerealiseerd"),
      gepland: urenInPeriode(medewerker.id, weekStart, weekEind, "gepland"),
    },
    {
      label: "Deze maand",
      gerealiseerd: urenInPeriode(medewerker.id, maandStart, maandEind, "gerealiseerd"),
      gepland: urenInPeriode(medewerker.id, maandStart, maandEind, "gepland"),
    },
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
          ? `Contract: ${formatteerUren(contract.urenPerWeek)} uur per week · werktijdfactor ${formatteerUren(balans?.werktijdfactor ?? 0)}`
          : "Er is nog geen contract vastgelegd."
      }
    >
      <div className="grid gap-5">
        <div className="grid gap-5 md:grid-cols-3">
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
                verwacht={balans.verwachteUren}
                norm={balans.normPeriode}
              />

              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm md:grid-cols-4">
                <Kerngetal
                  label="Persoonlijke jaarnorm"
                  waarde={`${formatteerUren(balans.persoonlijkeJaarnorm)} uur`}
                />
                <Kerngetal
                  label="Norm over je periode"
                  waarde={`${formatteerUren(balans.normPeriode)} uur`}
                />
                <Kerngetal
                  label="Verwacht tot vandaag"
                  waarde={`${formatteerUren(balans.verwachteUren)} uur`}
                />
                <Kerngetal
                  label="Saldo"
                  waarde={`${balans.saldo >= 0 ? "+" : "−"}${formatteerUren(Math.abs(balans.saldo))} uur`}
                  nadruk={balans.saldo >= 0 ? "goed" : "let-op"}
                />
                <Kerngetal
                  label="Inzetbare dagen dit jaar"
                  waarde={String(balans.inzetbareDagenJaar)}
                />
                <Kerngetal
                  label="Daarvan verstreken"
                  waarde={String(balans.inzetbareDagenVerstreken)}
                />
                <Kerngetal
                  label="Verstreken deel"
                  waarde={`${Math.round(balans.verstrekenDeelPeriode * 100)}%`}
                />
                <Kerngetal
                  label="Werktijdfactor"
                  waarde={formatteerUren(balans.werktijdfactor)}
                />
              </dl>

              {balans.vakantiegegevensOnvolledig ? (
                <p className="flex items-start gap-2 rounded-md bg-amber-100 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>
                    Er zijn {balans.inzetbareDagenJaar} inzetbare dagen berekend,
                    terwijl er ongeveer 207 worden verwacht bij een volledig jaar.
                    De schoolvakanties en feestdagen zijn waarschijnlijk niet
                    compleet ingevoerd — kijk bij Beheer › Niet-inzetbare dagen.
                  </span>
                </p>
              ) : null}

              <p className="text-xs text-muted-foreground">
                De norm wordt uitgesmeerd over inzetbare dagen en niet over
                kalenderweken. De normlijn staat daardoor stil tijdens
                schoolvakanties. Alleen voltooide afspraken en handmatige
                urenregels tellen mee als gerealiseerd.
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
            <UrenregelFormulier
              vandaag={vandaag}
              regels={urenregelsInPeriode(
                medewerker.id,
                maandStart,
                maandEind,
                "gerealiseerd",
              )}
            />
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
