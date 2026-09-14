import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { vereisSupabaseOmgeving } from "./omgeving";

/**
 * Supabase-verbinding voor server components en server actions.
 *
 * Gebruikt de publieke sleutel plus de sessie van de ingelogde gebruiker, zodat
 * Row Level Security in Postgres bepaalt wat er zichtbaar en wijzigbaar is. De
 * geheime sleutel komt hier bewust niet voor: die zou alle beveiligingsregels
 * omzeilen (SPEC.md hoofdstuk 7).
 */
export async function supabaseServer() {
  const omgeving = vereisSupabaseOmgeving();
  const koekjes = await cookies();

  return createServerClient(omgeving.url, omgeving.publiekeSleutel, {
    cookies: {
      getAll() {
        return koekjes.getAll();
      },
      setAll(teZetten) {
        try {
          for (const { name, value, options } of teZetten) {
            koekjes.set(name, value, options);
          }
        } catch {
          // Vanuit een server component mag je geen cookies zetten. Dat is
          // geen probleem: `proxy.ts` ververst de sessie bij elke aanvraag.
        }
      },
    },
  });
}

/**
 * De ingelogde gebruiker, of `null`.
 *
 * Bewust `getUser()` en niet `getSession()`: die eerste laat de server het
 * token controleren, de tweede vertrouwt op wat er in het cookie staat en is
 * dus te vervalsen.
 */
export async function huidigeGebruiker() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.getUser();
  if (error) return null;
  return data.user ?? null;
}
