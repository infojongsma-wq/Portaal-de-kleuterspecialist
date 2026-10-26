"use client";

import * as React from "react";
import { Check, Loader2, PencilLine } from "lucide-react";

import { PlaatsKiezer } from "@/components/ritten/plaats-kiezer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  adresInEenRegel,
  adresVelden,
  huisnummerGetal,
  isPostcode,
  isThuis,
  LEGE_ADRESVELDEN,
  netjesPostcode,
  samengesteldAdres,
  schoolLabel,
  zelfdePlaats,
  type Adres,
  type AdresVelden,
  type School,
} from "@/lib/ritten/plaatsen";
import { cn } from "@/lib/utils";

type Zoekstatus = "rust" | "bezig" | "gevonden" | "niet-gevonden" | "fout";

/**
 * Van of Naar invullen (SPEC.md 6.7), op twee manieren:
 *
 * 1. Snel kiezen uit de keuzelijst: Thuis, een school uit Klanten, of een
 *    plaats of adres dat eerder is gebruikt.
 * 2. Het adres invullen in vier velden. Na postcode en huisnummer vult de app
 *    straat en plaats vanzelf in uit de officiële adressen van de overheid
 *    (PDOK, via onze eigen server), zoals bij een webwinkel. Een adres over
 *    de grens kan ook: dan typ je straat en plaats zelf.
 *
 * Wat er uiteindelijk in de rit komt, is één regel tekst, bijvoorbeeld
 * "Schoolweg 5, 5678 CD Hengelo". De velden zijn de manier om die regel te
 * maken; een keuze uit de lijst vult ze in.
 */
