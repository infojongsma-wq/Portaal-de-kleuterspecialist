"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CheckCircle2, Save, Trash2, XCircle } from "lucide-react";

import {
  bewaarAfspraak,
  verwijderAfspraak,
  wijzigStatus,
} from "@/app/afspraken/acties";
import { KlantKiezer } from "@/components/afspraken/klant-kiezer";
import { NieuweKlantDialoog } from "@/components/afspraken/nieuwe-klant-dialoog";
import { Urenberekening } from "@/components/afspraken/urenberekening";
import { PrivacyWaarschuwing } from "@/components/privacy-waarschuwing";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Datumveld } from "@/components/ui/datumveld";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { naarIsoDatum } from "@/lib/formatteer";
import type {
  Activiteitsoort,
  Afspraak,
  Contactpersoon,
  Instellingen,
  Klant,
} from "@/lib/data/types";
import type { AfspraakInvoer } from "@/lib/uren";
import {
  afspraakSchema,
  type AfspraakFormulier,
} from "@/lib/validatie/afspraak";

const DAGDELEN = [
  { waarde: "ochtend", label: "Ochtend" },
  { waarde: "middag", label: "Middag" },
  { waarde: "hele_dag", label: "Hele dag" },
  { waarde: "anders", label: "Anders" },
] as const;

const STATUSLABELS: Record<Afspraak["status"], string> = {
  gepland: "Gepland",
  voltooid: "Voltooid",
  geannuleerd: "Geannuleerd",
  verzet: "Verzet",
};

function legeWaarden(vandaag: string): AfspraakFormulier {
  return {
    id: "",
    klantId: "",
    contactpersoonId: "",
    activiteitsoortId: "",
    titel: "",
    datum: vandaag,
    dagdeel: "ochtend",
    andersOmschrijving: "",
    starttijd: "",
    eindtijd: "",
    voorbereidingDatum: vandaag,
    urenOpLocatie: 0,
    urenVoorbereiding: 0,
    reistijdEnkelMinuten: 0,
    afsprakenMetKlant: "",
    notitie: "",
    voltooid: false,
    voorbereidingGedaan: false,
  };
}

function naarFormulier(afspraak: Afspraak): AfspraakFormulier {
  return {
    id: afspraak.id,
    klantId: afspraak.klantId,
    contactpersoonId: afspraak.contactpersoonId ?? "",
    activiteitsoortId: afspraak.activiteitsoortId,
    titel: afspraak.titel,
    datum: afspraak.datum,
    dagdeel: afspraak.dagdeel,
    andersOmschrijving: afspraak.andersOmschrijving ?? "",
    starttijd: afspraak.starttijd ?? "",
    eindtijd: afspraak.eindtijd ?? "",
    voorbereidingDatum: afspraak.voorbereidingDatum,
    urenOpLocatie: afspraak.urenOpLocatie,
    urenVoorbereiding: afspraak.urenVoorbereiding,
    reistijdEnkelMinuten: afspraak.reistijdEnkelMinuten ?? 0,
    afsprakenMetKlant: afspraak.afsprakenMetKlant ?? "",
    notitie: afspraak.notitie ?? "",
    voltooid: afspraak.status === "voltooid",
    voorbereidingGedaan: afspraak.voorbereidingGedaan,
  };
}

