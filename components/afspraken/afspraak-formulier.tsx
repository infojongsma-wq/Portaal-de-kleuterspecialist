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
  SelectItem,
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
import {
  afspraakSchema,
  type AfspraakFormulier,
} from "@/lib/validatie/afspraak";

const DAGDELEN: Array<{ waarde: Dagdeel; label: string }> = [
  { waarde: "ochtend", label: "Ochtend" },
  { waarde: "middag", label: "Middag" },
  { waarde: "anders", label: "Anders" },
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
    voltooid: false,
  };
}

function naarFormulier(afspraak: Afspraak): AfspraakFormulier {
  return {
    id: afspraak.id,
    klantId: afspraak.klantId,
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
    voltooid: afspraak.status === "voltooid",
  };
}

/**
 * Afspraakformulier, linkerkolom van het hoofdscherm.
 *
 * De medewerker vult alleen in wát er gebeurt en wanneer. De uren op locatie,
 * de voorbereidingsuren en de reistijd worden serverside afgeleid uit de soort
 * training en de school; ze staan hier bewust niet.
 */
export function AfspraakFormulier({
  klanten,
  contactpersonen,
  trainingsoorten,
  afspraak,
  gekozenDatum,
  onNieuw,
}: {
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  trainingsoorten: Activiteitsoort[];
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
    resolver: zodResolver(afspraakSchema),
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
    setValue("activiteitsoortId", soortId, { shouldValidate: true });
    // De naam van de soort is een bruikbare werktitel zolang er nog niets
    // eigens is ingevuld.
    const soort = trainingsoorten.find((s) => s.id === soortId);
    if (soort && !titel.trim()) setValue("titel", soort.naam);
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

      {/* Soort training */}
      <div className="grid gap-1.5">
        <Label htmlFor="activiteitsoort">Soort training</Label>
        <Select value={activiteitsoortId} onValueChange={kiesSoort}>
          <SelectTrigger id="activiteitsoort">
            <SelectValue placeholder="Kies een soort training" />
          </SelectTrigger>
          <SelectContent>
            {trainingsoorten.map((soort) => (
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
          </SelectContent>
        </Select>
        <Fout melding={errors.activiteitsoortId?.message} />
      </div>

      {/* Naam van de training */}
      <div className="grid gap-1.5">
        <Label htmlFor="titel">Naam van de training</Label>
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
        <p className="text-xs text-muted-foreground">
          Laat leeg als de training wel is afgesproken maar nog niet is
          ingepland.
        </p>
        <Fout melding={errors.datum?.message} />
      </div>

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
      <div className="grid gap-1.5">
        <Label htmlFor="afsprakenMetKlant">Afspraken met de school</Label>
        <Textarea
          id="afsprakenMetKlant"
          rows={3}
          {...register("afsprakenMetKlant")}
        />
        <PrivacyWaarschuwing />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="notitie">Notitie of memo</Label>
        <Textarea id="notitie" rows={3} {...register("notitie")} />
        <PrivacyWaarschuwing />
      </div>

      {/* Vinkje */}
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
          Training gedaan
        </Label>
      </div>

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

        {afspraak && afspraak.status !== "geannuleerd" ? (
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