export function AdresInvoer({
  id,
  label,
  waarde,
  onWijzig,
  eerderGebruikt,
  scholen,
  thuis,
  foutmelding,
}: {
  id: string;
  label: string;
  waarde: string;
  onWijzig: (waarde: string) => void;
  eerderGebruikt: string[];
  scholen: School[];
  thuis: Adres | null;
  foutmelding?: string;
}) {
  const boek = React.useMemo(() => ({ thuis, scholen }), [thuis, scholen]);
  const [velden, setVelden] = React.useState<AdresVelden>(() =>
    adresVelden(waarde, boek),
  );
  const [vorigeWaarde, setVorigeWaarde] = React.useState(waarde);
  const [eigenWaarde, setEigenWaarde] = React.useState<string | null>(null);
  const [zoekstatus, setZoekstatus] = React.useState<Zoekstatus>("rust");
  const wachttijd = React.useRef<number | null>(null);
  const afbreker = React.useRef<AbortController | null>(null);

  // De waarde kan van buitenaf veranderen: een keuze uit de lijst, of een
  // andere rit die wordt geopend. Dan volgen de velden. Komt de nieuwe waarde
  // uit deze velden zelf, dan blijven ze staan zoals ze getypt zijn. Dit
  // gebeurt tijdens het renderen en niet in een effect; anders volgt er een
  // tweede renderronde.
  if (waarde !== vorigeWaarde) {
    setVorigeWaarde(waarde);
    if (waarde !== eigenWaarde) {
      setVelden(adresVelden(waarde, boek));
      setZoekstatus("rust");
    }
  }

  // Opzoeken dat nog loopt, stopt als het onderdeel verdwijnt.
  React.useEffect(
    () => () => {
      if (wachttijd.current) window.clearTimeout(wachttijd.current);
      afbreker.current?.abort();
    },
    [],
  );

  const isSchool = scholen.some((school) =>
    zelfdePlaats(schoolLabel(school), waarde),
  );
  const vergrendeld = isThuis(waarde) || isSchool;

  function stopOpzoeken() {
    if (wachttijd.current) window.clearTimeout(wachttijd.current);
    wachttijd.current = null;
    afbreker.current?.abort();
    afbreker.current = null;
  }

  /** Maakt van de velden één adres en geeft het door, als het af is. */
  function bevestig(nieuw: AdresVelden) {
    const samen = samengesteldAdres(nieuw);
    if (!samen || zelfdePlaats(samen, waarde)) return;
    setEigenWaarde(samen);
    onWijzig(samen);
  }

  async function zoekAdres(basis: AdresVelden, postcode: string, nummer: number) {
    const afbreken = new AbortController();
    afbreker.current = afbreken;
    setZoekstatus("bezig");

    try {
      const antwoord = await fetch(
        `/api/adres?postcode=${encodeURIComponent(postcode)}&huisnummer=${nummer}`,
        { signal: afbreken.signal },
      );
      if (afbreken.signal.aborted) return;
      if (antwoord.status === 404) {
        setZoekstatus("niet-gevonden");
        return;
      }
      const gevonden = antwoord.ok
        ? ((await antwoord.json()) as { straat?: string; plaats?: string })
        : null;
      if (!gevonden?.straat || !gevonden.plaats) {
        setZoekstatus(antwoord.ok ? "niet-gevonden" : "fout");
        return;
      }

      const nieuw = {
        ...basis,
        postcode: netjesPostcode(basis.postcode.trim()),
        straat: gevonden.straat,
        plaats: gevonden.plaats,
      };
      setVelden(nieuw);
      setZoekstatus("gevonden");
      bevestig(nieuw);
    } catch {
      if (!afbreken.signal.aborted) setZoekstatus("fout");
    }
  }

  /** Na postcode en huisnummer even wachten of er nog getypt wordt, dan opzoeken. */
  function planOpzoeken(nieuw: AdresVelden) {
    stopOpzoeken();
    const postcode = nieuw.postcode.replace(/\s+/g, "").toUpperCase();
    const nummer = huisnummerGetal(nieuw.huisnummer);
    if (!isPostcode(postcode) || nummer === null) {
      setZoekstatus("rust");
      return;
    }
    wachttijd.current = window.setTimeout(() => {
      void zoekAdres(nieuw, postcode, nummer);
    }, 400);
  }

  function wijzigVeld(veld: keyof AdresVelden, tekst: string) {
    const nieuw = { ...velden, [veld]: tekst };
    setVelden(nieuw);
    if (veld === "postcode" || veld === "huisnummer") planOpzoeken(nieuw);
  }

  function kiesUitLijst(gekozen: string) {
    stopOpzoeken();
    onWijzig(gekozen);
  }

  function anderAdres() {
    stopOpzoeken();
    setVelden(LEGE_ADRESVELDEN);
    setZoekstatus("rust");
    setEigenWaarde("");
    onWijzig("");
  }

  const veldId = (veld: string) => `${id}-${veld}`;
  const thuisOmschrijving = thuis ? adresInEenRegel(thuis) : null;
  const leeg = Object.values(velden).every((tekst) => !tekst.trim());

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-sm font-medium">
        {label}
      </Label>

      <PlaatsKiezer
        id={id}
        waarde={waarde}
        onKies={kiesUitLijst}
        eerderGebruikt={eerderGebruikt}
        scholen={scholen}
        thuisOmschrijving={thuisOmschrijving}
        foutmelding={foutmelding}
      />

      <fieldset className="grid gap-2 rounded-md border border-dashed p-3">
        <legend className="px-1 text-xs text-muted-foreground">
          {isThuis(waarde)
            ? "Adres van Thuis"
            : isSchool
              ? "Adres van de school, uit Klanten"
              : "Of vul het adres in"}
        </legend>

        <div className="grid grid-cols-[minmax(0,8rem)_minmax(0,6.5rem)] gap-2">
          <Veldje
            id={veldId("postcode")}
            label="Postcode"
            waarde={velden.postcode}
            placeholder="1234 AB"
            autoComplete="postal-code"
            alleenLezen={vergrendeld}
            onWijzig={(tekst) => wijzigVeld("postcode", tekst)}
            onKlaar={() => bevestig(velden)}
          />
          <Veldje
            id={veldId("huisnummer")}
            label="Huisnummer"
            waarde={velden.huisnummer}
            placeholder="12a"
            alleenLezen={vergrendeld}
            onWijzig={(tekst) => wijzigVeld("huisnummer", tekst)}
            onKlaar={() => bevestig(velden)}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Veldje
            id={veldId("straat")}
            label="Straat"
            waarde={velden.straat}
            alleenLezen={vergrendeld}
            onWijzig={(tekst) => wijzigVeld("straat", tekst)}
            onKlaar={() => bevestig(velden)}
          />
          <Veldje
            id={veldId("plaats")}
            label="Plaats"
            waarde={velden.plaats}
            autoComplete="address-level2"
            alleenLezen={vergrendeld}
            onWijzig={(tekst) => wijzigVeld("plaats", tekst)}
            onKlaar={() => bevestig(velden)}
          />
        </div>

        <div className="flex min-h-5 flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <Statusregel
            status={zoekstatus}
            vergrendeld={vergrendeld}
            thuis={isThuis(waarde)}
            leeg={leeg}
          />
          {vergrendeld ? (
            <Button
              type="button"
              variant="link"
              size="sm"
              className="h-auto p-0 text-xs"
              onClick={anderAdres}
            >
              <PencilLine aria-hidden />
              Ander adres invullen
            </Button>
          ) : null}
        </div>
      </fieldset>

      {foutmelding ? (
        <p className="text-xs text-destructive" role="alert">
          {foutmelding}
        </p>
      ) : null}
    </div>
  );
}

