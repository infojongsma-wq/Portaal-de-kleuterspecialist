"use client";

import * as React from "react";
import { Check, ChevronsUpDown, History, Home, MapPin, Plus, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  isThuis,
  normaliseerPlaats,
  THUIS,
  type PlaatsSuggestie,
} from "@/lib/ritten/plaatsen";
import { cn } from "@/lib/utils";

interface Optie {
  sleutel: string;
  waarde: string;
  titel: string;
  omschrijving?: string;
  groep: "thuis" | "eerder" | "nederland" | "eigen";
}

const GROEPKOPPEN: Partial<Record<Optie["groep"], string>> = {
  eerder: "Eerder gebruikt",
  nederland: "Plaatsen in Nederland",
};

/**
 * Keuzelijst voor Van en Naar (SPEC.md 6.7).
 *
 * Bovenaan staat altijd Thuis, daaronder de plaatsen die de medewerker eerder
 * gebruikte. Typt ze iets nieuws, dan komen er Nederlandse plaatsnamen bij,
 * via onze eigen server bij PDOK opgezocht. Staat de plaats er niet tussen,
 * bijvoorbeeld een plaats over de grens, dan kan ze hem gewoon gebruiken
 * zoals getypt.
 */
export function PlaatsKiezer({
  id,
  waarde,
  onKies,
  eerderGebruikt,
  thuisOmschrijving,
  foutmelding,
}: {
  id: string;
  waarde: string;
  onKies: (plaats: string) => void;
  eerderGebruikt: string[];
  /** Het thuisadres in één regel, of `null` als het nog niet is ingesteld. */
  thuisOmschrijving: string | null;
  foutmelding?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [zoekterm, setZoekterm] = React.useState("");
  const [gemarkeerd, setGemarkeerd] = React.useState(0);
  const [suggesties, setSuggesties] = React.useState<PlaatsSuggestie[]>([]);
  const [bezig, setBezig] = React.useState(false);
  const omhulsel = React.useRef<HTMLDivElement>(null);

  const term = zoekterm.trim();
  const zoekNormaal = normaliseerPlaats(term);

  // Plaatsnamen opzoeken terwijl er getypt wordt, met een korte pauze zodat
  // niet elke toetsaanslag een vraag wordt.
  React.useEffect(() => {
    if (!open || term.length < 2) return;

    const afbreken = new AbortController();
    const wachten = window.setTimeout(async () => {
      setBezig(true);
      try {
        const antwoord = await fetch(
          `/api/plaatsen?q=${encodeURIComponent(term)}`,
          { signal: afbreken.signal },
        );
        const gegevens = (await antwoord.json()) as {
          suggesties?: PlaatsSuggestie[];
        };
        setSuggesties(gegevens.suggesties ?? []);
      } catch {
        // Afgebroken of geen verbinding: dan alleen de eigen plaatsen.
        if (!afbreken.signal.aborted) setSuggesties([]);
      } finally {
        if (!afbreken.signal.aborted) setBezig(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(wachten);
      afbreken.abort();
    };
  }, [open, term]);

  const opties = React.useMemo<Optie[]>(() => {
    const lijst: Optie[] = [];

    if (term === "" || normaliseerPlaats(THUIS).startsWith(zoekNormaal)) {
      lijst.push({
        sleutel: "thuis",
        waarde: THUIS,
        titel: THUIS,
        omschrijving: thuisOmschrijving ?? "Nog geen thuisadres ingesteld",
        groep: "thuis",
      });
    }

    const eerder = eerderGebruikt.filter((plaats) =>
      normaliseerPlaats(plaats).includes(zoekNormaal),
    );
    for (const plaats of term === "" ? eerder.slice(0, 12) : eerder) {
      lijst.push({
        sleutel: `eerder-${plaats}`,
        waarde: plaats,
        titel: plaats,
        groep: "eerder",
      });
    }

    if (term.length >= 2) {
      const alGetoond = new Set(lijst.map((optie) => normaliseerPlaats(optie.waarde)));
      for (const suggestie of suggesties) {
        const sleutel = normaliseerPlaats(suggestie.label);
        if (alGetoond.has(sleutel)) continue;
        alGetoond.add(sleutel);
        lijst.push({
          sleutel: `nl-${suggestie.label}`,
          waarde: suggestie.label,
          titel: suggestie.label,
          omschrijving: [suggestie.gemeente, suggestie.provincie]
            .filter((deel, positie, delen) => deel && delen.indexOf(deel) === positie)
            .join(", "),
          groep: "nederland",
        });
      }

      if (!alGetoond.has(zoekNormaal) && !isThuis(term)) {
        lijst.push({
          sleutel: "eigen",
          waarde: term,
          titel: `“${term}” gebruiken`,
          omschrijving: "Zoals getypt, bijvoorbeeld een plaats over de grens",
          groep: "eigen",
        });
      }
    }

    return lijst;
  }, [term, zoekNormaal, eerderGebruikt, suggesties, thuisOmschrijving]);

  // Sluiten zodra er buiten de keuzelijst wordt geklikt.
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

  function kies(optie: Optie) {
    onKies(optie.waarde);
    setZoekterm("");
    setSuggesties([]);
    setOpen(false);
  }

  function bijToets(gebeurtenis: React.KeyboardEvent<HTMLInputElement>) {
    if (gebeurtenis.key === "ArrowDown") {
      gebeurtenis.preventDefault();
      setGemarkeerd((huidig) => Math.min(huidig + 1, opties.length - 1));
    } else if (gebeurtenis.key === "ArrowUp") {
      gebeurtenis.preventDefault();
      setGemarkeerd((huidig) => Math.max(huidig - 1, 0));
    } else if (gebeurtenis.key === "Enter") {
      gebeurtenis.preventDefault();
      const optie = opties[gemarkeerd];
      if (optie) kies(optie);
    } else if (gebeurtenis.key === "Escape") {
      setOpen(false);
    }
  }

  const lijstId = `${id}-plaatsen`;

  return (
    <div ref={omhulsel} className="relative">
      {open ? (
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            id={id}
            autoFocus
            autoComplete="off"
            role="combobox"
            aria-expanded
            aria-controls={lijstId}
            placeholder="Typ een plaats, bijvoorbeeld Hengelo"
            className="h-10 pl-8"
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
          id={id}
          type="button"
          onClick={() => {
            setOpen(true);
            setGemarkeerd(0);
          }}
          aria-haspopup="listbox"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-left text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            foutmelding && "border-destructive",
          )}
        >
          {waarde ? (
            <span className="flex min-w-0 items-center gap-2">
              {isThuis(waarde) ? (
                <Home className="size-4 shrink-0 text-primary" aria-hidden />
              ) : (
                <MapPin className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span className="truncate">
                {waarde}
                {isThuis(waarde) && thuisOmschrijving ? (
                  <span className="text-muted-foreground"> · {thuisOmschrijving}</span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Kies of typ een plaats…</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      )}

      {open ? (
        <ul
          id={lijstId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-80 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
        >
          {opties.map((optie, positie) => {
            const vorige = opties[positie - 1];
            const kop =
              GROEPKOPPEN[optie.groep] && vorige?.groep !== optie.groep
                ? GROEPKOPPEN[optie.groep]
                : null;
            const gekozen =
              waarde !== "" &&
              normaliseerPlaats(waarde) === normaliseerPlaats(optie.waarde);

            return (
              <React.Fragment key={optie.sleutel}>
                {kop ? (
                  <li
                    role="presentation"
                    className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground"
                  >
                    {kop}
                  </li>
                ) : null}
                <li>
                  <button
                    type="button"
                    role="option"
                    aria-selected={gekozen}
                    onMouseEnter={() => setGemarkeerd(positie)}
                    onClick={() => kies(optie)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-sm px-2 py-2 text-left text-sm",
                      positie === gemarkeerd && "bg-accent text-accent-foreground",
                    )}
                  >
                    <Pictogram groep={optie.groep} />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate", optie.groep === "thuis" && "font-medium")}>
                        {optie.titel}
                      </span>
                      {optie.omschrijving ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {optie.omschrijving}
                        </span>
                      ) : null}
                    </span>
                    {gekozen ? <Check className="size-4 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              </React.Fragment>
            );
          })}

          {term.length >= 2 && bezig ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Plaatsen zoeken…
            </li>
          ) : null}

          {term.length === 1 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Typ nog een letter om te zoeken.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Pictogram({ groep }: { groep: Optie["groep"] }) {
  const klasse = "size-4 shrink-0";
  switch (groep) {
    case "thuis":
      return <Home className={cn(klasse, "text-primary")} aria-hidden />;
    case "eerder":
      return <History className={cn(klasse, "text-muted-foreground")} aria-hidden />;
    case "nederland":
      return <MapPin className={cn(klasse, "text-muted-foreground")} aria-hidden />;
    case "eigen":
      return <Plus className={cn(klasse, "text-muted-foreground")} aria-hidden />;
  }
}
