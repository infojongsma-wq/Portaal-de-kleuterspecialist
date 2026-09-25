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
  return "Deze link is verlopen of al een keer gebruikt. Is er daarna een nieuwere link gemaakt, dan werkt alleen die nog.";
}

/** De kale code en status van Supabase, voor wie moet uitzoeken wat er misging. */
function technisch(fout: { code?: string; status?: number; message?: string }): string {
  return [fout.code, fout.status, fout.message].filter(Boolean).join(" · ");
}

interface Verwerking {
  fout: string | null;
  detail: string | null;
}

export function Wachtwoordformulier() {
  const router = useRouter();
  const [stand, setStand] = React.useState<Stand>("bezig");
  const [wachtwoord, setWachtwoord] = React.useState("");
  const [herhaling, setHerhaling] = React.useState("");
  const [melding, setMelding] = React.useState<string | null>(null);

  const [uitleg, setUitleg] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState<string | null>(null);

  React.useEffect(() => {
    const supabase = supabaseBrowser();
    let afgebroken = false;

    async function verwerkLink(): Promise<Verwerking> {
      const zoek = new URLSearchParams(window.location.search);
      const hekje = new URLSearchParams(window.location.hash.slice(1));

      // Een verlopen of al gebruikte link komt met een foutmelding terug.
      const foutcode = zoek.get("error_code") ?? hekje.get("error_code");
      if (foutcode) {
        return {
          fout:
            foutcode === "otp_expired"
              ? uitlegBijFout({ status: 403 })
              : "Deze link werd door Supabase geweigerd.",
          detail: foutcode,
        };
      }

      const kenmerk = zoek.get("token_hash");
      const soort = zoek.get("type");
      if (kenmerk && isLinksoort(soort)) {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: kenmerk,
          type: soort,
        });
        return error
          ? { fout: uitlegBijFout(error), detail: technisch(error) }
          : { fout: null, detail: null };
      }

      const toegang = hekje.get("access_token");
      const verversing = hekje.get("refresh_token");
      if (toegang && verversing) {
        const { error } = await supabase.auth.setSession({
          access_token: toegang,
          refresh_token: verversing,
        });
        return error
          ? { fout: uitlegBijFout(error), detail: technisch(error) }
          : { fout: null, detail: null };
      }

      // Bij `?code=` heeft de verbinding het omruilen al geprobeerd; lukt dat
      // niet, dan is de link in een andere browser geopend dan die waarin het
      // herstel werd aangevraagd.
      if (zoek.get("code")) {
        return {
          fout: "Open de link in dezelfde browser als waarin je het herstel hebt aangevraagd, of vraag een nieuwe aan.",
          detail: "code",
        };
      }

      return { fout: null, detail: null };
    }

    verwerkLink()
      .catch(
        (oorzaak): Verwerking => ({
          fout: uitlegBijFout({ status: 0 }),
          detail: oorzaak instanceof Error ? oorzaak.message : null,
        }),
      )
      .then(async ({ fout, detail: technischeRegel }) => {
        if (afgebroken) return;

        // Een gebruikte link hoort niet in de adresbalk te blijven staan; bij
        // verversen zou hij opnieuw worden geprobeerd en dan mislukken.
        window.history.replaceState(null, "", window.location.pathname);

        const { data } = await supabase.auth.getSession();
        if (afgebroken) return;

        // Is er een sessie, dan kan het wachtwoord worden ingesteld — ook als
        // de link zelf nu is opgebruikt. Dat gebeurt als iemand de link opent,
        // het venster sluit zonder een wachtwoord te kiezen, en de link later
        // nog eens opent: de eerste keer was hij al ingelogd.
        setUitleg(fout);
        setDetail(technischeRegel);
        setEmail(data.session?.user.email ?? null);
        setStand(data.session ? "klaar" : "geen-sessie");
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
        {detail ? (
          <p className="font-mono text-xs text-muted-foreground">
            Technische melding: {detail}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <form onSubmit={bewaar} className="grid gap-4">
      {email ? (
        // Zodat meteen opvalt als de link in de verkeerde browser is geopend,
        // bijvoorbeeld die van de beheerder zelf.
        <p className="text-sm text-muted-foreground">
          Je stelt het wachtwoord in voor{" "}
          <span className="font-medium text-foreground">{email}</span>.
        </p>
      ) : null}

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
