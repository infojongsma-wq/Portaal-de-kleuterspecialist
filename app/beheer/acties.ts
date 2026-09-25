"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { werkset } from "@/lib/data/werkset";
import { supabaseBeheer } from "@/lib/supabase/beheer";
import { supabaseServer } from "@/lib/supabase/server";
import { medewerkerSchema } from "@/lib/validatie/medewerker";

/**
 * Beheerdersacties: medewerkers vastleggen (SPEC.md 6.6).
 *
 * De controle op de rol staat hier voor een begrijpelijke melding. De
 * werkelijke beveiliging zit in Postgres: de policies op `profielen` laten
 * toevoegen en verwijderen alleen toe aan een beheerder, en een trigger bewaakt
 * dat rol, dienstverband en e-mailadres niet door een medewerker zelf worden
 * gewijzigd.
 */

export interface BeheerResultaat {
  gelukt: boolean;
  melding?: string;
  velden?: Record<string, string>;
  id?: string;
  /** Eenmalige link om een wachtwoord in te stellen; zie `maakToegangslink`. */
  link?: string;
}

function ververs() {
  revalidatePath("/beheer");
  revalidatePath("/afspraken");
  revalidatePath("/overzicht");
}

function leeg(waarde: string | undefined | null): string | null {
  const opgeschoond = (waarde ?? "").trim();
  return opgeschoond === "" ? null : opgeschoond;
}

export async function bewaarMedewerker(
  invoer: unknown,
): Promise<BeheerResultaat> {
  const gecontroleerd = medewerkerSchema.safeParse(invoer);

  if (!gecontroleerd.success) {
    const velden: Record<string, string> = {};
    for (const probleem of gecontroleerd.error.issues) {
      const veld = String(probleem.path[0] ?? "");
      if (veld && !velden[veld]) velden[veld] = probleem.message;
    }
    return { gelukt: false, velden, melding: "Niet alles is goed ingevuld." };
  }

  const gegevens = await werkset();

  if (gegevens.ik.rol !== "beheerder") {
    return { gelukt: false, melding: "Alleen de beheerder kan dit wijzigen." };
  }

  const waarden = gecontroleerd.data;
  const isZichzelf = waarden.id === gegevens.ik.id;

  // Zonder deze twee controles kan de enige beheerder zichzelf buitensluiten.
  if (isZichzelf && waarden.rol !== "beheerder") {
    return {
      gelukt: false,
      melding:
        "Je kunt je eigen beheerdersrol niet afnemen. Laat een andere beheerder dat doen.",
    };
  }
  if (isZichzelf && !waarden.actief) {
    return {
      gelukt: false,
      melding: "Je kunt jezelf niet op niet-actief zetten.",
    };
  }

  const rij = {
    voornaam: waarden.voornaam,
    achternaam: waarden.achternaam,
    email: waarden.email.trim().toLowerCase(),
    rol: waarden.rol,
    telefoon: leeg(waarden.telefoon),
    standplaats_adres: leeg(waarden.standplaatsAdres),
    standplaats_postcode: leeg(waarden.standplaatsPostcode),
    standplaats_plaats: leeg(waarden.standplaatsPlaats),
    in_dienst_vanaf: leeg(waarden.inDienstVanaf),
    uit_dienst_per: leeg(waarden.uitDienstPer),
    actief: waarden.actief,
  };

  const supabase = await supabaseServer();

  if (waarden.id) {
    const { error } = await supabase
      .from("profielen")
      .update({ ...rij, gewijzigd_op: new Date().toISOString() })
      .eq("id", waarden.id);

    if (error) {
      return {
        gelukt: false,
        melding:
          error.code === "23505"
            ? "Dat e-mailadres is al aan een andere medewerker gekoppeld."
            : `De medewerker kon niet worden bijgewerkt. (${error.message})`,
      };
    }

    ververs();
    return { gelukt: true, melding: "Gegevens bijgewerkt.", id: waarden.id };
  }

  const { data, error } = await supabase
    .from("profielen")
    .insert(rij)
    .select("id")
    .single();

  if (error) {
    return {
      gelukt: false,
      melding:
        error.code === "23505"
          ? "Er bestaat al een medewerker met dit e-mailadres."
          : `De medewerker kon niet worden toegevoegd. (${error.message})`,
    };
  }

  ververs();
  return {
    gelukt: true,
    melding:
      "Medewerker toegevoegd. Hij kan nog niet inloggen; stuur daarvoor een uitnodiging.",
    id: data.id as string,
  };
}

