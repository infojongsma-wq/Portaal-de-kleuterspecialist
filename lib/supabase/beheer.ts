import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { leesSupabaseOmgeving } from "./omgeving";

/**
 * Verbinding met de geheime sleutel, uitsluitend om accounts uit te nodigen.
 *
 * Deze sleutel gaat langs alle beveiligingsregels heen. Hij hoort daarom
 * nergens anders te worden gebruikt dan hier, altijd achter een controle op de
 * rol van de ingelogde gebruiker, en nooit in code die de browser bereikt
 * (CLAUDE.md, "Architectuur"; SPEC.md hoofdstuk 7).
 *
 * Geeft `null` als de sleutel niet is ingesteld. Uitnodigen kan dan niet, maar
 * de rest van het portaal werkt gewoon door.
 */
export function supabaseBeheer(): SupabaseClient | null {
  const geheimeSleutel = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const omgeving = leesSupabaseOmgeving();

  if (!geheimeSleutel || !omgeving) return null;

  return createClient(omgeving.url, geheimeSleutel, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