function Veldje({
  id,
  label,
  waarde,
  placeholder,
  autoComplete,
  alleenLezen,
  onWijzig,
  onKlaar,
}: {
  id: string;
  label: string;
  waarde: string;
  placeholder?: string;
  autoComplete?: string;
  alleenLezen: boolean;
  onWijzig: (tekst: string) => void;
  onKlaar: () => void;
}) {
  return (
    <div className="grid min-w-0 gap-1">
      <Label htmlFor={id} className="text-xs font-normal text-muted-foreground">
        {label}
      </Label>
      <Input
        id={id}
        value={waarde}
        placeholder={alleenLezen ? undefined : placeholder}
        autoComplete={autoComplete ?? "off"}
        readOnly={alleenLezen}
        tabIndex={alleenLezen ? -1 : undefined}
        className={cn("h-9", alleenLezen && "bg-muted text-muted-foreground")}
        onChange={(gebeurtenis) => onWijzig(gebeurtenis.target.value)}
        onBlur={onKlaar}
      />
    </div>
  );
}

function Statusregel({
  status,
  vergrendeld,
  thuis,
  leeg,
}: {
  status: Zoekstatus;
  vergrendeld: boolean;
  thuis: boolean;
  leeg: boolean;
}) {
  if (vergrendeld) {
    return (
      <span>
        {thuis
          ? "Je thuisadres. Wijzigen kan bovenaan, bij Thuis."
          : "Wijzigen kan bij Klanten."}
      </span>
    );
  }

  switch (status) {
    case "bezig":
      return (
        <span className="flex items-center gap-1.5">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Adres opzoeken…
        </span>
      );
    case "gevonden":
      return (
        <span className="flex items-center gap-1.5">
          <Check className="size-3.5 text-primary" aria-hidden />
          Straat en plaats zijn ingevuld.
        </span>
      );
    case "niet-gevonden":
      return (
        <span className="text-amber-700 dark:text-amber-500">
          Dit adres is niet gevonden. Controleer postcode en huisnummer, of vul
          straat en plaats zelf in.
        </span>
      );
    case "fout":
      return <span>Opzoeken lukte nu niet. Vul straat en plaats zelf in.</span>;
    default:
      return leeg ? (
        <span>
          Vul postcode en huisnummer in; straat en plaats vullen zich vanzelf.
        </span>
      ) : (
        <span />
      );
  }
}
