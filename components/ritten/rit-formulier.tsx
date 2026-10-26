"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, Loader2, Save } from "lucide-react";

import { bewaarRit, zoekAfstand, type Afstand } from "@/app/ritten/acties";
import { AdresInvoer } from "@/components/ritten/adres-invoer";
import { PrivacyWaarschuwing } from "@/components/privacy-waarschuwing";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Datumveld } from "@/components/ui/datumveld";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Rit } from "@/lib/data/types";
import {
  formatteerBedrag,
  formatteerKm,
  formatteerUrenKlok,
} from "@/lib/formatteer";
import {
  adresInEenRegel,
  THUIS,
  type Adres,
  type School,
} from "@/lib/ritten/plaatsen";
import { bedragVanRit, kmVanRit, reistijdVanRitMinuten } from "@/lib/uren";
import {
  afwijkendeReistijdMinuten,
  leesDecimaal,
  leesReisduur,
  ritSchema,
  type RitFormulier as RitWaarden,
} from "@/lib/validatie/rit";

/** Waar het getal bij Kilometers vandaan komt; voor de uitleg eronder. */
type Afstandstatus =
  | { soort: "leeg"; melding?: string | null }
  | { soort: "bezig" }
  | { soort: "berekend" }
  | { soort: "onthouden"; melding: string | null }
  | { soort: "zelf"; melding?: string | null }
  | { soort: "opgeslagen" };

function leeg(datum: string, thuisIngesteld: boolean): RitWaarden {
  return {
    id: "",
    datum,
    doel: "",
    // De meeste ritten beginnen thuis.
    vanPlaats: thuisIngesteld ? THUIS : "",
    naarPlaats: "",
    heenEnTerug: false,
    kmEnkel: "",
    reisduurEnkelMinuten: "",
    afwijkend: false,
    afwijkendUren: "",
    afwijkendMinuten: "",
  };
}

/** Minuten als `1u30`. */
function klok(minuten: number): string {
  return formatteerUrenKlok(minuten / 60);
}

function naarFormulier(rit: Rit): RitWaarden {
  return {
    id: rit.id,
    datum: rit.datum,
    doel: rit.doel,
    vanPlaats: rit.vanPlaats,
    naarPlaats: rit.naarPlaats,
    heenEnTerug: rit.heenEnTerug,
    kmEnkel: String(rit.kmEnkel),
    reisduurEnkelMinuten:
      rit.reisduurEnkelMinuten === null ? "" : String(rit.reisduurEnkelMinuten),
    afwijkend: rit.afwijkendeReistijdMinuten !== null,
    afwijkendUren:
      rit.afwijkendeReistijdMinuten === null
        ? ""
        : String(Math.floor(rit.afwijkendeReistijdMinuten / 60)),
    afwijkendMinuten:
      rit.afwijkendeReistijdMinuten === null
        ? ""
        : String(rit.afwijkendeReistijdMinuten % 60),
  };
}

/**
 * Een rit invoeren of wijzigen (SPEC.md 6.7).
 *
 * Zo eenvoudig mogelijk: datum, doel, van, naar, en of het heen en terug was.
 * De kilometers en de reistijd verschijnen vanzelf zodra Van en Naar gekozen
 * zijn, en het bedrag staat er meteen onder. Bij files of een omleiding vult
 * de medewerker met "Afwijkende reistijd" de werkelijke reistijd in.
 */
