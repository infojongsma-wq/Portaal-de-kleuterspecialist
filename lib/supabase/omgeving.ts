/**
 * De omgevingsvariabelen voor Supabase, op één plek gecontroleerd.
 *
 * Ontbreekt er iets, dan zeggen we dat met zoveel woorden. Een halve
 * configuratie levert anders een leeg scherm op waar niemand uit opmaakt wat
 * eraan scheelt.
 */

export interface SupabaseOmgeving {
  url: string;
  publiekeSleutel: string;
}

/** Geeft `null` als Supabase nog niet is ingesteld. */
export function leesSupabaseOmgeving(): SupabaseOmgeving | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publiekeSleutel = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !publiekeSleutel) return null;

  return { url: normaliseerUrl(url), publiekeSleutel };
}

export function vereisSupabaseOmgeving(): SupabaseOmgeving {
  const omgeving = leesSupabaseOmgeving();
  if (!omgeving) {
    throw new Error(
      "Supabase is nog niet ingesteld. Zet NEXT_PUBLIC_SUPABASE_URL en " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY in de omgevingsvariabelen. Zie PUBLICEREN.md.",
    );
  }
  return omgeving;
}

/**
 * De Project URL hoort alleen de basis te zijn, zonder pad. In het
 * Supabase-scherm staat het REST-adres er vaak bij ingebakken
 * (`…supabase.co/rest/v1/`), en dat wordt anders twee keer geplakt. Een
 * afsluitende schuine streep haalt hetzelfde overhoop.
 */
function normaliseerUrl(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url.replace(/\/+$/, "");
  }
}
