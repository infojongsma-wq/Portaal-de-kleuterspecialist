"use client";

import * as React from "react";

import { Datumveld } from "@/components/ui/datumveld";

/**
 * Datumveld voor filterformulieren die met een gewone GET versturen.
 * Het zichtbare veld toont `dd-mm-jjjj`; het verborgen veld stuurt ISO mee,
 * zodat de serverpagina de waarde direct kan vergelijken.
 */
export function Datumfilter({
  id,
  name,
  beginwaarde = "",
}: {
  id: string;
  name: string;
  beginwaarde?: string;
}) {
  const [waarde, setWaarde] = React.useState(beginwaarde);

  return (
    <>
      <Datumveld id={id} waarde={waarde} onWijzig={setWaarde} />
      <input type="hidden" name={name} value={waarde} />
    </>
  );
}
