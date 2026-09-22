"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Mail, Pencil, Plus, X } from "lucide-react";

import {
  bewaarMedewerker,
  maakToegangslink,
  nodigMedewerkerUit,
} from "@/app/beheer/acties";
import { ContractFormulier } from "@/components/beheer/contract-formulier";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Datumveld } from "@/components/ui/datumveld";
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
import { formatteerDatum, formatteerUren } from "@/lib/formatteer";
import type { Contract, Profiel } from "@/lib/data/types";

export interface MedewerkerRegel {
  profiel: Profiel;
  contract: Contract | null;
}

/**
 * Medewerkers vastleggen (SPEC.md 6.6).
 *
 * Een profiel en een inlogaccount zijn twee verschillende dingen. Hier wordt
 * het profiel gemaakt: naam, rol, dienstverband en standplaats. Het account
 * komt erbij zodra de medewerker een uitnodiging aanneemt; de database koppelt
 * die twee dan aan elkaar op e-mailadres.
 *
 * De datums van in- en uitdiensttreding zijn geen bijzaak: ze bepalen over
 * welk deel van het jaar de norm wordt gerekend (SPEC.md 5.2).
 */
export function MedewerkersBeheer({
  medewerkers,
  ikId,
  vandaag,
  normFulltime,
}: {
  medewerkers: MedewerkerRegel[];
  ikId: string;
  vandaag: string;
  /** Uit `contracten.norm_fulltime`; `null` zolang er geen contract is. */
  normFulltime: number | null;
}) {
  const router = useRouter();
  const [bewerken, setBewerken] = React.useState<Profiel | null>(null);
  const [nieuw, setNieuw] = React.useState(false);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);
  const [fouten, setFouten] = React.useState<Record<string, string>>({});
  const [uitnodigen, setUitnodigen] = React.useState<string | null>(null);
  const [toegangslink, setToegangslink] = React.useState<string | null>(null);
  const [gekopieerd, setGekopieerd] = React.useState(false);

  // De datumvelden zijn eigen componenten en geen <input type="date">, dus hun
  // waarde gaat niet vanzelf met het formulier mee.
  const [inDienst, setInDienst] = React.useState("");
  const [uitDienst, setUitDienst] = React.useState("");

  const formulierOpen = nieuw || bewerken !== null;

  function openNieuw() {
    setBewerken(null);
    setNieuw(true);
    setFouten({});
    setMelding(null);
    setInDienst("");
    setUitDienst("");
  }

  function openBewerken(profiel: Profiel) {
    setNieuw(false);
    setBewerken(profiel);
    setFouten({});
    setMelding(null);
    setInDienst(profiel.inDienstVanaf ?? "");
    setUitDienst(profiel.uitDienstPer ?? "");
  }

  function sluit() {
    setNieuw(false);
    setBewerken(null);
    setFouten({});
  }

  async function bewaar(formulier: FormData) {
    setBezig(true);
    const resultaat = await bewaarMedewerker({
      id: bewerken?.id,
      voornaam: String(formulier.get("voornaam") ?? ""),
      achternaam: String(formulier.get("achternaam") ?? ""),
      email: String(formulier.get("email") ?? ""),
      rol: String(formulier.get("rol") ?? "medewerker"),
      telefoon: String(formulier.get("telefoon") ?? ""),
      standplaatsAdres: String(formulier.get("standplaatsAdres") ?? ""),
      standplaatsPostcode: String(formulier.get("standplaatsPostcode") ?? ""),
      standplaatsPlaats: String(formulier.get("standplaatsPlaats") ?? ""),
      inDienstVanaf: inDienst,
      uitDienstPer: uitDienst,
      actief: formulier.get("actief") === "on",
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    setFouten(resultaat.velden ?? {});

    if (resultaat.gelukt) {
      sluit();
      router.refresh();
    }
  }

  async function nodigUit(profielId: string) {
    setUitnodigen(profielId);
    setMelding(null);
    setToegangslink(null);
    const resultaat = await nodigMedewerkerUit(profielId);
    setUitnodigen(null);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  async function maakLink(profielId: string) {
    setUitnodigen(profielId);
    setMelding(null);
    setToegangslink(null);
    setGekopieerd(false);
    const resultaat = await maakToegangslink(profielId);
    setUitnodigen(null);
    setMelding(resultaat.melding ?? null);
    setToegangslink(resultaat.link ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  async function kopieer() {
    if (!toegangslink) return;
    try {
      await navigator.clipboard.writeText(toegangslink);
      setGekopieerd(true);
    } catch {
      // Sommige browsers staan kopiëren alleen toe na een echte klik op een
      // beveiligde verbinding. Lukt het niet, dan blijft de link selecteerbaar.
      setGekopieerd(false);
    }
  }

  const gekozen = bewerken;
  const gekozenContract =
    medewerkers.find((regel) => regel.profiel.id === gekozen?.id)?.contract ??
    null;

  return (
    <div className="grid gap-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Naam</TableHead>
            <TableHead>E-mail</TableHead>
            <TableHead>Rol</TableHead>
            <TableHead>In dienst vanaf</TableHead>
            <TableHead className="text-right">Uren per week</TableHead>
            <TableHead>Inlog</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {medewerkers.map(({ profiel, contract }) => (
            <TableRow key={profiel.id} className={profiel.actief ? "" : "opacity-60"}>
              <TableCell className="font-medium">
                {profiel.voornaam} {profiel.achternaam}
                {profiel.actief ? null : (
                  <span className="ml-2 text-xs text-muted-foreground">
                    niet actief
                  </span>
                )}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {profiel.email}
              </TableCell>
              <TableCell>
                <Badge variant="secondary" className="capitalize">
                  {profiel.rol}
                </Badge>
              </TableCell>
              <TableCell className="tabular-nums">
                {profiel.inDienstVanaf
                  ? formatteerDatum(profiel.inDienstVanaf)
                  : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {contract ? formatteerUren(contract.urenPerWeek) : "—"}
              </TableCell>
              <TableCell>
                <div className="flex flex-wrap items-center gap-1.5">
                  {profiel.heeftAccount ? (
                    <span className="text-sm text-merk-hardgroen">ja</span>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uitnodigen === profiel.id}
                      onClick={() => nodigUit(profiel.id)}
                    >
                      <Mail aria-hidden />
                      {uitnodigen === profiel.id ? "Bezig…" : "Mail"}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={uitnodigen === profiel.id}
                    onClick={() => maakLink(profiel.id)}
                    title={
                      profiel.heeftAccount
                        ? "Een link om een nieuw wachtwoord in te stellen"
                        : "Een link om een wachtwoord in te stellen, zonder e-mail"
                    }
                  >
                    <Link2 aria-hidden />
                    Link
                  </Button>
                </div>
              </TableCell>
              <TableCell>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => openBewerken(profiel)}
                  aria-label={`${profiel.voornaam} ${profiel.achternaam} bewerken`}
                >
                  <Pencil aria-hidden />
                </Button>
              </TableCell>
            </TableRow>
          ))}

          {medewerkers.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-sm text-muted-foreground">
                Er staan nog geen medewerkers in het portaal.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>

      <div className="px-4 pb-4">
        {formulierOpen ? (
          <div className="grid gap-4 rounded-md border p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {nieuw
                  ? "Nieuwe medewerker"
                  : `${gekozen?.voornaam} ${gekozen?.achternaam}`}
              </h3>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={sluit}
                aria-label="Sluiten"
              >
                <X aria-hidden />
              </Button>
            </div>

            <form action={bewaar} className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Veld label="Voornaam" naam="voornaam" fout={fouten.voornaam}>
                  <Input
                    id="voornaam"
                    name="voornaam"
                    defaultValue={gekozen?.voornaam ?? ""}
                    required
                  />
                </Veld>

                <Veld
                  label="Achternaam"
                  naam="achternaam"
                  fout={fouten.achternaam}
                >
                  <Input
                    id="achternaam"
                    name="achternaam"
                    defaultValue={gekozen?.achternaam ?? ""}
                  />
                </Veld>

                <Veld label="E-mailadres" naam="email" fout={fouten.email}>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    defaultValue={gekozen?.email ?? ""}
                    required
                  />
                </Veld>

                <Veld label="Telefoon" naam="telefoon" fout={fouten.telefoon}>
                  <Input
                    id="telefoon"
                    name="telefoon"
                    defaultValue={gekozen?.telefoon ?? ""}
                  />
                </Veld>

                <Veld label="Rol" naam="rol" fout={fouten.rol}>
                  <Keuzelijst
                    id="rol"
                    name="rol"
                    defaultValue={gekozen?.rol ?? "medewerker"}
                  >
                    <option value="medewerker">Medewerker</option>
                    <option value="beheerder">Beheerder</option>
                  </Keuzelijst>
                </Veld>

                <Veld
                  label="In dienst vanaf"
                  naam="inDienstVanaf"
                  fout={fouten.inDienstVanaf}
                >
                  <Datumveld
                    id="inDienstVanaf"
                    waarde={inDienst}
                    onWijzig={setInDienst}
                  />
                </Veld>

                <Veld
                  label="Uit dienst per"
                  naam="uitDienstPer"
                  fout={fouten.uitDienstPer}
                >
                  <Datumveld
                    id="uitDienstPer"
                    waarde={uitDienst}
                    onWijzig={setUitDienst}
                  />
                </Veld>
              </div>

              <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                <legend className="px-1 text-xs text-muted-foreground">
                  Standplaats — vanaf hier wordt de eigen reistijd gerekend
                </legend>

                <Veld
                  label="Adres"
                  naam="standplaatsAdres"
                  fout={fouten.standplaatsAdres}
                >
                  <Input
                    id="standplaatsAdres"
                    name="standplaatsAdres"
                    defaultValue={gekozen?.standplaatsAdres ?? ""}
                  />
                </Veld>

                <Veld
                  label="Postcode"
                  naam="standplaatsPostcode"
                  fout={fouten.standplaatsPostcode}
                >
                  <Input
                    id="standplaatsPostcode"
                    name="standplaatsPostcode"
                    defaultValue={gekozen?.standplaatsPostcode ?? ""}
                  />
                </Veld>

                <Veld
                  label="Plaats"
                  naam="standplaatsPlaats"
                  fout={fouten.standplaatsPlaats}
                >
                  <Input
                    id="standplaatsPlaats"
                    name="standplaatsPlaats"
                    defaultValue={gekozen?.standplaatsPlaats ?? ""}
                  />
                </Veld>
              </fieldset>

              <div className="flex items-center gap-2">
                <Checkbox
                  id="actief"
                  name="actief"
                  defaultChecked={gekozen?.actief ?? true}
                />
                <Label htmlFor="actief" className="font-normal">
                  Actief — kan inloggen en uren boeken
                </Label>
              </div>

              {gekozen?.id === ikId ? (
                <p className="text-xs text-muted-foreground">
                  Dit ben jij. Je eigen rol en je eigen vinkje &quot;actief&quot;
                  kun je niet wijzigen — anders zou je jezelf buiten kunnen
                  sluiten.
                </p>
              ) : null}

              <div className="flex gap-2">
                <Button type="submit" disabled={bezig}>
                  {bezig ? "Bezig…" : "Opslaan"}
                </Button>
                <Button type="button" variant="outline" onClick={sluit}>
                  Annuleren
                </Button>
              </div>
            </form>

            {/* Buiten het formulier: het contract wordt apart vastgelegd, met
                een eigen ingangsdatum, zodat eerdere jaren blijven kloppen. */}
            {gekozen ? (
              <div className="border-t pt-4">
                <h4 className="mb-2 text-sm font-semibold">Contract</h4>
                <ContractFormulier
                  profielId={gekozen.id}
                  urenPerWeek={gekozenContract?.urenPerWeek ?? null}
                  ingangsdatum={gekozenContract?.ingangsdatum ?? null}
                  vandaag={vandaag}
                  normFulltime={gekozenContract?.normFulltime ?? normFulltime}
                />
              </div>
            ) : (
              <p className="border-t pt-4 text-xs text-muted-foreground">
                Het contract met de uren per week leg je vast zodra de
                medewerker is opgeslagen.
              </p>
            )}
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={openNieuw}>
            <Plus aria-hidden />
            Medewerker toevoegen
          </Button>
        )}

        {melding ? (
          <p className="mt-3 text-sm text-muted-foreground" role="status">
            {melding}
          </p>
        ) : null}

        {toegangslink ? (
          <div className="mt-3 grid gap-2 rounded-md border border-merk-felgroen/40 bg-merk-felgroen/5 p-3">
            <p className="text-sm font-medium">
              Stuur deze link naar de medewerker
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={toegangslink}
                onFocus={(gebeurtenis) => gebeurtenis.currentTarget.select()}
                className="font-mono text-xs"
                aria-label="Eenmalige link"
              />
              <Button type="button" variant="outline" onClick={kopieer}>
                {gekopieerd ? <Check aria-hidden /> : <Copy aria-hidden />}
                {gekopieerd ? "Gekopieerd" : "Kopieer"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Met deze link stelt de medewerker zelf een wachtwoord in. Hij werkt
              één keer en is beperkt houdbaar. Stuur hem persoonlijk door — wie
              de link heeft, komt in het account. Zodra je dit scherm verlaat, is
              hij hier niet meer terug te halen; maak dan een nieuwe.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Veld({
  label,
  naam,
  fout,
  children,
}: {
  label: string;
  naam: string;
  fout?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={naam}>{label}</Label>
      {children}
      {fout ? <p className="text-xs text-destructive">{fout}</p> : null}
    </div>
  );
}