/**
 * Alles wat Supabase over een authenticatiefout kwijt wil, op één regel.
 *
 * De tekst van zo'n fout is soms leeg — dan blijft alleen "{}" over, en daar
 * kan niemand iets mee. De code en de HTTP-status zeggen dan meer.
 */
function authFoutTekst(fout: {
  message?: string;
  status?: number;
  code?: string;
  name?: string;
}): string {
  const bruikbaar = (fout.message ?? "").trim();
  const delen = [
    fout.status ? `HTTP ${fout.status}` : null,
    fout.code || null,
    bruikbaar && bruikbaar !== "{}" ? bruikbaar : null,
  ].filter(Boolean);

  if (delen.length > 0) return delen.join(" — ");
  return fout.name || "Supabase gaf geen toelichting";
}

/** Of Supabase weigert omdat er al een account met dit e-mailadres bestaat. */
function bestaatAl(fout: { message?: string; status?: number; code?: string }) {
  return (
    fout.status === 422 ||
    fout.code === "email_exists" ||
    /already been registered|already registered|already exists/i.test(
      fout.message ?? "",
    )
  );
}

/**
 * Extra uitleg als de database het nieuwe account weigerde.
 *
 * "Database error saving new user" betekent dat een trigger in Postgres de
 * koppeling tussen account en profiel tegenhield. Dat was precies wat de
 * migratie van 25 september oplost; staat die er nog niet in, dan loopt elke
 * uitnodiging hierop vast.
 */
function databaseHint(fout: { message?: string }): string {
  return /database error/i.test(fout.message ?? "")
    ? " De database weigerde het nieuwe account. Draai in de SQL Editor van Supabase de migratie 20260925090000_profielbewaking_alleen_voor_gebruikers.sql en probeer het daarna opnieuw."
    : "";
}

