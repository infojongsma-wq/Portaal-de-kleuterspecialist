"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Link2, Mail, Pencil, Plus, Trash2, X } from "lucide-react";

import { bewaarContract } from "@/app/afspraken/acties";
import {
  bewaarMedewerker,
  maakToegangslink,
  nodigMedewerkerUit,
  verwijderContract,
} from "@/app/beheer/acties";
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
import { formatteerDatum, formatteerUren, leesGetal } from "@/lib/formatteer";
import { FULLTIME_UREN_PER_WEEK } from "@/lib/uren";
import type { Contract, Profiel } from "@/lib/data/types";

export interface MedewerkerRegel {
  profiel: Profiel;
  /** Het contract dat vandaag geldt; `null` als er vandaag geen loopt. */
  contract: Contract | null;
  /** Alle contracten, nieuwste eerst — ook die nog moeten ingaan. */
  contracten: Contract[];
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

  // Het contract hoort bij dezelfde medewerker en wordt met dezelfde knop
  // bewaard, maar het is een eigen tabel met een eigen ingangsdatum.
  const [uren, setUren] = React.useState("");
  const [contractDatum, setContractDatum] = React.useState("");
  const [norm, setNorm] = React.useState("");

  const formulierOpen = nieuw || bewerken !== null;

  function openNieuw() {
    setBewerken(null);
    setNieuw(true);
    setFouten({});
    setMelding(null);
    setToegangslink(null);
    setInDienst("");
    setUitDienst("");
    setUren("");
    setContractDatum(vandaag);
    setNorm(normFulltime != null ? String(normFulltime) : "");
  }

  function openBewerken(profiel: Profiel) {
    const regel = medewerkers.find(
      (medewerker) => medewerker.profiel.id === profiel.id,
    );
    // Het nieuwste contract, ook als dat pas volgende maand ingaat. Anders
    // toont het formulier een oudere regel en lijkt een wijziging verdwenen.
    const contract = regel?.contracten[0] ?? regel?.contract ?? null;

    setNieuw(false);
    setBewerken(profiel);
    setFouten({});
    setMelding(null);
    setToegangslink(null);
    setInDienst(profiel.inDienstVanaf ?? "");
    setUitDienst(profiel.uitDienstPer ?? "");
    setUren(contract ? String(contract.urenPerWeek) : "");
    setContractDatum(contract?.ingangsdatum ?? vandaag);
    setNorm(
      contract
        ? String(contract.normFulltime)
        : normFulltime != null
          ? String(normFulltime)
          : "",
    );
  }

  function sluit() {
    setNieuw(false);
    setBewerken(null);
    setFouten({});
  }

  /**
   * Eén knop bewaart álles van deze medewerker: de gegevens én het contract.
   * Daarvóór had het contract een eigen knop onderaan het paneel, en wie op
   * Opslaan drukte zag de contracturen niet bewaard worden.
   */
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

    if (!resultaat.gelukt) {
      setBezig(false);
      setMelding(resultaat.melding ?? null);
      setFouten(resultaat.velden ?? {});
      return;
    }

    // Het profiel moet er eerst zijn: een nieuw contract heeft een profiel-id
    // nodig. Bij een nieuwe medewerker komt dat pas uit de vorige stap.
    const profielId = bewerken?.id ?? resultaat.id;
    const urenIngevuld = uren.trim();
    let melding = resultaat.melding ?? null;

    if (profielId && urenIngevuld !== "" && contractDatum !== "") {
      const contractResultaat = await bewaarContract(
        profielId,
        leesGetal(urenIngevuld),
        contractDatum,
        norm.trim() === "" ? null : leesGetal(norm),
      );
      melding = contractResultaat.gelukt
        ? `${melding ? `${melding} ` : ""}${contractResultaat.melding ?? ""}`.trim()
        : (contractResultaat.melding ?? null);

      if (!contractResultaat.gelukt) {
        setBezig(false);
        setMelding(melding);
        return;
      }
    }

    setBezig(false);
    setMelding(melding);
    setFouten({});
    sluit();
    router.refresh();
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

