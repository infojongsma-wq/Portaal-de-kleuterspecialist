"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";

import { bewaarContract } from "@/app/afspraken/acties";
import { Button } from "@/components/ui/button";
import { Datumveld } from "@/components/ui/datumveld";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatteerUren } from "@/lib/formatteer";

/**
 * De contracturen per week vastleggen (SPEC.md 4.2).
 *
 * De jaarnorm volgt hieruit: `norm_fulltime × (uren per week ÷ 40)`. Die wordt
 * nooit los ingevoerd. Zet je een nieuwe ingangsdatum, dan wordt het lopende
 * contract afgesloten en begint er een nieuw — zo blijft de geschiedenis
 * kloppen voor eerdere jaren.
 */
export function ContractFormulier({
  profielId,
  urenPerWeek,
  ingangsdatum,
  vandaag,
  normFulltime,
}: {
  profielId: string;
  urenPerWeek: number | null;
  ingangsdatum: string | null;
  vandaag: string;
  /**
   * De fulltimenorm uit `contracten.norm_fulltime`. Staat hier bewust niet als
   * getal in de code (CLAUDE.md, "Rekenregels — nooit hardcoderen). Is er nog
   * geen contract, dan is dit `null` en tonen we geen jaarnorm.
   */
  normFulltime: number | null;
}) {
  const router = useRouter();
  const [uren, setUren] = React.useState(String(urenPerWeek ?? 24));
  const [datum, setDatum] = React.useState(ingangsdatum ?? vandaag);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);

  async function bewaar() {
    setBezig(true);
    const resultaat = await bewaarContract(
      profielId,
      Number(uren.replace(",", ".")),
      datum,
    );
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  const getal = Number(uren.replace(",", "."));
  const werktijdfactor = Number.isFinite(getal) ? getal / 40 : 0;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid w-32 gap-1.5">
          <Label htmlFor={`uren-${profielId}`}>Uren per week</Label>
          <Input
            id={`uren-${profielId}`}
            type="number"
            step="0.5"
            min={0.5}
            max={40}
            value={uren}
            onChange={(gebeurtenis) => setUren(gebeurtenis.target.value)}
          />
        </div>

        <div className="grid w-36 gap-1.5">
          <Label htmlFor={`ingang-${profielId}`}>Ingangsdatum</Label>
          <Datumveld
            id={`ingang-${profielId}`}
            waarde={datum}
            onWijzig={setDatum}
          />
        </div>

        <Button type="button" onClick={bewaar} disabled={bezig}>
          <Save aria-hidden />
          {bezig ? "Bezig…" : "Contract vastleggen"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Werktijdfactor {formatteerUren(werktijdfactor)}
        {normFulltime != null
          ? ` · jaarnorm ${formatteerUren(normFulltime * werktijdfactor)} uur`
          : " · de jaarnorm volgt zodra het contract is vastgelegd"}
        . Verandert het aantal uren per week, zet dan een nieuwe ingangsdatum —
        het lopende contract wordt dan afgesloten en eerdere jaren blijven
        kloppen.
      </p>

      {melding ? (
        <p className="text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
}