/** Afspraakformulier, linkerkolom van het hoofdscherm (SPEC.md 6.2). */
export function AfspraakFormulier({
  klanten,
  contactpersonen,
  activiteitsoorten,
  instellingen,
  afspraak,
  alleAfspraken,
  gekozenDatum,
  onNieuw,
}: {
  klanten: Klant[];
  contactpersonen: Contactpersoon[];
  activiteitsoorten: Activiteitsoort[];
  instellingen: Instellingen;
  afspraak: Afspraak | null;
  alleAfspraken: AfspraakInvoer[];
  gekozenDatum: string | null;
  onNieuw: () => void;
}) {
  const router = useRouter();
  const vandaag = React.useMemo(() => naarIsoDatum(new Date()), []);
  const [melding, setMelding] = React.useState<string | null>(null);

  // Zolang de gebruiker de voorbereidingsdatum niet zelf heeft aangeraakt,
  // loopt die mee met de datum van de afspraak (SPEC.md 6.2).
  const voorbereidingLosgekoppeld = React.useRef(false);

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
      : legeWaarden(gekozenDatum ?? vandaag),
  });

  // De agenda kan een andere afspraak of datum aanwijzen; het formulier volgt.
  React.useEffect(() => {
    voorbereidingLosgekoppeld.current = afspraak
      ? afspraak.datum !== afspraak.voorbereidingDatum
      : false;
    reset(
      afspraak ? naarFormulier(afspraak) : legeWaarden(gekozenDatum ?? vandaag),
    );
    setMelding(null);
  }, [afspraak, gekozenDatum, reset, vandaag]);

  const klantId = watch("klantId");
  const datum = watch("datum");
  const voorbereidingDatum = watch("voorbereidingDatum");
  const dagdeel = watch("dagdeel");
  const activiteitsoortId = watch("activiteitsoortId");
  const urenOpLocatie = watch("urenOpLocatie");
  const urenVoorbereiding = watch("urenVoorbereiding");
  const reistijdEnkelMinuten = watch("reistijdEnkelMinuten");
  const voorbereidingGedaan = watch("voorbereidingGedaan");
  const voltooid = watch("voltooid");

  const gekozenSoort = activiteitsoorten.find(
    (soort) => soort.id === activiteitsoortId,
  );
  const urenHandmatig = gekozenSoort?.handmatigeUren ?? false;

  const contactpersonenVanKlant = contactpersonen.filter(
    (persoon) => persoon.klantId === klantId,
  );

  function kiesKlant(nieuweKlantId: string) {
    setValue("klantId", nieuweKlantId, { shouldValidate: true });
    setValue("contactpersoonId", "");

    const klant = klanten.find((k) => k.id === nieuweKlantId);
    if (klant?.reistijdEnkelMinuten != null) {
      setValue("reistijdEnkelMinuten", klant.reistijdEnkelMinuten);
    }
    // De primaire contactpersoon is de logische eerste keuze.
    const primair = contactpersonen.find(
      (persoon) => persoon.klantId === nieuweKlantId && persoon.isPrimair,
    );
    if (primair) setValue("contactpersoonId", primair.id);
  }

  function kiesActiviteitsoort(soortId: string) {
    setValue("activiteitsoortId", soortId, { shouldValidate: true });
    const soort = activiteitsoorten.find((s) => s.id === soortId);
    if (soort && !soort.handmatigeUren) {
      setValue("urenOpLocatie", soort.urenOpLocatie);
      setValue("urenVoorbereiding", soort.urenVoorbereiding);
    }
  }

  function kiesDatum(nieuweDatum: string) {
    setValue("datum", nieuweDatum, { shouldValidate: true });
    if (!voorbereidingLosgekoppeld.current) {
      setValue("voorbereidingDatum", nieuweDatum);
    }
  }

  const conceptAfspraak: AfspraakInvoer = {
    id: afspraak?.id ?? "concept",
    datum: datum || vandaag,
    voorbereidingDatum: voorbereidingDatum || datum || vandaag,
    urenOpLocatie: Number(urenOpLocatie) || 0,
    urenVoorbereiding: Number(urenVoorbereiding) || 0,
    reistijdEnkelMinuten: Number(reistijdEnkelMinuten) || 0,
    status: voltooid ? "voltooid" : (afspraak?.status ?? "gepland"),
    voorbereidingGedaan,
  };

  const andereAfsprakenOpDezeDag = alleAfspraken.filter(
    (andere) => andere.datum === conceptAfspraak.datum && andere.id !== conceptAfspraak.id,
  );

  async function opslaan(waarden: AfspraakFormulier) {
    const resultaat = await bewaarAfspraak(waarden);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  async function annuleerAfspraak() {
    if (!afspraak) return;
    const resultaat = await wijzigStatus(afspraak.id, "geannuleerd");
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
        <div className="flex items-center gap-2">
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

      {/* Soort activiteit */}
      <div className="grid gap-1.5">
        <Label htmlFor="activiteitsoort">Soort activiteit</Label>
        <Select value={activiteitsoortId} onValueChange={kiesActiviteitsoort}>
          <SelectTrigger id="activiteitsoort">
            <SelectValue placeholder="Kies een soort activiteit" />
          </SelectTrigger>
          <SelectContent>
            {activiteitsoorten.map((soort) => (
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

      {/* Datum en dagdeel */}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="datum">Datum</Label>
          <Datumveld id="datum" waarde={datum} onWijzig={kiesDatum} />
          <Fout melding={errors.datum?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="voorbereidingDatum">Datum voorbereiding</Label>
          <Datumveld
            id="voorbereidingDatum"
            waarde={voorbereidingDatum}
            onWijzig={(nieuweDatum) => {
              voorbereidingLosgekoppeld.current = true;
              setValue("voorbereidingDatum", nieuweDatum, {
                shouldValidate: true,
              });
            }}
          />
          <Fout melding={errors.voorbereidingDatum?.message} />
        </div>
      </div>

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Dagdeel</legend>
        <Controller
          control={control}
          name="dagdeel"
          render={({ field }) => (
            <RadioGroup
              value={field.value}
              onValueChange={field.onChange}
              className="flex flex-wrap gap-x-5 gap-y-2"
            >
              {DAGDELEN.map((optie) => (
                <div key={optie.waarde} className="flex items-center gap-2">
                  <RadioGroupItem
                    value={optie.waarde}
                    id={`dagdeel-${optie.waarde}`}
                  />
                  <Label
                    htmlFor={`dagdeel-${optie.waarde}`}
                    className="font-normal"
                  >
                    {optie.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          )}
        />
      </fieldset>

      {dagdeel === "anders" ? (
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

      {/* Uren en reistijd */}
      <div className="grid grid-cols-3 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="urenOpLocatie">Uren op locatie</Label>
          <Input
            id="urenOpLocatie"
            type="number"
            step="0.25"
            min={0}
            readOnly={!urenHandmatig}
            className={!urenHandmatig ? "bg-muted" : undefined}
            {...register("urenOpLocatie", { valueAsNumber: true })}
          />
          <Fout melding={errors.urenOpLocatie?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="urenVoorbereiding">Uren voorbereiding</Label>
          <Input
            id="urenVoorbereiding"
            type="number"
            step="0.25"
            min={0}
            readOnly={!urenHandmatig}
            className={!urenHandmatig ? "bg-muted" : undefined}
            {...register("urenVoorbereiding", { valueAsNumber: true })}
          />
          <Fout melding={errors.urenVoorbereiding?.message} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="reistijdEnkelMinuten">Reistijd enkel (min)</Label>
          <Input
            id="reistijdEnkelMinuten"
            type="number"
            min={0}
            max={600}
            {...register("reistijdEnkelMinuten", { valueAsNumber: true })}
          />
          <Fout melding={errors.reistijdEnkelMinuten?.message} />
        </div>
      </div>

      {!urenHandmatig ? (
        <p className="-mt-2 text-xs text-muted-foreground">
          De uren komen uit de activiteitsoort. Kies &ldquo;Anders&rdquo; om ze
          zelf in te vullen.
        </p>
      ) : null}

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

      {/* Vinkjes */}
      <div className="grid gap-3">
        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="voltooid"
            render={({ field }) => (
              <Checkbox
                id="voltooid"
                checked={field.value}
                onCheckedChange={(aangevinkt) => field.onChange(aangevinkt === true)}
              />
            )}
          />
          <Label htmlFor="voltooid" className="font-normal">
            Training voltooid
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Controller
            control={control}
            name="voorbereidingGedaan"
            render={({ field }) => (
              <Checkbox
                id="voorbereidingGedaan"
                checked={field.value}
                onCheckedChange={(aangevinkt) => field.onChange(aangevinkt === true)}
              />
            )}
          />
          <Label htmlFor="voorbereidingGedaan" className="font-normal">
            Voorbereiding gedaan
          </Label>
        </div>
      </div>

      <Urenberekening
        concept={conceptAfspraak}
        andereAfsprakenOpDezeDag={andereAfsprakenOpDezeDag}
        instellingen={instellingen}
      />

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
          <Button type="button" variant="outline" onClick={annuleerAfspraak}>
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

        {afspraak?.status === "voltooid" ? (
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4" aria-hidden />
            Telt mee als gerealiseerd
          </span>
        ) : null}
      </div>
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
