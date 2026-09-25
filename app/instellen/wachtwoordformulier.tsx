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
 * Er komen hier drie soorten links binnen, en elk levert de sessie anders aan:
 *
 *  1. `?token_hash=…&type=…` — de links die het beheerscherm zelf maakt. Het
 *     kenmerk wordt hier bij Supabase gecontroleerd met `verifyOtp`. Werkt in
 *     elke browser.
 *  2. `#access_token=…` — links uit e-mails die Supabase zelf verstuurt. De
 *     inlogverbinding van het portaal weigert dat formaat uit zichzelf, dus
 *     zetten we de sessie hier met de hand.
 *  3. `?code=…` — de herstellink van "wachtwoord vergeten". Die ruilt de
 *     verbinding zelf om, maar alleen in de browser waarin het herstel werd
 *     aangevraagd.
 *
 * Dit gebeurt in de browser en niet in een server action: het deel achter het
 * hekje komt nooit bij de server aan. De verbinding zet de sessie in de
 * cookies, waarna de server de gebruiker herkent.
 */

const MINIMALE_LENGTE = 12;

type Stand = "bezig" | "klaar" | "geen-sessie" | "opslaan";

const LINKSOORTEN = ["invite", "recovery", "magiclink", "email"] as const;
type Linksoort = (typeof LINKSOORTEN)[number];

function isLinksoort(waarde: string | null): waarde is Linksoort {
  return LINKSOORTEN.includes(waarde as Linksoort);
}

/**
 * Een verlopen link en een onbereikbare database zien er voor de gebruiker
 * hetzelfde uit, maar vragen iets anders: een nieuwe link, of even wachten.
 */
function uitlegBijFout(fout: { status?: number }): string {
  if (fout.status === undefined || fout.status === 0 || fout.status >= 500) {
    return "Supabase antwoordt op dit moment niet. Open de link over een paar minuten opnieuw.";
  }
  return "Deze link is verlopen of al een keer gebruikt.";
}

export function Wachtwoordformulier() {
  const router = useRouter();
  const [stand, setStand] = React.useState<Stand>("bezig");
  const [wachtwoord, setWachtwoord] = React.useState("");
  const [herhaling, setHerhaling] = React.useState("");
  const [melding, setMelding] = React.useState<string | null>(null);

  const [uitleg, setUitleg] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = supabaseBrowser();
    let afgebroken = false;

    async function verwerkLink() {
      const zoek = new URLSearchParams(window.location.search);
      const hekje = new URLSearchParams(window.location.hash.slice(1));

      // Een verlopen of al gebruikte link komt met een foutmelding terug.
      const foutcode = zoek.get("error_code") ?? hekje.get("error_code");
      if (foutcode) {
        return foutcode === "otp_expired"
          ? "Deze link is verlopen of al een keer gebruikt."
          : "Deze link werd door Supabase geweigerd.";
      }

      const kenmerk = zoek.get("token_hash");
      const soort = zoek.get("type");
      if (kenmerk && isLinksoort(soort)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: kenmerk,
          type: soort,
        });
        return error ? uitlegBijFout(error) : null;
      }

      const toegang = hekje.get("access_token");
      const verversing = hekje.get("refresh_token");
      if (toegang && verversing) {
        const { error } = await supabase.auth.setSession({
          access_token: toegang,
          refresh_token: verversing,
        });
        return error ? uitlegBijFout(error) : null;
      }

      // Bij `?code=` heeft de verbinding het omruilen al geprobeerd; lukt dat
      // niet, dan is de link in een andere browser geopend dan die waarin het
      // herstel werd aangevraagd.
      if (zoek.get("code")) {
        const { data } = await supabase.auth.getSession();
        return data.session
          ? null
          : "Open de link in dezelfde browser als waarin je het herstel hebt aangevraagd, of vraag een nieuwe aan.";
      }

      return null;
    }

    verwerkLink().then(async (fout) => {
      if (afgebroken) return;

      // Een gebruikte link hoort niet in de adresbalk te blijven staan; bij
      // verversen zou hij opnieuw worden geprobeerd en dan mislukken.
      window.history.replaceState(null, "", window.location.pathname);

      const { data } = await supabase.auth.getSession();
      if (afgebroken) return;

      setUitleg(fout);
      setStand(data.session && !fout ? "klaar" : "geen-sessie");
    });

    return () => {
      afgebroken = true;
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
        {uitleg ? <p>{uitleg}</p> : null}
        <p className="text-muted-foreground">
          Een uitnodiging en een herstellink zijn beperkt houdbaar en werken
          maar één keer. Vraag de beheerder om een nieuwe link, of vraag zelf
          een nieuwe herstellink aan via &quot;Wachtwoord vergeten&quot;.
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