/** Het adres waarop dit portaal draait, zoals de browser het net opvroeg. */
async function portaalAdres(): Promise<string> {
  const kop = await headers();
  const host = kop.get("x-forwarded-host") ?? kop.get("host") ?? "";
  const protocol = kop.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

/**
 * Een medewerker uitnodigen om in te loggen (SPEC.md 6.6).
 *
 * Supabase stuurt een e-mail met een eenmalige link naar `/instellen`, waar de
 * medewerker een wachtwoord kiest. De databasetrigger koppelt het nieuwe
 * account op e-mailadres aan het profiel dat hier al staat.
 *
 * Dit is de enige plek waar de geheime sleutel wordt gebruikt: accounts
 * aanmaken kan niet met de sessie van een gewone gebruiker.
 */
export async function nodigMedewerkerUit(
  profielId: string,
): Promise<BeheerResultaat> {
  const gegevens = await werkset();

  if (gegevens.ik.rol !== "beheerder") {
    return { gelukt: false, melding: "Alleen de beheerder kan uitnodigen." };
  }

  const profiel = gegevens.profielen.find((regel) => regel.id === profielId);

  if (!profiel) {
    return { gelukt: false, melding: "Deze medewerker staat niet in het portaal." };
  }
  if (profiel.heeftAccount) {
    return {
      gelukt: false,
      melding:
        "Deze medewerker heeft al een inlog. Lukt inloggen niet, laat hem dan \"Wachtwoord vergeten\" gebruiken.",
    };
  }

  const beheer = supabaseBeheer();

  if (!beheer) {
    return {
      gelukt: false,
      melding:
        "Uitnodigen kan nog niet: de geheime sleutel (SUPABASE_SERVICE_ROLE_KEY) staat niet bij de omgevingsvariabelen. Zie PUBLICEREN.md stap 3.",
    };
  }

  const { error } = await beheer.auth.admin.inviteUserByEmail(profiel.email, {
    redirectTo: `${await portaalAdres()}/instellen`,
    data: { voornaam: profiel.voornaam, achternaam: profiel.achternaam },
  });

  if (error) {
    // Bestaat het account al — bijvoorbeeld met de hand aangemaakt in
    // Supabase — dan is er niets uit te nodigen, maar mist alleen de koppeling
    // met dit profiel. Die leggen we hier alsnog.
    if (bestaatAl(error)) {
      const gekoppeld = await koppelBestaandAccount(profiel.id, profiel.email);
      return gekoppeld
        ? {
            gelukt: true,
            melding:
              "Er bestond al een account met dit e-mailadres. Dat is nu aan dit profiel gekoppeld; laat de medewerker zo nodig \"Wachtwoord vergeten\" gebruiken.",
          }
        : {
            gelukt: false,
            melding:
              "Er bestaat al een account met dit e-mailadres, maar dat kon niet aan dit profiel worden gekoppeld.",
          };
    }

    const hint = databaseHint(error);

    return {
      gelukt: false,
      melding:
        `De uitnodiging kon niet worden verstuurd. [${authFoutTekst(error)}]` +
        (hint ||
          " Meestal ligt het aan de e-mail: zolang er in Supabase geen eigen " +
            "afzender is ingesteld, verstuurt Supabase alleen proefberichten — " +
            "een paar per uur, en vaak alleen naar het adres waarmee je zelf " +
            "bij Supabase bent aangemeld. Gebruik dan de knop Link: die maakt " +
            "een link die je zelf doorstuurt, zonder e-mail."),
    };
  }

  ververs();
  return {
    gelukt: true,
    melding: `Uitnodiging verstuurd naar ${profiel.email}.`,
  };
}

/** Zoekt een bestaand account op e-mailadres en hangt het aan het profiel. */
async function koppelBestaandAccount(
  profielId: string,
  email: string,
): Promise<boolean> {
  const beheer = supabaseBeheer();
  if (!beheer) return false;

  const { data, error } = await beheer.auth.admin.listUsers({ perPage: 200 });
  if (error) return false;

  const gezocht = email.trim().toLowerCase();
  const account = data.users.find(
    (gebruiker) => (gebruiker.email ?? "").toLowerCase() === gezocht,
  );
  if (!account) return false;

  const supabase = await supabaseServer();
  const { error: koppelFout } = await supabase
    .from("profielen")
    .update({
      auth_gebruiker_id: account.id,
      gewijzigd_op: new Date().toISOString(),
    })
    .eq("id", profielId);

  if (koppelFout) return false;

  ververs();
  return true;
}

/**
 * Een eenmalige link waarmee een medewerker een wachtwoord instelt.
 *
 * Hetzelfde doel als `nodigMedewerkerUit`, maar zonder e-mail: Supabase maakt
 * de link en geeft hem terug, in plaats van hem te versturen. De beheerder
 * stuurt hem dan zelf door. Dat is de uitweg als er nog geen eigen afzender is
 * ingesteld — de proefvoorziening van Supabase stuurt maar een paar berichten
 * per uur en vaak alleen naar je eigen adres.
 *
 * Heeft de medewerker nog geen account, dan maakt Supabase dat meteen aan en is
 * het een uitnodiging. Bestaat het al, dan is het een herstellink.
 *
 * De link wijst rechtstreeks naar `/instellen` in dit portaal, met het
 * eenmalige kenmerk van Supabase erin — niet naar de link die Supabase zelf
 * teruggeeft. Die laatste zet de inloggegevens achter een hekje in het adres,
 * en dat formaat weigert de inlogverbinding van het portaal. Met het kenmerk
 * controleert `/instellen` de link zelf bij Supabase, in welke browser dan ook.
 *
 * De link geeft toegang tot het account. Hij komt daarom alleen op het scherm
 * van de beheerder, en nergens in een logregel.
 */
export async function maakToegangslink(
  profielId: string,
): Promise<BeheerResultaat> {
  const gegevens = await werkset();

  if (gegevens.ik.rol !== "beheerder") {
    return { gelukt: false, melding: "Alleen de beheerder kan dit." };
  }

  const profiel = gegevens.profielen.find((regel) => regel.id === profielId);

  if (!profiel) {
    return {
      gelukt: false,
      melding: "Deze medewerker staat niet in het portaal.",
    };
  }

  const beheer = supabaseBeheer();

  if (!beheer) {
    return {
      gelukt: false,
      melding:
        "Hiervoor is de geheime sleutel nodig (SUPABASE_SERVICE_ROLE_KEY). Zie PUBLICEREN.md stap 4b.",
    };
  }

  const adres = await portaalAdres();
  let soort: "invite" | "recovery" = profiel.heeftAccount
    ? "recovery"
    : "invite";

  let uitkomst = await beheer.auth.admin.generateLink({
    type: soort,
    email: profiel.email,
    options: { redirectTo: `${adres}/instellen` },
  });

  // Staat het account al in Supabase maar hangt het nog niet aan dit profiel —
  // bijvoorbeeld omdat het met de hand is aangemaakt — dan weigert Supabase een
  // uitnodiging. Dan koppelen we het alsnog en wordt het een herstellink.
  if (uitkomst.error && soort === "invite" && bestaatAl(uitkomst.error)) {
    const gekoppeld = await koppelBestaandAccount(profiel.id, profiel.email);
    if (!gekoppeld) {
      return {
        gelukt: false,
        melding:
          "Er bestaat al een account met dit e-mailadres, maar dat kon niet aan dit profiel worden gekoppeld.",
      };
    }

    soort = "recovery";
    uitkomst = await beheer.auth.admin.generateLink({
      type: soort,
      email: profiel.email,
      options: { redirectTo: `${adres}/instellen` },
    });
  }

  if (uitkomst.error) {
    return {
      gelukt: false,
      melding: `De link kon niet worden gemaakt. [${authFoutTekst(uitkomst.error)}]${databaseHint(uitkomst.error)}`,
    };
  }

  const kenmerk = uitkomst.data.properties?.hashed_token;

  if (!kenmerk) {
    return { gelukt: false, melding: "Supabase gaf geen link terug." };
  }

  const link = `${adres}/instellen?token_hash=${encodeURIComponent(kenmerk)}&type=${soort}`;

  // Bestond het account nog niet, dan is het zojuist aangemaakt en heeft de
  // trigger het aan dit profiel gekoppeld. Even verversen, anders blijft er
  // "nog geen inlog" staan.
  ververs();

  return {
    gelukt: true,
    link,
    melding:
      soort === "recovery"
        ? `Herstellink gemaakt voor ${profiel.email}.`
        : `Uitnodigingslink gemaakt voor ${profiel.email}.`,
  };
}

/**
 * Een contractregel weghalen.
 *
 * Nodig om een vergissing te herstellen: de eerste keer opslaan zet de
 * ingangsdatum op vandaag, en wie die datum daarna niet meer aanpast houdt een
 * regel over die nergens op slaat. De uren die eraan hangen blijven gewoon
 * staan — een contract bepaalt alleen de norm, niet de geboekte uren.
 */
export async function verwijderContract(
  contractId: string,
): Promise<BeheerResultaat> {
  const gegevens = await werkset();

  if (gegevens.ik.rol !== "beheerder") {
    return {
      gelukt: false,
      melding: "Alleen de beheerder kan een contract weghalen.",
    };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase
    .from("contracten")
    .delete()
    .eq("id", contractId);

  if (error) {
    return {
      gelukt: false,
      melding: `Het contract kon niet worden weggehaald. (${error.message})`,
    };
  }

  ververs();
  return { gelukt: true, melding: "Contract weggehaald." };
}
