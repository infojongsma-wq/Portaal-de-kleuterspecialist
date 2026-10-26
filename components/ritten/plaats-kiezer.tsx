"use client";

import * as React from "react";
import {
  Check,
  ChevronsUpDown,
  History,
  Home,
  MapPin,
  Plus,
  School as SchoolIcoon,
  Search,
} from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  adresInEenRegel,
  isThuis,
  normaliseerPlaats,
  schoolLabel,
  THUIS,
  type PlaatsSuggestie,
  type School,
} from "@/lib/ritten/plaatsen";
import { cn } from "@/lib/utils";

interface Optie {
  sleutel: string;
  /** Wat er in de rit komt te staan. */
  waarde: string;
  titel: string;
  omschrijving?: string;
  groep: "thuis" | "eerder" | "scholen" | "nederland" | "eigen";
  pictogram: "thuis" | "eerder" | "school" | "plaats" | "eigen";
}

const GROEPKOPPEN: Partial<Record<Optie["groep"], string>> = {
  eerder: "Eerder gebruikt",
  scholen: "Scholen uit Klanten",
  nederland: "Adressen en plaatsen in Nederland",
};

/**
 * Keuzelijst voor Van en Naar (SPEC.md 6.7). Kiezen kan op vier manieren:
 *
 * - Thuis, altijd bovenaan;
 * - een plaats of adres dat eerder is gebruikt;
 * - een school uit Klanten, met het adres dat daar staat;
 * - tijdens het typen een woonplaats of, met een huisnummer erbij, een adres
 *   uit de officiële lijst van de overheid (PDOK, via onze eigen server).
 *
 * Staat het er niet tussen, bijvoorbeeld een adres over de grens, dan kan het
 * gewoon zoals getypt.
 */
