"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import {
  bewaarActiviteitsoort,
  verwijderActiviteitsoort,
} from "@/app/afspraken/acties";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Keuzelijst } from "@/components/ui/keuzelijst";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatteerUren } from "@/lib/formatteer";
import { CATEGORIELABELS, HANDMATIGE_CATEGORIEEN } from "@/lib/uren";
import type { Activiteitsoort } from "@/lib/data/types";

const KLEUREN = [
  // Huisstijl
  "#026666",
  "#95c11f",
  "#94ab68",
  "#3a673a",
  "#a8a29e",
  // Overige
  "#2563eb",
  "#16a34a",
  "#db2777",
  "#ea580c",
  "#7c3aed",
  "#0891b2",
  "#78716c",
];

// Reistijd boven het uur hoort niet bij een soort afspraak; die volgt uit de
// school of wordt los geboekt.
const CATEGORIEEN_VOOR_SOORT = HANDMATIGE_CATEGORIEEN.filter(
  (categorie) => categorie.waarde !== "reistijd",
);

/**
 * Soorten afspraken inrichten (SPEC.md 4.5 en 6.6).
 *
 * Bij een training of observatie bepalen de uren die hier staan wat een
 * afspraak oplevert. Ze staan nergens in de code — de medewerker vult ze niet
 * in en ziet ze ook niet.
 *
 * Bij soorten als Literatuurstudie vult de medewerker de uren zelf in. Hier
 * staat dan alleen onder welke categorie die uren vallen, en of ze meetellen
 * als gewerkte tijd.
 *
 * Een wijziging van de vaste uren werkt vooruit: bestaande afspraken houden de
 * uren waarmee ze zijn vastgelegd, zoals SPEC.md 4.6 voorschrijft.
 */
