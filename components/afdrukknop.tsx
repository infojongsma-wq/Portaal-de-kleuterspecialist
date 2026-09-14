"use client";

import { Printer } from "lucide-react";

import { Button } from "@/components/ui/button";

/**
 * PDF-knop.
 *
 * Er zit bewust geen PDF-bibliotheek achter. De browser maakt zelf een nette
 * PDF van de pagina — in het venster dat opengaat kies je "Opslaan als PDF".
 * Dat scheelt een zware afhankelijkheid, en de opmaak blijft precies gelijk
 * aan wat op het scherm staat. De afdrukopmaak staat in `globals.css`.
 */
export function Afdrukknop({ label = "PDF" }: { label?: string }) {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={() => window.print()}
      className="afdruk-verbergen"
    >
      <Printer aria-hidden />
      {label}
    </Button>
  );
}
