"use client";

import * as React from "react";
import { Plus } from "lucide-react";

import { bewaarKlant } from "@/app/afspraken/acties";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Dialoog "nieuwe school", geopend vanuit het afspraakformulier (SPEC.md 6.2). */
export function NieuweKlantDialoog({
  onToegevoegd,
}: {
  onToegevoegd: (klantId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [bezig, setBezig] = React.useState(false);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});
  const [melding, setMelding] = React.useState<string | null>(null);

  async function verstuur(formulier: FormData) {
    setBezig(true);
    setMelding(null);

    const resultaat = await bewaarKlant(Object.fromEntries(formulier));

    setBezig(false);
    if (!resultaat.gelukt) {
      setFouten(resultaat.velden ?? {});
      setMelding(resultaat.melding ?? "Opslaan is niet gelukt.");
      return;
    }

    setFouten({});
    setOpen(false);
    if (resultaat.id) onToegevoegd(resultaat.id);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <Plus aria-hidden />
          Nieuwe school
        </Button>
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nieuwe school</DialogTitle>
          <DialogDescription>
            De reistijd is de enkele reis vanaf de standplaats in Enschede.
          </DialogDescription>
        </DialogHeader>

        <form action={verstuur} className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="klant-naam">Naam van de school</Label>
            <Input id="klant-naam" name="naam" required autoComplete="off" />
            <Fout melding={fouten.naam} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="klant-plaats">Plaats</Label>
              <Input id="klant-plaats" name="plaats" required autoComplete="off" />
              <Fout melding={fouten.plaats} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="klant-postcode">Postcode</Label>
              <Input id="klant-postcode" name="postcode" autoComplete="off" />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="klant-adres">Adres</Label>
            <Input id="klant-adres" name="adres" autoComplete="off" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="klant-reistijd">Reistijd enkele reis (minuten)</Label>
              <Input
                id="klant-reistijd"
                name="reistijdEnkelMinuten"
                type="number"
                min={0}
                max={600}
                defaultValue={0}
                required
              />
              <Fout melding={fouten.reistijdEnkelMinuten} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="klant-afstand">Afstand enkele reis (km)</Label>
              <Input
                id="klant-afstand"
                name="reisafstandEnkelKm"
                type="number"
                min={0}
                step="0.1"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="klant-contact">Contactpersoon</Label>
              <Input
                id="klant-contact"
                name="contactpersoonNaam"
                autoComplete="off"
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="klant-functie">Functie</Label>
              <Input
                id="klant-functie"
                name="contactpersoonFunctie"
                autoComplete="off"
              />
            </div>
          </div>

          {melding ? (
            <p className="text-sm text-destructive" role="alert">
              {melding}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Annuleren
            </Button>
            <Button type="submit" disabled={bezig}>
              {bezig ? "Bezig met opslaan…" : "School toevoegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
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
