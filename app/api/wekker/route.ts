import { leesSupabaseOmgeving } from "@/lib/supabase/omgeving";

/**
 * De wekker: houdt het Supabase-project wakker.
 *
 * Een gratis Supabase-project gaat na zeven dagen zonder gebruik in de
 * pauzestand, en dan lukt inloggen niet meer tot iemand het in het dashboard
 * weer aanzet. Vercel roept dit adres één keer per dag aan (zie `crons` in
 * `vercel.json`). Het stelt de database één kleine vraag — genoeg om als
 * gebruik te tellen.
 *
 * De vraag loopt met de publieke sleutel en zonder sessie. De beveiligingsregels
 * laten dan geen enkele rij door, maar Postgres doet wel het werk, en daar gaat
 * het om. Er komt dus ook niets terug behalve of de database antwoordde.
 *
 * Staat CRON_SECRET bij de omgevingsvariabelen, dan stuurt Vercel die mee en
 * weigert dit adres ieder ander verzoek. Zonder die variabele is het adres
 * open. Dat kan geen kwaad: het doet niets dan die ene lege vraag.
 *
 * Een project dat al slaapt, maakt dit niet meer wakker — dat kan alleen via
 * het dashboard. De wekker voorkomt dat het zover komt.
 */

export const dynamic = "force-dynamic";

export async function GET(verzoek: Request) {
  const geheim = process.env.CRON_SECRET?.trim();

  if (geheim && verzoek.headers.get("authorization") !== `Bearer ${geheim}`) {
    return Response.json({ wakker: false }, { status: 401 });
  }

  const omgeving = leesSupabaseOmgeving();

  if (!omgeving) {
    return Response.json(
      { wakker: false, reden: "Supabase is niet ingesteld." },
      { status: 503 },
    );
  }

  try {
    const antwoord = await fetch(
      `${omgeving.url}/rest/v1/activiteitsoorten?select=id&limit=1`,
      {
        // Alleen de publieke sleutel, zonder sessie. De nieuwe sleutels van
        // Supabase zijn geen token en horen daarom niet in Authorization.
        headers: { apikey: omgeving.publiekeSleutel },
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
      },
    );

    // Elk antwoord onder de 500 komt van Postgres zelf, ook een weigering:
    // de database is dan bereikt, en dat is wat telt. Vanaf 500 of zonder
    // antwoord slaapt het project al, of is het onbereikbaar.
    const wakker = antwoord.status < 500;

    return Response.json(
      { wakker, status: antwoord.status },
      { status: wakker ? 200 : 502 },
    );
  } catch {
    return Response.json(
      { wakker: false, reden: "Geen antwoord van Supabase." },
      { status: 502 },
    );
  }
}
