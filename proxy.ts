import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { leesSupabaseOmgeving } from "@/lib/supabase/omgeving";

/**
 * Draait vóór elke aanvraag (in Next.js 16 heet dit `proxy`, voorheen
 * `middleware`).
 *
 * Twee taken:
 *  1. de sessie van Supabase verversen, zodat een ingelogde gebruiker niet
 *     halverwege de dag wordt uitgelogd;
 *  2. wie niet is ingelogd naar het inlogscherm sturen.
 *
 * Dit is een eerste zeef, geen beveiliging op zichzelf. Wat iemand werkelijk
 * mag zien en wijzigen bepaalt Row Level Security in de database.
 */

// `/diagnose` staat er bewust bij: juist als de sessie of de database stuk is
// moet dat scherm te bereiken zijn. Het toont zonder inlog niets over de
// database, alleen of Supabase is ingesteld.
const OPENBARE_PADEN = [
  "/inloggen",
  "/wachtwoord-vergeten",
  "/instellen",
  "/diagnose",
];

export async function proxy(verzoek: NextRequest) {
  const omgeving = leesSupabaseOmgeving();

  // Zonder Supabase draait het portaal nog op het servergeheugen; dan valt er
  // niets te beveiligen en zou doorsturen alleen maar in de weg zitten.
  if (!omgeving) return NextResponse.next();

  let antwoord = NextResponse.next({ request: verzoek });

  const supabase = createServerClient(omgeving.url, omgeving.publiekeSleutel, {
    cookies: {
      getAll() {
        return verzoek.cookies.getAll();
      },
      setAll(teZetten) {
        for (const { name, value } of teZetten) {
          verzoek.cookies.set(name, value);
        }
        antwoord = NextResponse.next({ request: verzoek });
        for (const { name, value, options } of teZetten) {
          antwoord.cookies.set(name, value, options);
        }
      },
    },
  });

  // Deze aanroep ververst het token als dat nodig is. Niet weghalen, en er
  // niets tussen zetten: alles wat hierna gebeurt rekent erop.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pad = verzoek.nextUrl.pathname;
  const isOpenbaar = OPENBARE_PADEN.some(
    (openbaar) => pad === openbaar || pad.startsWith(`${openbaar}/`),
  );

  if (!user && !isOpenbaar) {
    const naarInloggen = verzoek.nextUrl.clone();
    naarInloggen.pathname = "/inloggen";
    // Onthouden waar iemand heen wilde, zodat hij daar na het inloggen belandt.
    naarInloggen.searchParams.set("verder", pad);
    return NextResponse.redirect(naarInloggen);
  }

  if (user && pad === "/inloggen") {
    const naarPortaal = verzoek.nextUrl.clone();
    naarPortaal.pathname = "/afspraken";
    naarPortaal.search = "";
    return NextResponse.redirect(naarPortaal);
  }

  return antwoord;
}

export const config = {
  matcher: [
    /*
     * Alles behalve de bestanden die Next.js zelf serveert en de afbeeldingen.
     * Die hoeven niet langs de sessiecontrole en zouden er alleen trager van
     * worden.
     */
    "/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
