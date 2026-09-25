"use client";

import { createBrowserClient } from "@supabase/ssr";

import { vereisSupabaseOmgeving } from "./omgeving";

/**
 * Supabase-verbinding in de browser. Alleen voor het inloggen en uitloggen —
 * gegevens lezen en schrijven gaat via server components en server actions
 * (CLAUDE.md, "Architectuur").
 */
export function supabaseBrowser() {
  const omgeving = vereisSupabaseOmgeving();
  return createBrowserClient(omgeving.url, omgeving.publiekeSleutel);
}
