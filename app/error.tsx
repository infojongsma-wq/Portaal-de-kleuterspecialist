"use client";

import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Wat de gebruiker ziet als er iets misgaat.
 *
 * Bewust mét de oorspronkelijke melding erbij: dit portaal wordt door één
 * persoon gebruikt, en die moet kunnen doorgeven wat er stond. Een vriendelijk
 * "er ging iets mis" zonder verdere aanwijzing kost alleen maar tijd.
 */
export default function Foutpagina({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const gaatOverInstellen =
    error.message.includes("Supabase is nog niet ingesteld") ||
    error.message.includes("databaseschema");

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-amber-600" aria-hidden />
            Er ging iets mis
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="rounded-md bg-muted p-3 text-sm">{error.message}</p>

          {gaatOverInstellen ? (
            <p className="text-sm text-muted-foreground">
              Het portaal is nog niet volledig ingesteld. De stappen daarvoor
              staan in <code>PUBLICEREN.md</code>: het Supabase-project
              aanmaken, het databaseschema uitvoeren en de sleutels in Vercel
              zetten.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Deze melding zegt weinig: in een gepubliceerde versie laat Next.js
              de eigenlijke tekst weg. Klik op <strong>Wat is er mis?</strong> —
              dat scherm doet dezelfde controles en zegt wél waar het op vastloopt.
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={reset}>
              Opnieuw proberen
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href="/diagnose">Wat is er mis?</a>
            </Button>
            <Button type="button" variant="outline" asChild>
              <a href="/inloggen">Naar inloggen</a>
            </Button>
          </div>

          {error.digest ? (
            // Het kenmerk waarmee de melding terug te vinden is in de logboeken
            // van Vercel. Zonder dit is zoeken tussen alle aanvragen.
            <p className="text-xs text-muted-foreground">
              Kenmerk voor in het logboek: <code>{error.digest}</code>
            </p>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
