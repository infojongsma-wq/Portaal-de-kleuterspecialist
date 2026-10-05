"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { formatteerDatum, leesNederlandseDatum } from "@/lib/formatteer";

/**
 * Datumveld in Nederlandse notatie.
 *
 * Een `<input type="date">` toont de notatie van de browsertaal — op een
 * Engelstalig systeem dus `mm/dd/jjjj`. CLAUDE.md schrijft `dd-mm-jjjj` voor,
 * en dat is met een eigen veld het enige wat gegarandeerd klopt. De waarde die
 * naar buiten gaat is altijd ISO `jjjj-mm-dd`.
 */
export function Datumveld({
  id,
  waarde,
  onWijzig,
  ...rest
}: Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> & {
  waarde: string;
  onWijzig: (isoDatum: string) => void;
}) {
  const [tekst, setTekst] = React.useState(() =>
    waarde ? formatteerDatum(waarde) : "",
  );
  const [vorigeWaarde, setVorigeWaarde] = React.useState(waarde);

  // De waarde kan van buitenaf veranderen, bijvoorbeeld als er in de agenda een
  // andere afspraak wordt aangeklikt. Dat bijstellen gebeurt tijdens het
  // renderen en niet in een effect, anders volgt er een tweede renderronde.
  //
  // Komt de nieuwe waarde uit onze eigen invoer, dan blijft de tekst staan
  // zoals die is getypt — anders zou `1-3-2027` halverwege omspringen naar
  // `01-03-2027` en de cursor meenemen.
  if (waarde !== vorigeWaarde) {
    setVorigeWaarde(waarde);
    if (waarde !== (leesNederlandseDatum(tekst) ?? "")) {
      setTekst(waarde ? formatteerDatum(waarde) : "");
    }
  }

  function bijWijziging(nieuweTekst: string) {
    setTekst(nieuweTekst);
    if (nieuweTekst.trim() === "") {
      onWijzig("");
      return;
    }
    const iso = leesNederlandseDatum(nieuweTekst);
    if (iso) onWijzig(iso);
  }

  function bijVerlaten() {
    // Onleesbare invoer terugzetten op de laatst geldige datum.
    const iso = leesNederlandseDatum(tekst);
    setTekst(iso ? formatteerDatum(iso) : waarde ? formatteerDatum(waarde) : "");
  }

  const geldig = tekst === "" || leesNederlandseDatum(tekst) !== null;

  return (
    <Input
      id={id}
      inputMode="numeric"
      autoComplete="off"
      placeholder="dd-mm-jjjj"
      aria-invalid={geldig ? undefined : true}
      value={tekst}
      onChange={(gebeurtenis) => bijWijziging(gebeurtenis.target.value)}
      onBlur={bijVerlaten}
      {...rest}
    />
  );
}
