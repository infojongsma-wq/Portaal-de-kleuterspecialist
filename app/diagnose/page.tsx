import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabaseBeheer } from "@/lib/supabase/beheer";
import { leesSupabaseOmgeving } from "@/lib/supabase/omgeving";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Diagnosescherm: wat is er wél en niet in orde aan de koppeling met Supabase.
 *
 * Bestaat omdat Next.js in een productiebouw de tekst van een fout weglaat —
 * je krijgt dan alleen "An error occurred in the Server Components render", en
 * daar kan niemand iets mee. Dit scherm doet dezelfde controles als
 * `lib/data/werkset.ts`, maar vángt elke fout op en zet hem op het scherm in
 * plaats van hem te laten vallen.
 *
 * Zonder inlog toont het bewust niets over de database. Anders zou iedereen met
 * de link kunnen uitlezen hoe de database in elkaar zit.
 */

export const metadata = { title: "Diagnose · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

const TABELLEN = [
  "profielen",
  "contracten",
  "klanten",
  "contactpersonen",
  "activiteitsoorten",
  "afspraken",
  "urenregels",
  "niet_inzetbare_dagen",
  "instellingen",
] as const;

interface Uitkomst {
  naam: string;
  goed: boolean;
  toelichting: string;
  melding?: string;
}

/**
 * Postgres en PostgREST geven Engelse foutmeldingen met een code. Dit vertaalt
 * de codes die bij dit portaal voor kunnen komen naar wat je eraan doet.
 */
function uitlegBijCode(code: string | undefined): string | null {
  switch (code) {
    case "42P01":
    case "PGRST205":
      return "De tabel bestaat niet. Het databaseschema is nog niet (volledig) uitgevoerd — zie PUBLICEREN.md stap 2.";
    case "42703":
      return "Een kolom ontbreekt. De database is van een oudere versie dan de app; de laatste migraties zijn nog niet gedraaid.";
    case "42501":
      return "Geen rechten op de tabel. De beveiligingsregels (Row Level Security) laten deze gebruiker er niet bij.";
    case "42P17":
      return "De beveiligingsregel verwijst naar zichzelf. De hulpfuncties huidig_profiel_id() en is_beheerder() ontbreken of staan niet op 'security definer'.";
    case "PGRST301":
      return "De sessie werd niet geaccepteerd. Meestal hoort de sleutel in Vercel bij een ánder Supabase-project dan de URL.";
    case "PGRST116":
      return "Er werd één rij verwacht maar er stonden er geen of meerdere.";
    default:
      return null;
  }
}

/** Alles wat de database over de fout kwijt wil, op één regel. */
function meldingVan(fout: {
  code?: string | null;
  message?: string | null;
  details?: string | null;
  hint?: string | null;
}): string {
  const delen = [
    fout.code ? `code ${fout.code}` : null,
    fout.message || null,
    fout.details || null,
    fout.hint || null,
  ].filter(Boolean);

  return delen.length > 0
    ? delen.join(" — ")
    : "De database gaf geen toelichting terug.";
}

function Regel({ uitkomst }: { uitkomst: Uitkomst }) {
  return (
    <li className="flex gap-3 border-b py-2 last:border-b-0">
      <span
        aria-hidden
        className={
          uitkomst.goed
            ? "mt-0.5 text-merk-hardgroen"
            : "mt-0.5 text-destructive"
        }
      >
        {uitkomst.goed ? "✓" : "✗"}
      </span>
      <div className="grid gap-1">
        <p className="text-sm font-medium">
          {uitkomst.naam}
          <span className="sr-only">{uitkomst.goed ? ": goed" : ": fout"}</span>
        </p>
        <p className="text-sm text-muted-foreground">{uitkomst.toelichting}</p>
        {uitkomst.melding ? (
          <p className="rounded bg-muted px-2 py-1 font-mono text-xs break-words">
            {uitkomst.melding}
          </p>
        ) : null}
      </div>
    </li>
  );
}

/**
 * Klopt er aan bij Supabase zonder in te loggen.
 *
 * `/auth/v1/health` is het adres dat Supabase zelf gebruikt om te zeggen dat
 * hij er is. Slaapt het project, dan komt er niets terug — en dat is precies
 * wat je wilt weten als inloggen niet lukt.
 */
async function bereikbaarheid(omgeving: {
  url: string;
  publiekeSleutel: string;
}): Promise<Uitkomst> {
  const naam = "Supabase bereikbaar";

  try {
    const antwoord = await fetch(`${omgeving.url}/auth/v1/health`, {
      headers: { apikey: omgeving.publiekeSleutel },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (antwoord.ok) {
      return { naam, goed: true, toelichting: "Supabase antwoordt." };
    }

    return {
      naam,
      goed: false,
      toelichting:
        antwoord.status === 401 || antwoord.status === 403
          ? "Supabase antwoordt wel, maar weigert de publieke sleutel. Die hoort waarschijnlijk bij een ander project, of is in Supabase vervangen."
          : "Supabase antwoordt, maar niet goed. Staat het project in de pauzestand of wordt er onderhoud gepleegd?",
      melding: `HTTP ${antwoord.status}`,
    };
  } catch (oorzaak) {
    return {
      naam,
      goed: false,
      toelichting:
        "Er kwam geen antwoord. Meestal staat het project in de pauzestand: een gratis Supabase-project valt in slaap na zeven dagen zonder gebruik. Open supabase.com/dashboard, kies het project en klik op Restore. Je gegevens blijven staan; na een paar minuten werkt inloggen weer.",
      melding: oorzaak instanceof Error ? oorzaak.message : String(oorzaak),
    };
  }
}

export default async function DiagnosePagina() {
  const uitkomsten: Uitkomst[] = [];
  const omgeving = leesSupabaseOmgeving();

  uitkomsten.push(
    omgeving
      ? {
          naam: "Supabase ingesteld",
          goed: true,
          toelichting: `Het portaal praat met ${omgeving.url}.`,
        }
      : {
          naam: "Supabase ingesteld",
          goed: false,
          toelichting:
            "NEXT_PUBLIC_SUPABASE_URL en/of NEXT_PUBLIC_SUPABASE_ANON_KEY ontbreken in Vercel. Let op: die gaan pas mee bij een níeuwe bouw.",
        },
  );

  let ingelogd = false;

  if (omgeving) {
    // Antwoordt Supabase überhaupt? Deze controle staat bewust vóór het
    // inloggen, want juist als inloggen niet lukt wil je weten of de database
    // nog wakker is. Een gratis project gaat na zeven dagen zonder gebruik in
    // de pauzestand; inloggen ziet er dan uit als een verkeerd wachtwoord.
    uitkomsten.push(await bereikbaarheid(omgeving));

    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    ingelogd = Boolean(data?.user);

    uitkomsten.push(
      data?.user
        ? {
            naam: "Ingelogd",
            goed: true,
            toelichting: `Als ${data.user.email ?? "onbekend adres"}.`,
          }
        : {
            naam: "Ingelogd",
            goed: false,
            toelichting:
              "Er is geen geldige sessie. Log eerst in; zonder inlog laat dit scherm niets over de database zien.",
            melding: error?.message,
          },
    );

    if (data?.user) {
      // Precies dezelfde query als `lib/data/werkset.ts` stelt: alle kolommen,
      // alle rijen die de beveiligingsregels doorlaten. Bewust geen
      // `head`-verzoek — dat geeft geen antwoordtekst terug, en juist die
      // tekst is wat we hier zoeken.
      for (const tabel of TABELLEN) {
        const { data: rijen, error: tabelFout } = await supabase
          .from(tabel)
          .select("*");

        uitkomsten.push(
          tabelFout
            ? {
                naam: `Tabel ${tabel}`,
                goed: false,
                toelichting:
                  uitlegBijCode(tabelFout.code) ??
                  (tabelFout.code || tabelFout.message
                    ? "Deze tabel kon niet worden gelezen."
                    : // Geen code én geen tekst betekent dat er helemaal geen
                      // antwoord kwam. Dan ligt het niet aan de inhoud van de
                      // database maar aan de verbinding ernaartoe.
                      "Er kwam geen antwoord van de database. Dat wijst op de verbinding tussen Vercel en Supabase, niet op de gegevens: een Supabase-project dat in de pauzestand staat, of een URL van een ánder project dan de sleutel."),
                melding: meldingVan(tabelFout),
              }
            : {
                naam: `Tabel ${tabel}`,
                goed: true,
                toelichting: `${rijen?.length ?? 0} ${
                  rijen?.length === 1 ? "rij" : "rijen"
                } zichtbaar.`,
              },
        );
      }

      // De meest voorkomende oorzaak van een leeg of stukgelopen portaal: wel
      // een account, geen profiel.
      const { data: profiel, error: profielFout } = await supabase
        .from("profielen")
        .select("voornaam, achternaam, rol")
        .eq("auth_gebruiker_id", data.user.id)
        .maybeSingle();

      uitkomsten.push(
        profielFout
          ? {
              naam: "Eigen profiel",
              goed: false,
              toelichting:
                uitlegBijCode(profielFout.code) ??
                "Het profiel kon niet worden opgezocht.",
              melding: meldingVan(profielFout),
            }
          : profiel
            ? {
                naam: "Eigen profiel",
                goed: true,
                toelichting: `${profiel.voornaam} ${profiel.achternaam}, rol: ${profiel.rol}.`,
              }
            : {
                naam: "Eigen profiel",
                goed: false,
                toelichting:
                  "Er hoort bij dit account een rij in de tabel profielen, maar die is er niet. Dat gebeurt als het account is aangemaakt vóórdat de migratie 20260914120000_profiel_bij_inlog.sql was gedraaid. Onderaan stap 4 van PUBLICEREN.md staat het stukje SQL dat het alsnog aanmaakt.",
              },
      );

      // De geheime sleutel is alleen nodig om uit te nodigen, en alleen een
      // beheerder doet dat. De sleutel zelf komt hier nooit op het scherm —
      // we tonen of hij er is en of Supabase hem accepteert.
      if (profiel?.rol === "beheerder") {
        const beheer = supabaseBeheer();

        if (!beheer) {
          uitkomsten.push({
            naam: "Geheime sleutel (uitnodigen)",
            goed: false,
            toelichting:
              "SUPABASE_SERVICE_ROLE_KEY staat niet bij de omgevingsvariabelen, of deze bouw is van vóór het moment dat hij werd toegevoegd — na het toevoegen moet er opnieuw gebouwd worden. Uitnodigen kan dan niet; de rest van het portaal werkt gewoon door. Zie PUBLICEREN.md stap 4b.",
          });
        } else {
          const { error: sleutelFout } = await beheer.auth.admin.listUsers({
            perPage: 1,
          });

          uitkomsten.push(
            sleutelFout
              ? {
                  naam: "Geheime sleutel (uitnodigen)",
                  goed: false,
                  toelichting:
                    "De sleutel staat er wel, maar Supabase accepteert hem niet. Meestal hoort hij bij een ánder project, of is per ongeluk de publieke sleutel geplakt.",
                  melding: meldingVan(sleutelFout),
                }
              : {
                  naam: "Geheime sleutel (uitnodigen)",
                  goed: true,
                  toelichting:
                    "Aanwezig en geaccepteerd. Uitnodigen per e-mail kan.",
                },
          );
        }
      }
    }
  }

  const allesGoed = uitkomsten.every((uitkomst) => uitkomst.goed);

  return (
    <main className="flex min-h-screen justify-center p-6">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Diagnose</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <p className="text-sm text-muted-foreground">
              {allesGoed
                ? "Alles wat dit scherm kan controleren is in orde."
                : ingelogd
                  ? "Hieronder staat wat er niet klopt. De regels met een kruisje zijn de oorzaak."
                  : "Je bent niet ingelogd, dus verder dan de eerste regels komt dit scherm niet. Staat er bij Supabase bereikbaar een kruisje, dan ligt het daaraan en niet aan je wachtwoord."}
            </p>

            <ul className="grid">
              {uitkomsten.map((uitkomst) => (
                <Regel key={uitkomst.naam} uitkomst={uitkomst} />
              ))}
            </ul>

            <p className="text-sm text-muted-foreground">
              {ingelogd ? (
                <Link
                  href="/afspraken"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Terug naar het portaal
                </Link>
              ) : (
                <Link
                  href="/inloggen"
                  className="underline underline-offset-4 hover:text-foreground"
                >
                  Naar inloggen
                </Link>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
