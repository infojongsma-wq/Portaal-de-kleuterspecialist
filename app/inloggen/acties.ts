"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Inloggen en uitloggen (SPEC.md 6.1).
 *
 * Foutmeldingen blijven bewust vaag over wát er mis is: verklappen dat een
 * e-mailadres wél bestaat maar het wachtwoord niet klopt, helpt iemand die
 * wachtwoorden staat te proberen.
 */

const inlogSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in."),
  wachtwoord: z.string().min(1, "Vul je wachtwoord in."),
  verder: z.string().optional(),
});

export interface InlogResultaat {
  melding?: string;
  velden?: Record<string, string>;
}

export async function logIn(
  _vorigeStand: InlogResultaat | null,
  formulier: FormData,
): Promise<InlogResultaat> {
  const gecontroleerd = inlogSchema.safeParse(Object.fromEntries(formulier));

  if (!gecontroleerd.success) {
    const velden: Record<string, string> = {};
    for (const fout of gecontroleerd.error.issues) {
      const veld = String(fout.path[0] ?? "");
      if (veld && !velden[veld]) velden[veld] = fout.message;
    }
    return { velden };
  }

  const { email, wachtwoord, verder } = gecontroleerd.data;
  const supabase = await supabaseServer();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: wachtwoord,
  });

  if (error) {
    return {
      melding: "Het e-mailadres of wachtwoord klopt niet.",
    };
  }

  // Alleen binnen het portaal doorsturen, nooit naar een adres dat iemand in
  // de link heeft gezet.
  const bestemming = verder && verder.startsWith("/") && !verder.startsWith("//")
    ? verder
    : "/afspraken";

  redirect(bestemming);
}

export async function logUit() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/inloggen");
}

const wachtwoordVergetenSchema = z.object({
  email: z.email("Vul een geldig e-mailadres in."),
});

export async function vraagWachtwoordHerstel(
  _vorigeStand: InlogResultaat | null,
  formulier: FormData,
): Promise<InlogResultaat> {
  const gecontroleerd = wachtwoordVergetenSchema.safeParse(
    Object.fromEntries(formulier),
  );

  if (!gecontroleerd.success) {
    return { velden: { email: "Vul een geldig e-mailadres in." } };
  }

  const supabase = await supabaseServer();
  const kop = await headers();
  const host = kop.get("x-forwarded-host") ?? kop.get("host") ?? "";
  const protocol = kop.get("x-forwarded-proto") ?? "https";

  // Zonder bestemming komt de herstellink uit op het adres dat in Supabase
  // staat ingesteld, en dat is niet per se dit portaal.
  await supabase.auth.resetPasswordForEmail(gecontroleerd.data.email, {
    redirectTo: `${protocol}://${host}/instellen`,
  });

  // Altijd dezelfde bevestiging, ook als het adres niet bestaat. Anders is het
  // formulier te gebruiken om uit te zoeken wie er een account heeft.
  return {
    melding:
      "Als dit adres bij ons bekend is, staat er een e-mail met een herstellink onderweg.",
  };
}
