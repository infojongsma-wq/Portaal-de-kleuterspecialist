"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarClock, Save, Trash2, XCircle } from "lucide-react";

import {
  annuleerAfspraak,
  bewaarAfspraak,
  verwijderAfspraak,
} from "@/app/afspraken/acties";
import { KlantKiezer } from "@/components/afspraken/klant-kiezer";
import { NieuweKlantDialoog } from "@/components/afspraken/nieuwe-klant-dialoog";
import { PrivacyWaarschuwing } from "@/components/privacy-waarschuwing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Datumveld } from "@/components/ui/datumveld";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type {
  Activiteitsoort,
  Afspraak,
  Contactpersoon,
  Dagdeel,
  Klant,
} from "@/lib/data/types";
import { CATEGORIELABELS } from "@/lib/uren";
import {
  afspraakSchemaVoor,
  type AfspraakFormulier,
} from "@/lib/validatie/afspraak";

const DAGDELEN: Array<{ waarde: Dagdeel; label: string }> = [
  { waarde: "ochtend", label: "Ochtend" },
  { waarde: "middag", label: "Middag" },
  { waarde: "anders", label: "Anders" },
];

// Twee groepen in het menu: wat op een school gebeurt, en waarvoor de
// medewerker de uren zelf invult.
const SOORTGROEPEN = [
  { label: "Op school", eigenUren: false },
  { label: "Uren zelf invullen", eigenUren: true },
];

const STATUSLABELS: Record<Afspraak["status"], string> = {
  gepland: "Gepland",
  voltooid: "Voltooid",
  geannuleerd: "Geannuleerd",
  verzet: "Verzet",
};

function legeWaarden(datum: string): AfspraakFormulier {
  return {
    id: "",
    klantId: "",
    contactpersoonId: "",
    activiteitsoortId: "",
    titel: "",
    datum,
    dagdelen: ["ochtend"],
    andersOmschrijving: "",
    starttijd: "",
    eindtijd: "",
    afsprakenMetKlant: "",
    notitie: "",
    uren: "",
    voltooid: false,
  };
}

function naarFormulier(afspraak: Afspraak): AfspraakFormulier {
  return {
    id: afspraak.id,
    klantId: afspraak.klantId ?? "",
    contactpersoonId: afspraak.contactpersoonId ?? "",
    activiteitsoortId: afspraak.activiteitsoortId,
    titel: afspraak.titel,
    datum: afspraak.datum ?? "",
    dagdelen: afspraak.dagdelen,
    andersOmschrijving: afspraak.andersOmschrijving ?? "",
    starttijd: afspraak.starttijd ?? "",
    eindtijd: afspraak.eindtijd ?? "",
    afsprakenMetKlant: afspraak.afsprakenMetKlant ?? "",
    notitie: afspraak.notitie ?? "",
    // Alleen zichtbaar bij zelf ingevulde uren; zie `kiesSoort`.
    uren: afspraak.urenOpLocatie > 0 ? String(afspraak.urenOpLocatie) : "",
    voltooid: afspraak.status === "voltooid",
  };
}

/**
 * Afspraakformulier, linkerkolom van het hoofdscherm.
 *
 * Bij een training of observatie vult de medewerker alleen in wát er gebeurt
 * en wanneer. De uren op locatie, de voorbereidingsuren en de reistijd worden
 * serverside afgeleid uit de soort en de school; ze staan hier bewust niet.
 *
 * Bij Literatuurstudie, Overig en Niet beschikbaar is er geen school, en vult
 * de medewerker het aantal uren zelf in.
 */
