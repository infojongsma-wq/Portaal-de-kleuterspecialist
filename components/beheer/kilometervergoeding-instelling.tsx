"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import { bewaarKilometervergoeding } from "@/app/beheer/acties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatteerBedrag } from "@/lib/formatteer";

/**
 * Kilometervergoeding in Beheer → Instellingen (SPEC.md 6.6). Geldt voor
 * nieuwe ritten; een opgeslagen rit houdt de vergoeding waarmee hij is
 * vastgelegd.
 */
export function KilometervergoedingInstelling({
  waarde,
}: {
  waarde: number | null;
}) {
  const router = useRouter();
  const [bewerken, setBewerken] = React.useState(false);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);

  async function bewaar(formulier: FormData) {
    setBezig(true);
    const resultaat = await bewaarKilometervergoeding({
      vergoeding: String(formulier.get("vergoeding") ?? ""),
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) {
      setBewerken(false);
      router.refresh();
    }
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-center justify-between gap-4">
        <dt className="text-muted-foreground">Kilometervergoeding</dt>
        <dd className="flex items-center gap-1 font-medium tabular-nums">
          {waarde != null ? `${formatteerBedrag(waarde)} per km` : "niet ingesteld"}
          {!bewerken ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label="Kilometervergoeding wijzigen"
              onClick={() => {
                setBewerken(true);
                setMelding(null);
              }}
            >
              <Pencil aria-hidden />
            </Button>
          ) : null}
        </dd>
      </div>

      {bewerken ? (
        <form action={bewaar} className="flex flex-wrap items-center justify-end gap-2">
          <label htmlFor="kilometervergoeding" className="text-xs text-muted-foreground">
            Bedrag per km in euro
          </label>
          <Input
            id="kilometervergoeding"
            name="vergoeding"
            inputMode="decimal"
            autoComplete="off"
            autoFocus
            defaultValue={waarde != null ? String(waarde).replace(".", ",") : "0,25"}
            className="h-8 w-24 text-right"
          />
          <Button type="submit" size="sm" disabled={bezig}>
            {bezig ? "Bezig…" : "Opslaan"}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setBewerken(false)}>
            Annuleren
          </Button>
        </form>
      ) : null}

      {melding ? (
        <p className="text-right text-xs text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
}
