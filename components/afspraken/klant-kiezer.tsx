"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Klant } from "@/lib/data/types";

/**
 * Combobox met zoeken-tijdens-typen op naam en plaats (SPEC.md 6.2).
 * Zoeken begint vanaf twee tekens.
 */
export function KlantKiezer({
  klanten,
  waarde,
  onKies,
  foutmelding,
}: {
  klanten: Klant[];
  waarde: string;
  onKies: (klantId: string) => void;
  foutmelding?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [zoekterm, setZoekterm] = React.useState("");
  const [gemarkeerd, setGemarkeerd] = React.useState(0);
  const omhulsel = React.useRef<HTMLDivElement>(null);

  const gekozen = klanten.find((klant) => klant.id === waarde) ?? null;

  const resultaten = React.useMemo(() => {
    const term = zoekterm.trim().toLowerCase();
    if (term.length < 2) return [];
    return klanten
      .filter(
        (klant) =>
          klant.naam.toLowerCase().includes(term) ||
          klant.plaats.toLowerCase().includes(term),
      )
      .slice(0, 8);
  }, [klanten, zoekterm]);

  // Sluiten zodra er buiten de combobox wordt geklikt.
  React.useEffect(() => {
    if (!open) return;
    function bijKlik(gebeurtenis: MouseEvent) {
      if (!omhulsel.current?.contains(gebeurtenis.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", bijKlik);
    return () => document.removeEventListener("mousedown", bijKlik);
  }, [open]);

  function kies(klant: Klant) {
    onKies(klant.id);
    setZoekterm("");
    setOpen(false);
  }

  function bijToets(gebeurtenis: React.KeyboardEvent<HTMLInputElement>) {
    if (gebeurtenis.key === "ArrowDown") {
      gebeurtenis.preventDefault();
      setGemarkeerd((huidig) => Math.min(huidig + 1, resultaten.length - 1));
    } else if (gebeurtenis.key === "ArrowUp") {
      gebeurtenis.preventDefault();
      setGemarkeerd((huidig) => Math.max(huidig - 1, 0));
    } else if (gebeurtenis.key === "Enter" && resultaten[gemarkeerd]) {
      gebeurtenis.preventDefault();
      kies(resultaten[gemarkeerd]);
    } else if (gebeurtenis.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={omhulsel} className="relative">
      {open ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            autoFocus
            role="combobox"
            aria-expanded
            aria-controls="klant-resultaten"
            aria-label="Zoek een school op naam of plaats"
            placeholder="Zoek op naam of plaats…"
            className="pl-8"
            value={zoekterm}
            onChange={(gebeurtenis) => {
              setZoekterm(gebeurtenis.target.value);
              setGemarkeerd(0);
            }}
            onKeyDown={bijToets}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="listbox"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            foutmelding && "border-destructive",
          )}
        >
          {gekozen ? (
            <span>
              {gekozen.naam}
              <span className="text-muted-foreground"> · {gekozen.plaats}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">Kies een school…</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      )}

      {open ? (
        <ul
          id="klant-resultaten"
          role="listbox"
          className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {zoekterm.trim().length < 2 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Typ minimaal twee tekens om te zoeken.
            </li>
          ) : resultaten.length === 0 ? (
            <li className="px-2 py-1.5 text-sm text-muted-foreground">
              Geen school gevonden. Gebruik &ldquo;Nieuwe school&rdquo; om er een
              toe te voegen.
            </li>
          ) : (
            resultaten.map((klant, positie) => (
              <li key={klant.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={klant.id === waarde}
                  onMouseEnter={() => setGemarkeerd(positie)}
                  onClick={() => kies(klant)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm",
                    positie === gemarkeerd && "bg-accent text-accent-foreground",
                  )}
                >
                  <span>
                    {klant.naam}
                    <span className="text-muted-foreground">
                      {" "}
                      · {klant.plaats}
                    </span>
                  </span>
                  {klant.id === waarde ? (
                    <Check className="size-4 shrink-0" aria-hidden />
                  ) : null}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
