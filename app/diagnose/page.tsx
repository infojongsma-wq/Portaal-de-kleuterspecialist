import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      // Per tabel kijken of hij bestaat en of de beveiligingsregels hem
      // doorlaten. `head` haalt alleen de telling op, geen gegevens.
      for (const tabel of TABELLEN) {
        const { count, error: tabelFout } = await supabase
          .from(tabel)
          .select("*", { count: "exact", head: true });

        uitkomsten.push(
          tabelFout
            ? {
                naam: `Tabel ${tabel}`,
                goed: false,
                toelichting:
                  uitlegBijCode(tabelFout.code) ??
                  "Deze tabel kon niet worden gelezen.",
                melding: `${tabelFout.code ?? "?"}: ${tabelFout.message}`,
              }
            : {
                naam: `Tabel ${tabel}`,
                goed: true,
                toelichting: `${count ?? 0} ${count === 1 ? "rij" : "rijen"} zichtbaar.`,
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
              melding: `${profielFout.code ?? "?"}: ${profielFout.message}`,
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
                : "Hieronder staat wat er niet klopt. De regels met een kruisje zijn de oorzaak."}
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