  async function haalContractWeg(contractId: string) {
    setBezig(true);
    const resultaat = await verwijderContract(contractId);
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) {
      sluit();
      router.refresh();
    }
  }

  const gekozen = bewerken;
  const gekozenContracten =
    medewerkers.find((regel) => regel.profiel.id === gekozen?.id)?.contracten ??
    [];
  const urenGetal = uren.trim() === "" ? 0 : leesGetal(uren);
  const normGetal = norm.trim() === "" ? 0 : leesGetal(norm);

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

              <fieldset className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                <legend className="px-1 text-xs text-muted-foreground">
                  Contract
                </legend>

                <Veld label="Uren per week" naam="urenPerWeek">
                  <Input
                    id="urenPerWeek"
                    type="number"
                    step="0.5"
                    min={0.5}
                    max={40}
                    value={uren}
                    onChange={(gebeurtenis) => setUren(gebeurtenis.target.value)}
                    placeholder="bijvoorbeeld 24"
                  />
                </Veld>

                <Veld label="Ingangsdatum contract" naam="contractDatum">
                  <Datumveld
                    id="contractDatum"
                    waarde={contractDatum}
                    onWijzig={setContractDatum}
                  />
                </Veld>

                <Veld label="Jaarurennorm bij 1,0 fte" naam="normFulltime">
                  <Input
                    id="normFulltime"
                    type="number"
                    step="1"
                    min={500}
                    max={2500}
                    value={norm}
                    onChange={(gebeurtenis) => setNorm(gebeurtenis.target.value)}
                    placeholder="volgens cao"
                  />
                </Veld>

                <p className="text-xs text-muted-foreground sm:col-span-3">
                  {urenGetal > 0 && normGetal > 0
                    ? `Deeltijdfactor ${formatteerUren(urenGetal / FULLTIME_UREN_PER_WEEK)} · jaarnorm ${formatteerUren((normGetal * urenGetal) / FULLTIME_UREN_PER_WEEK)} uur bij een heel jaar in dienst.`
                    : "Vul de uren per week en de jaarurennorm in; de deeltijdfactor en de persoonlijke jaarnorm volgen daaruit."}{" "}
                  Verandert het aantal uren per week, zet dan een nieuwe
                  ingangsdatum — het lopende contract wordt dan afgesloten en
                  eerdere jaren blijven kloppen.
                </p>

                {gekozenContracten.length > 0 ? (
                  <div className="sm:col-span-3">
                    <p className="mb-1 text-xs font-medium">
                      Vastgelegde contracten
                    </p>
                    <ul className="grid gap-1">
                      {gekozenContracten.map((contract) => (
                        <li
                          key={contract.id}
                          className="flex items-center justify-between gap-3 rounded border px-2 py-1 text-xs"
                        >
                          <span className="tabular-nums">
                            {formatteerUren(contract.urenPerWeek)} uur per week
                            vanaf {formatteerDatum(contract.ingangsdatum)}
                            {contract.einddatum
                              ? ` tot en met ${formatteerDatum(contract.einddatum)}`
                              : ""}
                            {" · norm "}
                            {formatteerUren(contract.normFulltime)} uur
                            {inDienst && contract.ingangsdatum < inDienst
                              ? " — begint vóór de indiensttreding"
                              : ""}
                          </span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={bezig}
                            aria-label={`Contract vanaf ${formatteerDatum(contract.ingangsdatum)} weghalen`}
                            onClick={() => haalContractWeg(contract.id)}
                          >
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      ))}
                    </ul>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Staat er een regel bij die nergens op slaat — bijvoorbeeld
                      met de datum van de dag waarop je hem per ongeluk
                      vastlegde — haal die dan weg. De geboekte uren blijven
                      staan; een contract bepaalt alleen de norm.
                    </p>
                  </div>
                ) : null}
              </fieldset>

              <div className="flex gap-2">
                <Button type="submit" disabled={bezig}>
                  {bezig ? "Bezig…" : "Opslaan"}
                </Button>
                <Button type="button" variant="outline" onClick={sluit}>
                  Annuleren
                </Button>
              </div>
            </form>
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
              de link heeft, komt in het account. Klik hem dus ook niet zelf aan
              om te proberen: dan is hij opgebruikt, en kies jíj het
              wachtwoord. Zodra je dit scherm verlaat, is hij hier niet meer
              terug te halen; maak dan een nieuwe.
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