export function PlaatsKiezer({
  id,
  waarde,
  onKies,
  eerderGebruikt,
  scholen,
  thuisOmschrijving,
  foutmelding,
}: {
  id: string;
  waarde: string;
  onKies: (plaats: string) => void;
  eerderGebruikt: string[];
  scholen: School[];
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

  // Scholen op hun label, zodat een eerder gekozen school er weer als school
  // uitziet: naam boven, adres eronder.
  const scholenOpLabel = React.useMemo(
    () =>
      new Map(
        scholen.map((school) => [normaliseerPlaats(schoolLabel(school)), school]),
      ),
    [scholen],
  );

  // Plaatsen en adressen opzoeken terwijl er getypt wordt, met een korte pauze
  // zodat niet elke toetsaanslag een vraag wordt.
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
        // Afgebroken of geen verbinding: dan alleen wat de app zelf kent.
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
    const alGetoond = new Set<string>();
    const voegToe = (optie: Optie) => {
      const sleutel = normaliseerPlaats(optie.waarde);
      if (alGetoond.has(sleutel)) return;
      alGetoond.add(sleutel);
      lijst.push(optie);
    };

    if (term === "" || normaliseerPlaats(THUIS).startsWith(zoekNormaal)) {
      voegToe({
        sleutel: "thuis",
        waarde: THUIS,
        titel: THUIS,
        omschrijving: thuisOmschrijving ?? "Nog geen thuisadres ingesteld",
        groep: "thuis",
        pictogram: "thuis",
      });
    }

    const eerder = eerderGebruikt.filter((plaats) =>
      normaliseerPlaats(plaats).includes(zoekNormaal),
    );
    for (const plaats of term === "" ? eerder.slice(0, 12) : eerder) {
      const school = scholenOpLabel.get(normaliseerPlaats(plaats));
      voegToe({
        sleutel: `eerder-${plaats}`,
        waarde: plaats,
        titel: school ? school.naam : plaats,
        omschrijving: school ? (adresInEenRegel(school) ?? undefined) : undefined,
        groep: "eerder",
        pictogram: school ? "school" : "eerder",
      });
    }

    if (term.length >= 2) {
      const passendeScholen = scholen
        .filter((school) =>
          [school.naam, school.adres ?? "", school.plaats ?? ""].some((deel) =>
            normaliseerPlaats(deel).includes(zoekNormaal),
          ),
        )
        .slice(0, 6);
      for (const school of passendeScholen) {
        voegToe({
          sleutel: `school-${schoolLabel(school)}`,
          waarde: schoolLabel(school),
          titel: school.naam,
          omschrijving: adresInEenRegel(school) ?? undefined,
          groep: "scholen",
          pictogram: "school",
        });
      }

      for (const suggestie of suggesties) {
        voegToe({
          sleutel: `nl-${suggestie.label}`,
          waarde: suggestie.label,
          titel: suggestie.label,
          omschrijving:
            suggestie.soort === "adres"
              ? "Adres"
              : [suggestie.gemeente, suggestie.provincie]
                  .filter(
                    (deel, positie, delen) => deel && delen.indexOf(deel) === positie,
                  )
                  .join(", "),
          groep: "nederland",
          pictogram: "plaats",
        });
      }

      if (!isThuis(term)) {
        voegToe({
          sleutel: "eigen",
          waarde: term,
          titel: `“${term}” gebruiken`,
          omschrijving: "Zoals getypt, bijvoorbeeld een adres over de grens",
          groep: "eigen",
          pictogram: "eigen",
        });
      }
    }

    return lijst;
  }, [term, zoekNormaal, eerderGebruikt, scholen, scholenOpLabel, suggesties, thuisOmschrijving]);

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
  const gekozenSchool = waarde ? scholenOpLabel.get(normaliseerPlaats(waarde)) : undefined;

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
            placeholder="Typ een plaats, adres of school"
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
            "flex min-h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 py-1.5 text-left text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            foutmelding && "border-destructive",
          )}
        >
          {waarde ? (
            <span className="flex min-w-0 items-center gap-2">
              <Pictogram
                soort={isThuis(waarde) ? "thuis" : gekozenSchool ? "school" : "plaats"}
              />
              <span className="min-w-0">
                <span className="block truncate">
                  {gekozenSchool ? gekozenSchool.naam : waarde}
                </span>
                {isThuis(waarde) && thuisOmschrijving ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {thuisOmschrijving}
                  </span>
                ) : gekozenSchool && adresInEenRegel(gekozenSchool) ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    {adresInEenRegel(gekozenSchool)}
                  </span>
                ) : null}
              </span>
            </span>
          ) : (
            <span className="text-muted-foreground">Kies of typ een plaats, adres of school…</span>
          )}
          <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden />
        </button>
      )}

      {open ? (
        <ul
          id={lijstId}
          role="listbox"
          className="absolute z-50 mt-1 max-h-96 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md"
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
                    <Pictogram soort={optie.pictogram} />
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          "block truncate",
                          (optie.groep === "thuis" || optie.pictogram === "school") &&
                            "font-medium",
                        )}
                      >
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
              Zoeken…
            </li>
          ) : null}

          {term.length === 1 ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Typ nog een letter om te zoeken.
            </li>
          ) : null}

          {term.length >= 2 && !/\d/.test(term) ? (
            <li className="px-2 py-1.5 text-xs text-muted-foreground">
              Tip: typ er een huisnummer bij om een adres te kiezen, bijvoorbeeld
              &ldquo;Schoolweg 5 Hengelo&rdquo;.
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

function Pictogram({ soort }: { soort: Optie["pictogram"] }) {
  const klasse = "size-4 shrink-0";
  switch (soort) {
    case "thuis":
      return <Home className={cn(klasse, "text-primary")} aria-hidden />;
    case "school":
      return <SchoolIcoon className={cn(klasse, "text-primary")} aria-hidden />;
    case "eerder":
      return <History className={cn(klasse, "text-muted-foreground")} aria-hidden />;
    case "plaats":
      return <MapPin className={cn(klasse, "text-muted-foreground")} aria-hidden />;
    case "eigen":
      return <Plus className={cn(klasse, "text-muted-foreground")} aria-hidden />;
  }
}
