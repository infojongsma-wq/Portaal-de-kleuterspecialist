"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { KeyRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Wachtwoord kiezen na een uitnodiging of een herstelverzoek.
 *
 * Supabase zet de sessie in het adres achter een hekje (`#access_token=…`).
 * Dat deel van een adres komt nooit bij de server aan — alleen de browser ziet
 * het. Daarom gebeurt dit hier en niet in een server action: de
 * browserverbinding leest het uit het adres, ruilt het om voor een sessie en
 * zet die in de cookies, waarna de server de gebruiker herkent.
 */

const MINIMALE_LENGTE = 12;

type Stand = "bezig" | "klaar" | "geen-sessie" | "opslaan";

export function Wachtwoordformulier() {
  const router = useRouter();
  const [stand, setStand] = React.useState<Stand>("bezig");
  const [wachtwoord, setWachtwoord] = React.useState("");
  const [herhaling, setHerhaling] = React.useState("");
  const [melding, setMelding] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = supabaseBrowser();
    let afgebroken = false;

    // De verbinding verwerkt het adres zelf; even wachten tot dat klaar is.
    const { data: luisteraar } = supabase.auth.onAuthStateChange((_, sessie) => {
      if (afgebroken) return;
      if (sessie) setStand("klaar");
    });

    supabase.auth.getSession().then(({ data }) => {
      if (afgebroken) return;
      setStand(data.session ? "klaar" : "geen-sessie");
    });

    return () => {
      afgebroken = true;
      luisteraar.subscription.unsubscribe();
    };
  }, []);

  async function bewaar(gebeurtenis: React.FormEvent) {
    gebeurtenis.preventDefault();
    setMelding(null);

    if (wachtwoord.length < MINIMALE_LENGTE) {
      setMelding(`Kies een wachtwoord van minstens ${MINIMALE_LENGTE} tekens.`);
      return;
    }
    if (wachtwoord !== herhaling) {
      setMelding("De twee wachtwoorden zijn niet gelijk.");
      return;
    }

    setStand("opslaan");
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.updateUser({ password: wachtwoord });

    if (error) {
      setStand("klaar");
      setMelding(
        "Het wachtwoord kon niet worden opgeslagen. Vraag zo nodig een nieuwe uitnodiging aan.",
      );
      return;
    }

    router.replace("/afspraken");
    router.refresh();
  }

  if (stand === "bezig") {
    return <p className="text-sm text-muted-foreground">Even geduld…</p>;
  }

  if (stand === "geen-sessie") {
    return (
      <div className="grid gap-2 text-sm">
        <p className="font-medium">Deze link werkt niet meer</p>
        <p className="text-muted-foreground">
          Een uitnodiging en een herstellink zijn beperkt houdbaar en werken
          maar één keer. Vraag de beheerder om een nieuwe uitnodiging, of vraag
          zelf een nieuwe herstellink aan via &quot;Wachtwoord vergeten&quot;.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={bewaar} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="wachtwoord">Nieuw wachtwoord</Label>
        <Input
          id="wachtwoord"
          type="password"
          autoComplete="new-password"
          value={wachtwoord}
          onChange={(gebeurtenis) => setWachtwoord(gebeurtenis.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Minstens {MINIMALE_LENGTE} tekens.
        </p>
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="herhaling">Nog een keer</Label>
        <Input
          id="herhaling"
          type="password"
          autoComplete="new-password"
          value={herhaling}
          onChange={(gebeurtenis) => setHerhaling(gebeurtenis.target.value)}
          required
        />
      </div>

      {melding ? (
        <p className="text-sm text-destructive" role="alert">
          {melding}
        </p>
      ) : null}

      <Button type="submit" disabled={stand === "opslaan"}>
        <KeyRound aria-hidden />
        {stand === "opslaan" ? "Bezig…" : "Wachtwoord instellen"}
      </Button>
    </form>
  );
}