export function AfspraakFormulier({
  klanten,
  contactpersonen,
  soorten,
  afspraak,
  gekozenDatum,
  onNieuw,
}: {
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  /** Alle actieve soorten, met en zonder school. */
  soorten: Activiteitsoort[];
  afspraak: Afspraak | null;
  gekozenDatum: string | null;
  onNieuw: () => void;
}) {
  const router = useRouter();
  const [melding, setMelding] = React.useState<string | null>(null);
  const [annuleerDialoog, setAnnuleerDialoog] = React.useState(false);

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AfspraakFormulier>({
    // Welke velden verplicht zijn hangt af van de gekozen soort; de server
    // controleert het daarna nog eens met de soort uit de database.
    resolver: (waarden, context, opties) =>
      zodResolver(
        afspraakSchemaVoor(
          soorten.find((soort) => soort.id === waarden.activiteitsoortId),
        ),
      )(waarden, context, opties),
    defaultValues: afspraak
      ? naarFormulier(afspraak)
      : legeWaarden(gekozenDatum ?? ""),
  });

  // De agenda of de trainingslijst kan een andere afspraak aanwijzen; het
  // formulier volgt.
  React.useEffect(() => {
    reset(afspraak ? naarFormulier(afspraak) : legeWaarden(gekozenDatum ?? ""));
    setMelding(null);
  }, [afspraak, gekozenDatum, reset]);

  const klantId = watch("klantId");
  const datum = watch("datum");
  const dagdelen = watch("dagdelen");
  const activiteitsoortId = watch("activiteitsoortId");
  const titel = watch("titel");

  const gekozenSoort = soorten.find((soort) => soort.id === activiteitsoortId);
  // Geen school, wel zelf ingevulde uren: Literatuurstudie, Overig, Niet
  // beschikbaar.
  const eigenUren = gekozenSoort?.handmatigeUren ?? false;
  const teltMee = gekozenSoort?.teltAlsWerktijd ?? true;

  const contactpersonenVanKlant = contactpersonen.filter(
    (persoon) => persoon.klantId === klantId,
  );
  const heleDag =
    dagdelen.includes("ochtend") && dagdelen.includes("middag");

  function kiesKlant(nieuweKlantId: string) {
    setValue("klantId", nieuweKlantId, { shouldValidate: true });
    setValue("contactpersoonId", "");

    const primair = contactpersonen.find(
      (persoon) => persoon.klantId === nieuweKlantId && persoon.isPrimair,
    );
    if (primair) setValue("contactpersoonId", primair.id);
  }

  function kiesSoort(soortId: string) {
    const vorige = gekozenSoort;
    const soort = soorten.find((s) => s.id === soortId);
    setValue("activiteitsoortId", soortId, { shouldValidate: true });

    // De naam van de soort is een bruikbare werktitel zolang er nog niets
    // eigens is ingevuld.
    if (soort && (!titel.trim() || titel === vorige?.naam)) {
      setValue("titel", soort.naam);
    }

    // De vaste uren van een training horen niet in het veld voor zelf
    // ingevulde uren terecht te komen.
    if (vorige && soort && vorige.handmatigeUren !== soort.handmatigeUren) {
      setValue("uren", "");
    }
  }

  function wisselDagdeel(waarde: Dagdeel, aan: boolean) {
    const nieuw = aan
      ? [...dagdelen, waarde]
      : dagdelen.filter((deel) => deel !== waarde);
    setValue("dagdelen", nieuw, { shouldValidate: true });
  }

  async function opslaan(waarden: AfspraakFormulier) {
    const resultaat = await bewaarAfspraak(waarden);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  async function annuleer(voorbereidingGedaan: boolean) {
    if (!afspraak) return;
    setAnnuleerDialoog(false);
    const resultaat = await annuleerAfspraak(afspraak.id, voorbereidingGedaan);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  async function verwijder() {
    if (!afspraak) return;
    const resultaat = await verwijderAfspraak(afspraak.id);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) {
      onNieuw();
      router.refresh();
    }
  }

  return (
    <form onSubmit={handleSubmit(opslaan)} className="flex flex-col gap-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-semibold">
            {afspraak ? "Afspraak bewerken" : "Nieuwe afspraak"}
          </h2>
          {afspraak ? (
            <Badge
              variant={afspraak.status === "voltooid" ? "default" : "secondary"}
            >
              {STATUSLABELS[afspraak.status]}
            </Badge>
          ) : null}
          {afspraak && !afspraak.datum ? (
            <Badge variant="outline">Nog in te plannen</Badge>
          ) : null}
        </div>
        {afspraak ? (
          <Button type="button" variant="ghost" size="sm" onClick={onNieuw}>
            Nieuwe afspraak
          </Button>
        ) : null}
      </div>

      {/* Soort afspraak — bepaalt welke velden er verder nodig zijn */}
      <div className="grid gap-1.5">
        <Label htmlFor="activiteitsoort">Soort afspraak</Label>
        <Select value={activiteitsoortId} onValueChange={kiesSoort}>
          <SelectTrigger id="activiteitsoort">
            <SelectValue placeholder="Kies een soort afspraak" />
          </SelectTrigger>
          <SelectContent>
            {SOORTGROEPEN.map((groep) => {
              const inGroep = soorten.filter(
                (soort) => soort.handmatigeUren === groep.eigenUren,
              );
              if (inGroep.length === 0) return null;
              return (
                <SelectGroup key={groep.label}>
                  <SelectLabel>{groep.label}</SelectLabel>
                  {inGroep.map((soort) => (
                    <SelectItem key={soort.id} value={soort.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: soort.kleur }}
                          aria-hidden
                        />
                        {soort.naam}
                      </span>
                    </SelectItem>
                  ))}
                </SelectGroup>
              );
            })}
          </SelectContent>
        </Select>
        <Fout melding={errors.activiteitsoortId?.message} />
      </div>

      {/* School en contactpersoon: alleen bij een training of observatie */}
      {!eigenUren ? (
        <>
          {/* School */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="klant">School</Label>
              <NieuweKlantDialoog onToegevoegd={kiesKlant} />
            </div>
            <KlantKiezer
              klanten={klanten}
              waarde={klantId}
              onKies={kiesKlant}
              foutmelding={errors.klantId?.message}
            />
            <Fout melding={errors.klantId?.message} />
          </div>

          {/* Contactpersoon */}
          <div className="grid gap-1.5">
            <Label htmlFor="contactpersoon">Contactpersoon</Label>
            <Controller
              control={control}
              name="contactpersoonId"
              render={({ field }) => (
                <Select
                  value={field.value || ""}
                  onValueChange={field.onChange}
                  disabled={contactpersonenVanKlant.length === 0}
                >
                  <SelectTrigger id="contactpersoon">
                    <SelectValue
                      placeholder={
                        klantId
                          ? "Geen contactpersoon bekend"
                          : "Kies eerst een school"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {contactpersonenVanKlant.map((persoon) => (
                      <SelectItem key={persoon.id} value={persoon.id}>
                        {persoon.naam}
                        {persoon.functie ? ` — ${persoon.functie}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </>
      ) : null}

      {/* Naam van de training, of een omschrijving */}
      <div className="grid gap-1.5">
        <Label htmlFor="titel">
          {eigenUren ? "Omschrijving" : "Naam van de training"}
        </Label>
        <Input id="titel" autoComplete="off" {...register("titel")} />
        <Fout melding={errors.titel?.message} />
      </div>

      {/* Datum */}
      <div className="grid gap-1.5">
        <Label htmlFor="datum">Datum</Label>
        <Datumveld
          id="datum"
          waarde={datum}
          onWijzig={(nieuweDatum) =>
            setValue("datum", nieuweDatum, { shouldValidate: true })
          }
        />
        {!eigenUren ? (
          <p className="text-xs text-muted-foreground">
            Laat leeg als de training wel is afgesproken maar nog niet is
            ingepland.
          </p>
        ) : null}
        <Fout melding={errors.datum?.message} />
      </div>

      {/* Zelf ingevulde uren */}
      {eigenUren ? (
        <div className="grid gap-1.5">
          <Label htmlFor="uren">
            Aantal uren
            {!teltMee ? (
              <span className="ml-2 font-normal text-muted-foreground">
                niet verplicht
              </span>
            ) : null}
          </Label>
          <Input
            id="uren"
            type="number"
            inputMode="decimal"
            step="0.25"
            min={0.25}
            max={24}
            className="w-32"
            {...register("uren")}
          />
          <p className="text-xs text-muted-foreground">
            {teltMee
              ? `Telt mee onder "${CATEGORIELABELS[gekozenSoort?.urencategorie ?? "overig"]}" zodra je het als gedaan afvinkt.`
              : "Telt niet mee als gewerkte tijd. Het staat alleen in je agenda."}
          </p>
          <Fout melding={errors.uren?.message} />
        </div>
      ) : null}

      {/* Dagdeel */}
      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">
          Dagdeel
          {heleDag ? (
            <span className="ml-2 font-normal text-muted-foreground">
              hele dag
            </span>
          ) : null}
        </legend>
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          {DAGDELEN.map((optie) => (
            <div key={optie.waarde} className="flex items-center gap-2">
              <Checkbox
                id={`dagdeel-${optie.waarde}`}
                checked={dagdelen.includes(optie.waarde)}
                onCheckedChange={(aan) =>
                  wisselDagdeel(optie.waarde, aan === true)
                }
              />
              <Label
                htmlFor={`dagdeel-${optie.waarde}`}
                className="font-normal"
              >
                {optie.label}
              </Label>
            </div>
          ))}
        </div>
        <Fout melding={errors.dagdelen?.message} />
      </fieldset>

      {dagdelen.includes("anders") ? (
        <div className="grid gap-1.5">
          <Label htmlFor="andersOmschrijving">Anders, namelijk</Label>
          <Input
            id="andersOmschrijving"
            autoComplete="off"
            {...register("andersOmschrijving")}
          />
          <Fout melding={errors.andersOmschrijving?.message} />
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="starttijd">Starttijd</Label>
          <Input id="starttijd" type="time" {...register("starttijd")} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="eindtijd">Eindtijd</Label>
          <Input id="eindtijd" type="time" {...register("eindtijd")} />
          <Fout melding={errors.eindtijd?.message} />
        </div>
      </div>

      {/* Vrije tekstvelden */}
      {!eigenUren ? (
        <div className="grid gap-1.5">
          <Label htmlFor="afsprakenMetKlant">Afspraken met de school</Label>
          <Textarea
            id="afsprakenMetKlant"
            rows={3}
            {...register("afsprakenMetKlant")}
          />
          <PrivacyWaarschuwing />
        </div>
      ) : null}

      <div className="grid gap-1.5">
        <Label htmlFor="notitie">Notitie of memo</Label>
        <Textarea id="notitie" rows={3} {...register("notitie")} />
        <PrivacyWaarschuwing />
      </div>

      {/* Vinkje — niet bij iets wat geen werk is, zoals niet beschikbaar */}
      {teltMee ? (
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="voltooid"
            render={({ field }) => (
              <Checkbox
                id="voltooid"
                checked={field.value}
                onCheckedChange={(aan) => field.onChange(aan === true)}
              />
            )}
          />
          <Label htmlFor="voltooid" className="font-normal">
            {eigenUren ? "Gedaan" : "Training gedaan"}
          </Label>
        </div>
      ) : null}

      {melding ? (
        <p className="text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={isSubmitting}>
          <Save aria-hidden />
          {isSubmitting ? "Bezig met opslaan…" : "Gegevens opslaan"}
        </Button>

        {/* Annuleren gaat over de voorbereiding; die is er bij zelf
            ingevulde uren niet. Verwijderen volstaat dan. */}
        {afspraak && !eigenUren && afspraak.status !== "geannuleerd" ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setAnnuleerDialoog(true)}
          >
            <XCircle aria-hidden />
            Annuleren
          </Button>
        ) : null}

        {afspraak ? (
          <Button
            type="button"
            variant="ghost"
            className="text-destructive"
            onClick={verwijder}
          >
            <Trash2 aria-hidden />
            Verwijderen
          </Button>
        ) : null}

        {afspraak && !afspraak.datum ? (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <CalendarClock className="size-4" aria-hidden />
            Telt pas mee zodra er een datum staat
          </span>
        ) : null}
      </div>

      {/*
        Bij annuleren telt de voorbereiding wél mee als die al gedaan was
        (SPEC.md 5.5). Zonder deze vraag zou dat werk stilzwijgend uit de
        urenverantwoording vallen.
      */}
      <Dialog open={annuleerDialoog} onOpenChange={setAnnuleerDialoog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Afspraak annuleren</DialogTitle>
            <DialogDescription>
              Had je de voorbereiding al gedaan? Dan blijven die uren meetellen
              in je urenverantwoording.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setAnnuleerDialoog(false)}
            >
              Toch niet annuleren
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => annuleer(false)}
            >
              Nee, nog niet gedaan
            </Button>
            <Button type="button" onClick={() => annuleer(true)}>
              Ja, voorbereiding was gedaan
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </form>
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
