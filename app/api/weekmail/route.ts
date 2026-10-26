import { supabaseBeheer } from "@/lib/supabase/beheer";
import { isWeekmailMoment } from "@/lib/weekmail/tijd";
import { verstuurWeekmail } from "@/lib/weekmail/versturen";

/**
 * De vaste weekmail op maandagochtend (SPEC.md 6.6).
 *
 * Vercel roept dit adres op maandag aan om 06:00 en om 07:00 UTC (zie `crons`
 * in `vercel.json`). Alleen de aanroep waarbij het in Nederland tussen 08:00
 * en 09:00 is, verstuurt de mail; zo klopt het in zomer- en wintertijd. Zie
 * `lib/weekmail/tijd.ts`.
 *
 * Er draait geen ingelogde gebruiker, dus de gegevens komen met de geheime
 * sleutel. Daarom is `CRON_SECRET` hier verplicht: Vercel stuurt die mee, en
 * ieder ander verzoek wordt geweigerd. Het antwoord bevat geen namen of
 * adressen, alleen of het gelukt is.
 */

export const dynamic = "force-dynamic";

export async function GET(verzoek: Request) {
  const geheim = process.env.CRON_SECRET?.trim();

  if (!geheim) {
    return Response.json(
      { verstuurd: false, reden: "CRON_SECRET staat niet bij de omgevingsvariabelen." },
      { status: 503 },
    );
  }
  if (verzoek.headers.get("authorization") !== `Bearer ${geheim}`) {
    return Response.json({ verstuurd: false }, { status: 401 });
  }

  const nu = new Date();
  if (!isWeekmailMoment(nu)) {
    return Response.json({
      verstuurd: false,
      reden: "Nu niet: de weekmail gaat op maandag tussen 08:00 en 09:00 Nederlandse tijd.",
    });
  }

  const supabase = supabaseBeheer();
  if (!supabase) {
    return Response.json(
      { verstuurd: false, reden: "SUPABASE_SERVICE_ROLE_KEY staat niet bij de omgevingsvariabelen." },
      { status: 503 },
    );
  }

  // Het vaste adres van het portaal, voor de link in de mail. Vercel zet deze
  // variabele zelf; zonder valt het terug op het adres van deze aanroep.
  const productie = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  const portaalAdres = productie ? `https://${productie}` : new URL(verzoek.url).origin;

  const uitkomst = await verstuurWeekmail(supabase, {
    automatisch: true,
    nu,
    portaalAdres,
  });

  switch (uitkomst.status) {
    case "verstuurd":
      return Response.json({ verstuurd: true, aantal: uitkomst.aantal });
    case "al-verstuurd":
      return Response.json({ verstuurd: false, reden: "Deze week is de weekmail al verstuurd." });
    case "niet-ingesteld":
      return Response.json(
        { verstuurd: false, reden: `Nog in te stellen: ${uitkomst.ontbreekt.join(", ")}.` },
        { status: 503 },
      );
    case "fout":
      return Response.json({ verstuurd: false, reden: uitkomst.melding }, { status: 502 });
  }
}
