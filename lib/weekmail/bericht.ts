import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";

import {
  aantalTrainingen,
  type GedaneTraining,
  type TrainingenVanMedewerker,
} from "@/lib/trainingen/gedaan";
import { weeknummerUit } from "./tijd";

/**
 * De tekst van de weekmail (SPEC.md 6.6): per medewerker de trainingen die
 * sinds de vorige weekmail als gedaan zijn afgevinkt.
 *
 * Een pure functie, zodat de inhoud los te testen is. Er gaat een gewone
 * tekstversie en een opgemaakte versie mee; mailprogramma's kiezen zelf.
 */

export interface WeekmailBericht {
  onderwerp: string;
  tekst: string;
  html: string;
}

export interface WeekmailInvoer {
  /** Alleen wat nog niet in een weekmail stond. */
  nieuw: TrainingenVanMedewerker[];
  /** ISO-week, zoals `2026-W44`. */
  week: string;
  /** Is er nog nooit een weekmail verstuurd? */
  eerste: boolean;
  /**
   * Bijvoorbeeld `https://portaal.dekleuterspecialist.nl`, of `null`. Een
   * adres op vercel.app komt niet in de mail; zie `adresVoorInMail`.
   */
  portaalAdres: string | null;
}

function datumTekst(training: GedaneTraining): string {
  return training.datum
    ? format(parseISO(training.datum), "EEEEEE dd-MM-yyyy", { locale: nl })
    : "zonder datum";
}

function trainingTekst(training: GedaneTraining): string {
  return `${training.school}, ${training.plaats} · ${training.titel} (${training.soort})`;
}

function aantalTekst(aantal: number): string {
  return aantal === 1 ? "1 training" : `${aantal} trainingen`;
}

/**
 * Het adres van het portaal voor de link in de mail, of `null`.
 *
 * Een adres op vercel.app gaat er niet in. Oplichters gebruiken zulke adressen
 * veel, en spamfilters weigeren daarom mail met zo'n link; dat van Strato met
 * "Sending of SPAM is not permitted! (B-URL)". Met een eigen domein voor het
 * portaal (SPEC.md 3) komt de link vanzelf terug.
 */
export function adresVoorInMail(adres: string | null): string | null {
  if (!adres) return null;
  try {
    const host = new URL(adres).hostname;
    const geweigerd =
      host === "localhost" || host === "vercel.app" || host.endsWith(".vercel.app");
    return geweigerd ? null : adres;
  } catch {
    return null;
  }
}

/** Tekens die in HTML iets betekenen, onschadelijk maken. */
export function veiligeHtml(tekst: string): string {
  return tekst
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function weekmailBericht(invoer: WeekmailInvoer): WeekmailBericht {
  const aantal = aantalTrainingen(invoer.nieuw);
  const weeknummer = weeknummerUit(invoer.week);

  const onderwerp =
    aantal === 0
      ? `Trainingen gedaan — week ${weeknummer}: niets nieuws`
      : `Trainingen gedaan — week ${weeknummer}: ${aantalTekst(aantal)}`;

  const inleiding =
    aantal === 0
      ? "Sinds de vorige weekmail is er geen training als gedaan afgevinkt."
      : invoer.eerste
        ? "Dit is de eerste weekmail. Hierin staan alle trainingen die tot nu toe als gedaan zijn afgevinkt."
        : "Sinds de vorige weekmail zijn deze trainingen als gedaan afgevinkt.";

  const basis = adresVoorInMail(invoer.portaalAdres);
  const link = basis ? `${basis.replace(/\/$/, "")}/beheer#trainingen` : null;
  const oproep =
    aantal > 0
      ? "Vink in het portaal bij Beheer → Trainingen gedaan aan wanneer je de factuur hebt verstuurd."
      : null;
  const afsluiting =
    "Deze mail komt elke maandagochtend uit het portaal van De Kleuterspecialist.";

  // Gewone tekst
  const tekstregels = ["Goedemorgen,", "", inleiding];
  for (const medewerker of invoer.nieuw) {
    tekstregels.push("", `${medewerker.naam} (${medewerker.trainingen.length})`);
    for (const training of medewerker.trainingen) {
      tekstregels.push(`- ${datumTekst(training)} · ${trainingTekst(training)}`);
    }
  }
  if (oproep) tekstregels.push("", oproep);
  if (link) tekstregels.push(link);
  tekstregels.push("", afsluiting);

  // Opgemaakt
  const blokken = invoer.nieuw
    .map((medewerker) => {
      const regels = medewerker.trainingen
        .map(
          (training) => `
          <tr>
            <td style="padding:4px 12px 4px 0;white-space:nowrap;vertical-align:top">${veiligeHtml(datumTekst(training))}</td>
            <td style="padding:4px 12px 4px 0;vertical-align:top"><strong>${veiligeHtml(training.school)}</strong>, ${veiligeHtml(training.plaats)}</td>
            <td style="padding:4px 0;vertical-align:top">${veiligeHtml(training.titel)} <span style="color:#6b7280">(${veiligeHtml(training.soort)})</span></td>
          </tr>`,
        )
        .join("");
      return `
      <h3 style="margin:20px 0 6px;font-size:15px">${veiligeHtml(medewerker.naam)} (${medewerker.trainingen.length})</h3>
      <table style="border-collapse:collapse;font-size:14px">${regels}
      </table>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="nl">
  <body style="font-family:Arial,Helvetica,sans-serif;color:#1f2937;line-height:1.5">
    <p>Goedemorgen,</p>
    <p>${veiligeHtml(inleiding)}</p>${blokken}
    ${oproep ? `<p style="margin-top:20px">${veiligeHtml(oproep)}</p>` : ""}
    ${link ? `<p><a href="${veiligeHtml(link)}" style="color:#026666">Naar Trainingen gedaan in het portaal</a></p>` : ""}
    <p style="margin-top:24px;color:#6b7280;font-size:12px">${veiligeHtml(afsluiting)}</p>
  </body>
</html>`;

  return { onderwerp, tekst: tekstregels.join("\n"), html };
}
