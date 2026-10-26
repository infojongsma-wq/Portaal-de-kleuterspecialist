import nodemailer from "nodemailer";

import type { WeekmailBericht } from "./bericht";

/**
 * De weekmail versturen via de mailserver van het eigen domein (SPEC.md 3 en
 * 6.6). Alleen voor de server.
 *
 * De inloggegevens van de mailbox staan in omgevingsvariabelen in Vercel,
 * nooit in een `NEXT_PUBLIC_*`-variabele en nooit in de code:
 *
 * - `SMTP_HOST`       de mailserver, bij Strato `smtp.strato.de`
 * - `SMTP_PORT`       standaard 465 (versleuteld vanaf het begin)
 * - `SMTP_GEBRUIKER`  het volledige mailadres van de mailbox; ook de afzender
 * - `SMTP_WACHTWOORD` het wachtwoord van die mailbox
 * - `WEEKMAIL_AAN`    het adres waar de weekmail heen gaat
 *
 * De mail bevat namen van medewerkers en scholen. Op verzoek van de
 * opdrachtgever gaat hij via de eigen mailserver, zodat er geen nieuwe partij
 * bij komt (CLAUDE.md, "Privacy"). Foutmeldingen noemen daarom nooit een
 * adres of de inhoud.
 */

export interface MailInstellingen {
  host: string;
  port: number;
  gebruiker: string;
  wachtwoord: string;
  aan: string;
}

const STANDAARDPOORT = 465;

export function mailInstellingen():
  | { instellingen: MailInstellingen; ontbreekt: [] }
  | { instellingen: null; ontbreekt: string[] } {
  const waarde = (naam: string) => process.env[naam]?.trim() || null;

  const host = waarde("SMTP_HOST");
  const gebruiker = waarde("SMTP_GEBRUIKER");
  const wachtwoord = process.env.SMTP_WACHTWOORD || null;
  const aan = waarde("WEEKMAIL_AAN");
  const poort = Number(waarde("SMTP_PORT") ?? STANDAARDPOORT);

  const ontbreekt = [
    host ? null : "SMTP_HOST",
    gebruiker ? null : "SMTP_GEBRUIKER",
    wachtwoord ? null : "SMTP_WACHTWOORD",
    aan ? null : "WEEKMAIL_AAN",
    Number.isInteger(poort) && poort > 0 ? null : "SMTP_PORT",
  ].filter((naam): naam is string => naam !== null);

  if (ontbreekt.length > 0 || !host || !gebruiker || !wachtwoord || !aan) {
    return { instellingen: null, ontbreekt };
  }

  return {
    instellingen: { host, port: poort, gebruiker, wachtwoord, aan },
    ontbreekt: [],
  };
}

function maakVerbinding(instellingen: MailInstellingen) {
  return nodemailer.createTransport({
    host: instellingen.host,
    port: instellingen.port,
    // Poort 465 is meteen versleuteld; 587 schakelt na het begin over.
    secure: instellingen.port === 465,
    requireTLS: instellingen.port !== 465,
    auth: { user: instellingen.gebruiker, pass: instellingen.wachtwoord },
    // Stel je voor met het eigen domein, niet met de interne naam van de
    // server bij Vercel. Spamfilters wantrouwen een onbekende naam.
    name: instellingen.gebruiker.split("@")[1] || undefined,
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });
}

export async function verstuurMail(
  instellingen: MailInstellingen,
  bericht: WeekmailBericht,
): Promise<void> {
  await maakVerbinding(instellingen).sendMail({
    from: { name: "Portaal De Kleuterspecialist", address: instellingen.gebruiker },
    to: instellingen.aan,
    subject: bericht.onderwerp,
    text: bericht.tekst,
    html: bericht.html,
  });
}

/** Kan het portaal inloggen op de mailserver? Verstuurt niets. Voor /diagnose. */
export async function controleerMailserver(
  instellingen: MailInstellingen,
): Promise<void> {
  await maakVerbinding(instellingen).verify();
}

/**
 * Het antwoord van de mailserver, zoals "554 5.7.1 Message rejected", met
 * elk mailadres vervangen door [adres]. Zo staat de reden in de melding,
 * zonder persoonsgegevens.
 */
export function antwoordVanServer(fout: unknown): string | null {
  const antwoord =
    typeof fout === "object" && fout !== null && "response" in fout
      ? String((fout as { response: unknown }).response ?? "")
      : "";
  const schoon = antwoord
    .replace(/\S+@\S+/g, "[adres]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);
  return schoon || null;
}

/**
 * Een foutmelding in gewone taal, met de foutcode en het antwoord van de
 * mailserver. Nooit de oorspronkelijke tekst van de fout: daar kan een
 * mailadres in staan.
 */
export function mailFoutMelding(fout: unknown): string {
  const code =
    typeof fout === "object" && fout !== null && "code" in fout
      ? String((fout as { code: unknown }).code)
      : "";
  const antwoord = antwoordVanServer(fout);
  const metAntwoord = (melding: string) =>
    antwoord ? `${melding} Antwoord van de mailserver: "${antwoord}".` : melding;

  switch (code) {
    case "EAUTH":
      return metAntwoord(
        "De mailserver weigert de inlog. Klopt SMTP_GEBRUIKER (het volledige mailadres) en SMTP_WACHTWOORD?",
      );
    case "EDNS":
    case "ECONNECTION":
    case "ESOCKET":
    case "ETIMEDOUT":
      return `De mailserver is niet bereikbaar (${code}). Klopt SMTP_HOST, en SMTP_PORT (meestal 465)?`;
    case "EENVELOPE":
      return metAntwoord(
        "De mailserver weigert de afzender of de ontvanger. Klopt WEEKMAIL_AAN, en is SMTP_GEBRUIKER een mailadres van deze mailbox?",
      );
    case "EMESSAGE":
      return metAntwoord("De mailserver weigert de mail zelf.");
    default:
      return metAntwoord(
        code
          ? `De mail kon niet worden verstuurd (${code}).`
          : "De mail kon niet worden verstuurd.",
      );
  }
}
