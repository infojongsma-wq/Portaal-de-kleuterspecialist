import { describe, expect, it } from "vitest";

import type { TrainingenVanMedewerker } from "@/lib/trainingen/gedaan";
import { veiligeHtml, weekmailBericht } from "../bericht";
import {
  isWeekmailMoment,
  tijdstipInNederland,
  weekInNederland,
} from "../tijd";

describe("tijdstip van de weekmail (SPEC.md 6.6)", () => {
  it("wintertijd: 07:xx UTC op maandag is 08:xx in Nederland", () => {
    // 26 oktober 2026 is een maandag; de wintertijd begon op 25 oktober.
    expect(isWeekmailMoment(new Date("2026-10-26T06:30:00Z"))).toBe(false); // 07:30
    expect(isWeekmailMoment(new Date("2026-10-26T07:00:00Z"))).toBe(true); // 08:00
    expect(isWeekmailMoment(new Date("2026-10-26T07:59:00Z"))).toBe(true); // 08:59
    expect(isWeekmailMoment(new Date("2026-10-26T08:00:00Z"))).toBe(false); // 09:00
  });

  it("zomertijd: 06:xx UTC op maandag is 08:xx in Nederland", () => {
    // 1 juni 2026 is een maandag.
    expect(isWeekmailMoment(new Date("2026-06-01T06:00:00Z"))).toBe(true); // 08:00
    expect(isWeekmailMoment(new Date("2026-06-01T06:45:00Z"))).toBe(true); // 08:45
    expect(isWeekmailMoment(new Date("2026-06-01T07:15:00Z"))).toBe(false); // 09:15
  });

  it("alleen op maandag", () => {
    expect(isWeekmailMoment(new Date("2026-10-27T07:30:00Z"))).toBe(false); // dinsdag
    expect(isWeekmailMoment(new Date("2026-10-25T07:30:00Z"))).toBe(false); // zondag
  });

  it("de week volgt de Nederlandse datum, ISO, met maandag als eerste dag", () => {
    expect(weekInNederland(new Date("2026-10-26T07:00:00Z"))).toBe("2026-W44");
    // 22:30 UTC is zondag 23:30 in Nederland: nog week 43. Een uur later is
    // het maandag 00:30 in Nederland en week 44, terwijl het in UTC nog
    // zondag is.
    expect(weekInNederland(new Date("2026-10-25T22:30:00Z"))).toBe("2026-W43");
    expect(weekInNederland(new Date("2026-10-25T23:30:00Z"))).toBe("2026-W44");
    // De jaarwisseling: 31 december 2026 valt in week 53 van 2026.
    expect(weekInNederland(new Date("2026-12-31T10:00:00Z"))).toBe("2026-W53");
    expect(weekInNederland(new Date("2027-01-04T10:00:00Z"))).toBe("2027-W01");
  });

  it("toont het tijdstip in Nederlandse tijd", () => {
    expect(tijdstipInNederland("2026-10-26T07:04:00Z")).toBe("maandag 26-10-2026 om 08:04");
    expect(tijdstipInNederland("2026-06-01T06:10:00Z")).toBe("maandag 01-06-2026 om 08:10");
  });
});

/** Verzonnen scholen en medewerkers (CLAUDE.md). */
const NIEUW: TrainingenVanMedewerker[] = [
  {
    id: "a",
    naam: "Proef Aalders",
    trainingen: [
      {
        afspraakId: "1",
        datum: "2026-10-20",
        school: "Basisschool De Proef",
        plaats: "Testdorp",
        titel: "Rekenen met kleuters",
        soort: "Training",
        voltooidOp: null,
        factuurVerstuurdOp: null,
        gemeld: false,
      },
      {
        afspraakId: "2",
        datum: "2026-10-22",
        school: "Kindcentrum <Voorbeeld> & Co",
        plaats: "Proefstad",
        titel: "Observatie groep 1-2",
        soort: "Observatie",
        voltooidOp: null,
        factuurVerstuurdOp: null,
        gemeld: false,
      },
    ],
  },
];

describe("inhoud van de weekmail (SPEC.md 6.6)", () => {
  const basis = {
    nieuw: NIEUW,
    week: "2026-W44",
    eerste: false,
    portaalAdres: "https://portaal.voorbeeld.nl/",
  };

  it("noemt het aantal en de week in het onderwerp", () => {
    expect(weekmailBericht(basis).onderwerp).toBe(
      "Trainingen gedaan — week 44: 2 trainingen",
    );
    expect(
      weekmailBericht({ ...basis, nieuw: [{ ...NIEUW[0], trainingen: [NIEUW[0].trainingen[0]] }] })
        .onderwerp,
    ).toBe("Trainingen gedaan — week 44: 1 training");
  });

  it("zet per medewerker de trainingen erin, met datum, school, plaats en titel", () => {
    const { tekst } = weekmailBericht(basis);
    expect(tekst).toContain("Proef Aalders (2)");
    expect(tekst).toContain(
      "- di 20-10-2026 · Basisschool De Proef, Testdorp · Rekenen met kleuters (Training)",
    );
    expect(tekst).toContain("https://portaal.voorbeeld.nl/beheer#trainingen");
  });

  it("zegt het als er niets nieuws is", () => {
    const bericht = weekmailBericht({ ...basis, nieuw: [] });
    expect(bericht.onderwerp).toBe("Trainingen gedaan — week 44: niets nieuws");
    expect(bericht.tekst).toContain("geen training als gedaan afgevinkt");
    expect(bericht.tekst).not.toContain("factuur");
  });

  it("de eerste weekmail legt uit dat alles erin staat", () => {
    expect(weekmailBericht({ ...basis, eerste: true }).tekst).toContain(
      "Dit is de eerste weekmail",
    );
  });

  it("maakt tekens als < en & onschadelijk in de opgemaakte versie", () => {
    const { html } = weekmailBericht(basis);
    expect(html).toContain("Kindcentrum &lt;Voorbeeld&gt; &amp; Co");
    expect(html).not.toContain("<Voorbeeld>");
    expect(veiligeHtml(`"a" & 'b'`)).toBe("&quot;a&quot; &amp; &#39;b&#39;");
  });

  it("werkt ook zonder adres van het portaal", () => {
    const { tekst, html } = weekmailBericht({ ...basis, portaalAdres: null });
    expect(tekst).not.toContain("http");
    expect(html).not.toContain("href");
  });
});