export function SoortenBeheer({ soorten }: { soorten: Activiteitsoort[] }) {
  const router = useRouter();
  const [bewerken, setBewerken] = React.useState<Activiteitsoort | null>(null);
  const [nieuw, setNieuw] = React.useState(false);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});

  const formulierOpen = nieuw || bewerken !== null;

  function sluit() {
    setNieuw(false);
    setBewerken(null);
    setFouten({});
  }

  async function bewaar(formulier: FormData) {
    setBezig(true);
    const resultaat = await bewaarActiviteitsoort({
      ...Object.fromEntries(formulier),
      actief: formulier.get("actief") === "on",
      handmatigeUren: formulier.get("handmatigeUren") === "on",
      teltAlsWerktijd: formulier.get("teltAlsWerktijd") === "on",
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    setFouten(resultaat.velden ?? {});
    if (resultaat.gelukt) {
      sluit();
      router.refresh();
    }
  }

  async function verwijder(soort: Activiteitsoort) {
    const resultaat = await verwijderActiviteitsoort(soort.id);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  return (
    <div className="grid gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Soort</TableHead>
            <TableHead className="text-right">Op locatie</TableHead>
            <TableHead className="text-right">Voorbereiding</TableHead>
            <TableHead className="text-right">Totaal</TableHead>
            <TableHead className="w-24" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {soorten.map((soort) => (
            <TableRow key={soort.id}>
              <TableCell>
                <span className="flex flex-wrap items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: soort.kleur }}
                    aria-hidden
                  />
                  {soort.naam}
                  {!soort.actief ? (
                    <Badge variant="outline">non-actief</Badge>
                  ) : null}
                  {soort.handmatigeUren && !soort.teltAlsWerktijd ? (
                    <Badge variant="outline">telt niet mee</Badge>
                  ) : null}
                </span>
              </TableCell>
              {soort.handmatigeUren ? (
                <TableCell
                  colSpan={3}
                  className="text-right text-sm text-muted-foreground"
                >
                  Uren zelf in te vullen
                  {soort.teltAlsWerktijd
                    ? ` · ${CATEGORIELABELS[soort.urencategorie ?? "overig"]}`
                    : ""}
                </TableCell>
              ) : (
                <>
                  <TableCell className="text-right tabular-nums">
                    {formatteerUren(soort.urenOpLocatie)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {formatteerUren(soort.urenVoorbereiding)}
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">
                    {formatteerUren(
                      soort.urenOpLocatie + soort.urenVoorbereiding,
                    )}
                  </TableCell>
                </>
              )}
              <TableCell>
                <span className="flex justify-end gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${soort.naam} bewerken`}
                    onClick={() => {
                      setNieuw(false);
                      setBewerken(soort);
                      setFouten({});
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`${soort.naam} verwijderen`}
                    onClick={() => verwijder(soort)}
                  >
                    <Trash2 className="text-destructive" aria-hidden />
                  </Button>
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <div className="px-5 pb-5">
        {formulierOpen ? (
          <SoortFormulier
            // Een nieuwe sleutel geeft een vers formulier, met de keuzes van
            // de soort die je bewerkt.
            key={bewerken?.id ?? "nieuw"}
            bewerken={bewerken}
            bezig={bezig}
            fouten={fouten}
            onBewaar={bewaar}
            onSluit={sluit}
          />
        ) : (
          <Button type="button" variant="outline" onClick={() => setNieuw(true)}>
            <Plus aria-hidden />
            Soort toevoegen
          </Button>
        )}

        {melding ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {melding}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function SoortFormulier({
  bewerken,
  bezig,
  fouten,
  onBewaar,
  onSluit,
}: {
  bewerken: Activiteitsoort | null;
  bezig: boolean;
  fouten: Record<string, string>;
  onBewaar: (formulier: FormData) => void;
  onSluit: () => void;
}) {
  const [handmatig, setHandmatig] = React.useState(
    bewerken?.handmatigeUren ?? false,
  );

  // Een kleur die niet in het rijtje staat blijft gewoon te kiezen; anders zou
  // opslaan de kleur ongemerkt veranderen.
  const kleuren =
    bewerken && !KLEUREN.includes(bewerken.kleur)
      ? [bewerken.kleur, ...KLEUREN]
      : KLEUREN;

  return (
    <form action={onBewaar} className="grid gap-4 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {bewerken ? `${bewerken.naam} bewerken` : "Nieuwe soort"}
        </h3>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Sluiten"
          onClick={onSluit}
        >
          <X aria-hidden />
        </Button>
      </div>

      {bewerken ? <input type="hidden" name="id" value={bewerken.id} /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="soort-naam">Naam</Label>
          <Input
            id="soort-naam"
            name="naam"
            required
            autoComplete="off"
            defaultValue={bewerken?.naam ?? ""}
          />
          <Fout melding={fouten.naam} />
        </div>

        <div className="grid gap-1.5">
          <Label htmlFor="soort-volgorde">Volgorde in de lijst</Label>
          <Input
            id="soort-volgorde"
            name="volgorde"
            type="number"
            min={0}
            max={999}
            defaultValue={bewerken?.volgorde ?? 0}
          />
        </div>
      </div>

      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          <Checkbox
            id="soort-handmatig"
            name="handmatigeUren"
            checked={handmatig}
            onCheckedChange={(aan) => setHandmatig(aan === true)}
          />
          <Label htmlFor="soort-handmatig" className="font-normal">
            De medewerker vult de uren zelf in
          </Label>
        </div>
        <p className="pl-6 text-xs text-muted-foreground">
          Zoals bij Literatuurstudie: geen school, geen voorbereiding en geen
          reistijd.
        </p>
      </div>

      {handmatig ? (
        <>
          {/* Geen vaste uren: elke afspraak heeft zijn eigen aantal. */}
          <input type="hidden" name="urenOpLocatie" value="0" />
          <input type="hidden" name="urenVoorbereiding" value="0" />

          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <Checkbox
                id="soort-telt-mee"
                name="teltAlsWerktijd"
                defaultChecked={bewerken?.teltAlsWerktijd ?? true}
              />
              <Label htmlFor="soort-telt-mee" className="font-normal">
                Telt mee als gewerkte tijd
              </Label>
            </div>
            <p className="pl-6 text-xs text-muted-foreground">
              Uit bij bijvoorbeeld Niet beschikbaar: dan staat het wel in de
              agenda, maar telt het niet mee voor de jaarnorm. Een wijziging
              geldt ook voor wat al in de agenda staat.
            </p>
          </div>

          <div className="grid gap-1.5 sm:max-w-xs">
            <Label htmlFor="soort-categorie">Uren vallen onder</Label>
            <Keuzelijst
              id="soort-categorie"
              name="urencategorie"
              defaultValue={bewerken?.urencategorie ?? "overig"}
            >
              {CATEGORIEEN_VOOR_SOORT.map((categorie) => (
                <option key={categorie.waarde} value={categorie.waarde}>
                  {categorie.label}
                </option>
              ))}
            </Keuzelijst>
            <Fout melding={fouten.urencategorie} />
          </div>
        </>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <Label htmlFor="soort-locatie">Uren op locatie</Label>
            <Input
              id="soort-locatie"
              name="urenOpLocatie"
              type="number"
              step="0.25"
              min={0}
              max={24}
              required
              defaultValue={bewerken?.urenOpLocatie ?? 3}
            />
            <Fout melding={fouten.urenOpLocatie} />
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="soort-voorbereiding">Uren voorbereiding</Label>
            <Input
              id="soort-voorbereiding"
              name="urenVoorbereiding"
              type="number"
              step="0.25"
              min={0}
              max={24}
              required
              defaultValue={bewerken?.urenVoorbereiding ?? 3}
            />
            <Fout melding={fouten.urenVoorbereiding} />
          </div>
        </div>
      )}

      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Kleur in de agenda</legend>
        <div className="flex flex-wrap gap-2">
          {kleuren.map((kleur, positie) => (
            <label key={kleur} className="cursor-pointer" title={kleur}>
              <input
                type="radio"
                name="kleur"
                value={kleur}
                defaultChecked={
                  bewerken ? bewerken.kleur === kleur : positie === 0
                }
                className="peer sr-only"
              />
              <span
                className="block size-7 rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-foreground"
                style={{ backgroundColor: kleur }}
              />
              <span className="sr-only">{kleur}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex items-center gap-2">
        <Checkbox
          id="soort-actief"
          name="actief"
          defaultChecked={bewerken?.actief ?? true}
        />
        <Label htmlFor="soort-actief" className="font-normal">
          Actief — te kiezen door de medewerker
        </Label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={bezig}>
          {bezig ? "Bezig…" : "Opslaan"}
        </Button>
        <Button type="button" variant="ghost" onClick={onSluit}>
          Annuleren
        </Button>
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