export function RitFormulier({
  rit,
  vandaag,
  eerderGebruikt,
  scholen,
  thuis,
  vergoedingPerKm,
  onKlaar,
}: {
  /** De rit die wordt gewijzigd, of `null` voor een nieuwe rit. */
  rit: Rit | null;
  vandaag: string;
  eerderGebruikt: string[];
  /** Scholen uit Klanten, met hun adres, om bij Van en Naar uit te kiezen. */
  scholen: School[];
  /** Het thuisadres, of `null` als het nog niet is ingesteld. */
  thuis: Adres | null;
  /** De vergoeding die nu geldt, of `null` als die nog niet is ingesteld. */
  vergoedingPerKm: number | null;
  onKlaar: () => void;
}) {
  const router = useRouter();
  const [melding, setMelding] = React.useState<string | null>(null);
  const [afstand, setAfstand] = React.useState<Afstandstatus>({ soort: "leeg" });
  const verzoek = React.useRef(0);
  const thuisIngesteld = thuis !== null && adresInEenRegel(thuis) !== null;

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RitWaarden>({
    resolver: zodResolver(ritSchema),
    defaultValues: rit ? naarFormulier(rit) : leeg(vandaag, thuisIngesteld),
  });

  // Klikt de medewerker in de lijst op een andere rit, dan volgt het formulier.
  // Heeft die rit nog geen reistijd, bijvoorbeeld omdat hij van vóór de
  // reistijd bij de ritten is, dan zoekt het formulier die meteen op.
  React.useEffect(() => {
    reset(rit ? naarFormulier(rit) : leeg(vandaag, thuisIngesteld));
    setAfstand(rit ? { soort: "opgeslagen" } : { soort: "leeg" });
    setMelding(null);
    const nummer = ++verzoek.current;
    if (
      rit &&
      rit.reisduurEnkelMinuten === null &&
      rit.afwijkendeReistijdMinuten === null
    ) {
      void zoekAfstand(rit.vanPlaats, rit.naarPlaats)
        .then((uitkomst) => {
          if (nummer !== verzoek.current) return;
          if (uitkomst.reisduurEnkelMinuten !== null) {
            setValue("reisduurEnkelMinuten", String(uitkomst.reisduurEnkelMinuten));
          } else {
            setValue("afwijkend", true);
          }
        })
        .catch(() => {
          if (nummer === verzoek.current) setValue("afwijkend", true);
        });
    }
  }, [rit, vandaag, thuisIngesteld, reset, setValue]);

  const datum = watch("datum");
  const vanPlaats = watch("vanPlaats");
  const naarPlaats = watch("naarPlaats");
  const heenEnTerug = watch("heenEnTerug");
  const kmTekst = watch("kmEnkel");
  const reisduurTekst = watch("reisduurEnkelMinuten");
  const afwijkend = watch("afwijkend");
  const afwijkendUren = watch("afwijkendUren");
  const afwijkendMinuten = watch("afwijkendMinuten");

  /**
   * Zoekt de afstand op zodra Van en Naar allebei gekozen zijn. Een antwoord
   * dat binnenkomt nadat er alweer iets anders is gekozen, telt niet meer.
   */
  async function haalAfstand(van: string, naar: string) {
    const nummer = ++verzoek.current;
    if (!van || !naar) {
      setAfstand({ soort: "leeg" });
      return;
    }

    setAfstand({ soort: "bezig" });
    setValue("kmEnkel", "");
    setValue("reisduurEnkelMinuten", "");

    let uitkomst: Afstand;
    try {
      uitkomst = await zoekAfstand(van, naar);
    } catch {
      if (nummer !== verzoek.current) return;
      setAfstand({
        soort: "zelf",
        melding:
          "De afstand kon niet worden opgehaald. Vul de kilometers en de reistijd zelf in.",
      });
      setValue("afwijkend", true);
      return;
    }
    if (nummer !== verzoek.current) return;

    // Zonder berekende reisduur vult de medewerker de reistijd zelf in.
    if (uitkomst.reisduurEnkelMinuten !== null) {
      setValue("reisduurEnkelMinuten", String(uitkomst.reisduurEnkelMinuten));
    } else {
      setValue("afwijkend", true);
    }

    if (uitkomst.kmEnkel !== null) {
      setValue("kmEnkel", String(uitkomst.kmEnkel), { shouldValidate: true });
      setAfstand(
        uitkomst.bron === "onthouden"
          ? { soort: "onthouden", melding: uitkomst.melding }
          : { soort: "berekend" },
      );
    } else {
      setAfstand({ soort: "zelf", melding: uitkomst.melding });
    }
  }

  function kiesVan(plaats: string) {
    setValue("vanPlaats", plaats, { shouldValidate: true });
    void haalAfstand(plaats, naarPlaats);
  }

  function kiesNaar(plaats: string) {
    setValue("naarPlaats", plaats, { shouldValidate: true });
    void haalAfstand(vanPlaats, plaats);
  }

  async function opslaan(waarden: RitWaarden) {
    let resultaat: Awaited<ReturnType<typeof bewaarRit>>;
    try {
      resultaat = await bewaarRit(waarden);
    } catch {
      setMelding(
        "Opslaan is niet gelukt. Controleer je internetverbinding en probeer het opnieuw.",
      );
      return;
    }
    setMelding(resultaat.melding ?? null);
    if (!resultaat.gelukt) return;

    router.refresh();
    if (rit) {
      onKlaar();
    } else {
      // Klaar voor de volgende rit; de datum blijft staan, want vaak komen er
      // meer ritten van dezelfde dag achter elkaar.
      reset(leeg(waarden.datum, thuisIngesteld));
      setAfstand({ soort: "leeg" });
      verzoek.current += 1;
    }
  }

  // Het bedrag rekent mee terwijl er wordt ingevuld. Een bestaande rit houdt
  // de vergoeding waarmee hij is vastgelegd.
  const vergoeding = rit?.vergoedingPerKm ?? vergoedingPerKm;
  const km = leesDecimaal(kmTekst);
  const geldigeKm = km !== null && Number.isFinite(km) && km > 0 ? km : null;

  // De reistijd van deze rit, zoals hij gaat meetellen (SPEC.md 5.2).
  const reisduur = leesReisduur(reisduurTekst);
  const reistijd = reistijdVanRitMinuten({
    datum,
    heenEnTerug,
    reisduurEnkelMinuten: reisduur,
    afwijkendeReistijdMinuten: afwijkend
      ? afwijkendeReistijdMinuten(afwijkendUren, afwijkendMinuten)
      : null,
  });

  return (
    <form onSubmit={handleSubmit(opslaan)} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">
          {rit ? "Rit wijzigen" : "Nieuwe rit"}
        </h2>
        {rit ? (
          <Button type="button" variant="ghost" size="sm" onClick={onKlaar}>
            Nieuwe rit
          </Button>
        ) : null}
      </div>

      <Veld label="Datum" htmlFor="rit-datum" fout={errors.datum?.message}>
        <Datumveld
          id="rit-datum"
          waarde={datum}
          onWijzig={(nieuw) => setValue("datum", nieuw, { shouldValidate: true })}
          className="h-10 w-40"
        />
      </Veld>

      <Veld
        label="Doel van de rit"
        htmlFor="rit-doel"
        fout={errors.doel?.message}
        uitleg={<PrivacyWaarschuwing />}
      >
        <Input
          id="rit-doel"
          autoComplete="off"
          placeholder="Bijvoorbeeld: training bij een school"
          className="h-10"
          {...register("doel")}
        />
      </Veld>

      <div className="grid gap-2">
        <AdresInvoer
          id="rit-van"
          label="Van"
          waarde={vanPlaats}
          onWijzig={kiesVan}
          eerderGebruikt={eerderGebruikt}
          scholen={scholen}
          thuis={thuis}
          foutmelding={errors.vanPlaats?.message}
        />
        <ArrowDown className="mx-auto size-4 text-muted-foreground" aria-hidden />
        <AdresInvoer
          id="rit-naar"
          label="Naar"
          waarde={naarPlaats}
          onWijzig={kiesNaar}
          eerderGebruikt={eerderGebruikt}
          scholen={scholen}
          thuis={thuis}
          foutmelding={errors.naarPlaats?.message}
        />
      </div>

      <div className="flex items-start gap-2.5 rounded-md border p-3">
        <Controller
          control={control}
          name="heenEnTerug"
          render={({ field }) => (
            <Checkbox
              id="rit-heen-en-terug"
              checked={field.value}
              onCheckedChange={(aan) => field.onChange(aan === true)}
              className="mt-0.5"
            />
          )}
        />
        <Label htmlFor="rit-heen-en-terug" className="grid gap-0.5 font-normal">
          <span className="font-medium">Vice versa (heen en terug)</span>
          <span className="text-xs text-muted-foreground">
            Vink aan als je dezelfde weg ook weer terug bent gereden. De
            kilometers tellen dan dubbel.
          </span>
        </Label>
      </div>

      <Veld
        label="Kilometers (enkele reis)"
        htmlFor="rit-km"
        fout={errors.kmEnkel?.message}
        uitleg={<Afstanduitleg status={afstand} />}
      >
        <div className="relative w-40">
          <Input
            id="rit-km"
            type="number"
            inputMode="decimal"
            step="0.1"
            min={0.1}
            max={1500}
            className="h-10 pr-10"
            {...register("kmEnkel", {
              onChange: () => {
                verzoek.current += 1;
                setAfstand({ soort: "zelf" });
              },
            })}
          />
          {afstand.soort === "bezig" ? (
            <Loader2
              className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              aria-label="Afstand wordt berekend"
            />
          ) : (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              km
            </span>
          )}
        </div>
      </Veld>

      <Reistijdveld
        bezig={afstand.soort === "bezig"}
        gekozen={Boolean(vanPlaats && naarPlaats)}
        heenEnTerug={heenEnTerug}
        reisduur={reisduur}
        afwijkend={afwijkend}
        fout={errors.afwijkendUren?.message ?? errors.reisduurEnkelMinuten?.message}
        urenVeld={register("afwijkendUren")}
        minutenVeld={register("afwijkendMinuten")}
        onAfwijkend={(aan) => {
          setValue("afwijkend", aan, { shouldValidate: !aan });
          if (!aan) {
            setValue("afwijkendUren", "");
            setValue("afwijkendMinuten", "");
          }
        }}
      />

      {/* Meteen zien wat de rit oplevert. */}
      <div className="rounded-md bg-secondary px-4 py-3" aria-live="polite">
        {vergoeding == null ? (
          <p className="text-sm">
            De kilometervergoeding is nog niet ingesteld. De beheerder vult die
            in bij Beheer → Instellingen.
          </p>
        ) : geldigeKm !== null ? (
          <>
            <p className="text-base font-semibold">
              Totaal {formatteerKm(kmVanRit({ kmEnkel: geldigeKm, heenEnTerug }))} km
              {" · "}
              {formatteerBedrag(
                bedragVanRit({
                  kmEnkel: geldigeKm,
                  heenEnTerug,
                  vergoedingPerKm: vergoeding,
                }),
              )}
              {reistijd !== null ? ` · reistijd ${klok(reistijd)}` : null}
            </p>
            <p className="text-xs text-muted-foreground">
              {formatteerKm(geldigeKm)} km
              {heenEnTerug ? " × 2 (heen en terug)" : ""} ×{" "}
              {formatteerBedrag(vergoeding)} per km
            </p>
            {reistijd !== null ? (
              <p className="text-xs text-muted-foreground">
                De reistijd telt mee als werktijd, na aftrek van een uur eigen
                tijd per enkele reis, met hooguit 2 uur per dag.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Kies waar je vandaan kwam en waar je naartoe ging; dan verschijnen
            de kilometers en het bedrag hier.
          </p>
        )}
      </div>

      {melding ? (
        <p className="text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" size="lg" disabled={isSubmitting || vergoeding == null}>
          <Save aria-hidden />
          {isSubmitting ? "Bezig met opslaan…" : rit ? "Wijziging opslaan" : "Rit opslaan"}
        </Button>
        {rit ? (
          <Button type="button" variant="ghost" onClick={onKlaar}>
            Annuleren
          </Button>
        ) : null}
      </div>
    </form>
  );
}

function Veld({
  label,
  htmlFor,
  fout,
  uitleg,
  children,
}: {
  label: string;
  htmlFor: string;
  fout?: string;
  uitleg?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-sm font-medium">
        {label}
      </Label>
      {children}
      {uitleg}
      {fout ? (
        <p className="text-xs text-destructive" role="alert">
          {fout}
        </p>
      ) : null}
    </div>
  );
}

function Afstanduitleg({ status }: { status: Afstandstatus }) {
  const tekst = (() => {
    switch (status.soort) {
      case "bezig":
        return "De afstand wordt berekend…";
      case "berekend":
        // Google wil een vermelding als hun gegevens zonder kaart worden getoond.
        return "Berekend met Google Maps: de snelste route met de auto, van adres tot adres. Klopt het niet? Pas het getal gewoon aan.";
      case "onthouden":
        return status.melding ?? "Zelfde afstand als bij je vorige rit over deze route.";
      case "zelf":
        return status.melding ?? "Zelf ingevuld. De volgende keer vult de app deze route vanzelf in.";
      case "opgeslagen":
        return "De afstand zoals hij is opgeslagen.";
      default:
        return status.melding ?? null;
    }
  })();

  if (!tekst) return null;
  return <p className="text-xs text-muted-foreground">{tekst}</p>;
}

/**
 * De reistijd van de rit (SPEC.md 6.7): berekend, of met "Afwijkende
 * reistijd" zelf ingevuld, in uren en minuten.
 */
function Reistijdveld({
  bezig,
  gekozen,
  heenEnTerug,
  reisduur,
  afwijkend,
  fout,
  urenVeld,
  minutenVeld,
  onAfwijkend,
}: {
  bezig: boolean;
  /** Zijn Van en Naar allebei gekozen? */
  gekozen: boolean;
  heenEnTerug: boolean;
  /** Berekende reisduur van de enkele reis in minuten, of `null`. */
  reisduur: number | null;
  afwijkend: boolean;
  fout?: string;
  urenVeld: React.ComponentProps<"input">;
  minutenVeld: React.ComponentProps<"input">;
  onAfwijkend: (aan: boolean) => void;
}) {
  const berekend = reisduur !== null ? reisduur * (heenEnTerug ? 2 : 1) : null;

  return (
    <div className="grid gap-1.5">
      <p className="text-sm font-medium">Reistijd</p>

      {!afwijkend ? (
        bezig ? (
          <p className="text-sm text-muted-foreground">De reistijd wordt berekend…</p>
        ) : berekend !== null ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="text-sm">
              <span className="font-semibold tabular-nums">{klok(berekend)}</span>
              <span className="text-muted-foreground">
                {heenEnTerug
                  ? ` (2 × ${reisduur! < 60 ? `${reisduur} min` : klok(reisduur!)}, heen en terug, zonder files)`
                  : " (enkele reis, zonder files)"}
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onAfwijkend(true)}
            >
              Afwijkende reistijd
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {gekozen ? "Nog niet bekend." : "Verschijnt zodra Van en Naar zijn gekozen."}
          </p>
        )
      ) : (
        <fieldset className="grid gap-2 rounded-md border p-3">
          <legend className="px-1 text-xs text-muted-foreground">
            Werkelijke reistijd van de hele rit
            {heenEnTerug ? ", heen en terug samen" : ""}
          </legend>
          <div className="flex items-center gap-2">
            <Input
              aria-label="Uren"
              inputMode="numeric"
              placeholder="0"
              className="h-10 w-16 text-right"
              {...urenVeld}
            />
            <span className="text-sm">uur</span>
            <Input
              aria-label="Minuten"
              inputMode="numeric"
              placeholder="0"
              className="h-10 w-16 text-right"
              {...minutenVeld}
            />
            <span className="text-sm">min</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {berekend !== null
              ? "Bijvoorbeeld bij files of een omleiding. Je hoeft dit niet te verantwoorden."
              : "De reistijd kon niet worden berekend. Vul hier in hoe lang je hebt gereden."}
          </p>
          {berekend !== null ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => onAfwijkend(false)}
            >
              Berekende reistijd gebruiken ({klok(berekend)})
            </Button>
          ) : null}
        </fieldset>
      )}

      {fout ? (
        <p className="text-xs text-destructive" role="alert">
          {fout}
        </p>
      ) : null}
    </div>
  );
}
