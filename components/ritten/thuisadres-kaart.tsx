"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Home, Pencil } from "lucide-react";

import { bewaarThuisadres } from "@/app/ritten/acties";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export interface Thuisadres {
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
}

/** "Laaressingel 12, 7514 AB Enschede", of `null` zonder woonplaats. */
export function thuisadresInEenRegel(thuis: Thuisadres): string | null {
  if (!thuis.plaats?.trim()) return null;
  const plaatsregel = [thuis.postcode, thuis.plaats].filter(Boolean).join(" ");
  return [thuis.adres, plaatsregel].filter(Boolean).join(", ");
}

/**
 * Het thuisadres van de medewerker (SPEC.md 6.7). Thuis staat bovenaan in de
 * keuzelijsten van Van en Naar. Voor de afstand gebruikt de app alleen de
 * woonplaats; het adres zelf gaat nergens heen.
 */
export function ThuisadresKaart({ thuis }: { thuis: Thuisadres }) {
  const router = useRouter();
  const ingesteld = thuisadresInEenRegel(thuis);
  const [bewerken, setBewerken] = React.useState(!ingesteld);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});

  async function bewaar(formulier: FormData) {
    setBezig(true);
    const resultaat = await bewaarThuisadres({
      adres: String(formulier.get("adres") ?? ""),
      postcode: String(formulier.get("postcode") ?? ""),
      plaats: String(formulier.get("plaats") ?? ""),
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    setFouten(resultaat.velden ?? {});
    if (resultaat.gelukt) {
      setBewerken(false);
      router.refresh();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Home className="size-5 text-primary" aria-hidden />
          {ingesteld ? "Thuis" : "Stel eerst je thuisadres in"}
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3">
        {!bewerken && ingesteld ? (
          <div className="flex items-start justify-between gap-3">
            <p className="text-sm">{ingesteld}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setBewerken(true);
                setMelding(null);
              }}
            >
              <Pencil aria-hidden />
              Wijzigen
            </Button>
          </div>
        ) : (
          <form action={bewaar} className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="thuis-adres">Straat en huisnummer</Label>
              <Input
                id="thuis-adres"
                name="adres"
                autoComplete="street-address"
                defaultValue={thuis.adres ?? ""}
              />
              <Fout melding={fouten.adres} />
            </div>
            <div className="grid grid-cols-[8rem_1fr] gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="thuis-postcode">Postcode</Label>
                <Input
                  id="thuis-postcode"
                  name="postcode"
                  autoComplete="postal-code"
                  placeholder="1234 AB"
                  defaultValue={thuis.postcode ?? ""}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="thuis-plaats">Woonplaats</Label>
                <Input
                  id="thuis-plaats"
                  name="plaats"
                  autoComplete="address-level2"
                  required
                  defaultValue={thuis.plaats ?? ""}
                />
              </div>
            </div>
            <Fout melding={fouten.postcode ?? fouten.plaats} />
            <div className="flex gap-2">
              <Button type="submit" disabled={bezig}>
                {bezig ? "Bezig…" : "Thuisadres opslaan"}
              </Button>
              {ingesteld ? (
                <Button type="button" variant="ghost" onClick={() => setBewerken(false)}>
                  Annuleren
                </Button>
              ) : null}
            </div>
          </form>
        )}

        <p className="text-xs text-muted-foreground">
          Thuis staat bovenaan bij Van en Naar. Voor de afstand gebruikt de app
          alleen je woonplaats; je straat en huisnummer gaan nergens heen.
        </p>

        {melding ? (
          <p className="text-sm text-muted-foreground" role="status">
            {melding}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function Fout({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {melding}
    </p>
  );
}
