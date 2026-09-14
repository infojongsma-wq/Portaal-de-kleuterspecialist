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

/**
 * Dialoog "nieuwe school", geopend vanuit het afspraakformulier.
 *
 * Let op: hier staat bewust **geen `<form>`**. Deze dialoog wordt geopend
 * vanuit het afspraakformulier, en hoewel de inhoud via een portal buiten dat
 * formulier in de DOM terechtkomt, blijft hij in de React-boom een kind ervan.
 * Een verzendsignaal liep daardoor omhoog naar react-hook-form, dat het met
 * `preventDefault` tegenhield — de school werd dan zonder enige melding niet
 * opgeslagen. Met losse velden en een gewone knop kan dat niet gebeuren.
 */

const LEEG = {
  naam: "",
  plaats: "",
  postcode: "",
  adres: "",
  reistijdEnkelMinuten: "0",
  reisafstandEnkelKm: "",
  telefoonAlgemeen: "",
  emailAlgemeen: "",
  contactpersoonNaam: "",
  contactpersoonFunctie: "",
  contactpersoonEmail: "",
};

export function NieuweKlantDialoog({
  onToegevoegd,
}: {
  onToegevoegd: (klantId: string) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const [waarden, setWaarden] = React.useState(LEEG);
  const [bezig, setBezig] = React.useState(false);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});
  const [melding, setMelding] = React.useState<string | null>(null);

  function zet(veld: keyof typeof LEEG) {
    return (gebeurtenis: React.ChangeEvent<HTMLInputElement>) =>
      setWaarden((huidig) => ({
        ...huidig,
        [veld]: gebeurtenis.target.value,
      }));
  }

  function sluit() {
    setOpen(false);
    setWaarden(LEEG);
    setFouten({});
    setMelding(null);
  }

  async function bewaar() {
    setBezig(true);
    setMelding(null);

    const resultaat = await bewaarKlant(waarden);

    setBezig(false);
    if (!resultaat.gelukt) {
      setFouten(resultaat.velden ?? {});
      setMelding(resultaat.melding ?? "Opslaan is niet gelukt.");
      return;
    }

    const id = resultaat.id;
    sluit();
    if (id) onToegevoegd(id);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nieuweStand) => (nieuweStand ? setOpen(true) : sluit())}
    >
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

        <div className="grid gap-4">
          <Veld
            id="klant-naam"
            label="Naam van de school"
            waarde={waarden.naam}
            onWijzig={zet("naam")}
            fout={fouten.naam}
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <Veld
              id="klant-plaats"
              label="Plaats"
              waarde={waarden.plaats}
              onWijzig={zet("plaats")}
              fout={fouten.plaats}
            />
            <Veld
              id="klant-postcode"
              label="Postcode"
              waarde={waarden.postcode}
              onWijzig={zet("postcode")}
            />
          </div>

          <Veld
            id="klant-adres"
            label="Adres"
            waarde={waarden.adres}
            onWijzig={zet("adres")}
          />

          <div className="grid grid-cols-2 gap-3">
            <Veld
              id="klant-reistijd"
              label="Reistijd enkele reis (minuten)"
              type="number"
              waarde={waarden.reistijdEnkelMinuten}
              onWijzig={zet("reistijdEnkelMinuten")}
              fout={fouten.reistijdEnkelMinuten}
            />
            <Veld
              id="klant-afstand"
              label="Afstand enkele reis (km)"
              type="number"
              waarde={waarden.reisafstandEnkelKm}
              onWijzig={zet("reisafstandEnkelKm")}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Veld
              id="klant-contact"
              label="Contactpersoon"
              waarde={waarden.contactpersoonNaam}
              onWijzig={zet("contactpersoonNaam")}
            />
            <Veld
              id="klant-functie"
              label="Functie"
              waarde={waarden.contactpersoonFunctie}
              onWijzig={zet("contactpersoonFunctie")}
            />
          </div>

          {melding ? (
            <p className="text-sm text-destructive" role="alert">
              {melding}
            </p>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={sluit}>
            Annuleren
          </Button>
          <Button type="button" onClick={bewaar} disabled={bezig}>
            {bezig ? "Bezig met opslaan…" : "School toevoegen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Veld({
  id,
  label,
  waarde,
  onWijzig,
  fout,
  type = "text",
  autoFocus,
}: {
  id: string;
  label: string;
  waarde: string;
  onWijzig: (gebeurtenis: React.ChangeEvent<HTMLInputElement>) => void;
  fout?: string;
  type?: string;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={waarde}
        onChange={onWijzig}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-invalid={fout ? true : undefined}
      />
      {fout ? (
        <p className="text-xs text-destructive" role="alert">
          {fout}
        </p>
      ) : null}
    </div>
  );
}
