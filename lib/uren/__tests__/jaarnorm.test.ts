import { describe, expect, it } from "vitest";
import {
  berekenJaarnorm,
  inzetbareDagen,
  persoonlijkeJaarnorm,
  vakantiegegevensLijkenOnvolledig,
  werktijdfactor,
} from "../jaarnorm";
import { VERWACHTE_INZETBARE_DAGEN } from "../constants";

/** Uit `contracten.norm_fulltime`. */
const NORM_FULLTIME = 1659;

describe("werktijdfactor en jaarnorm (SPEC.md 5.4 stap 1)", () => {
  // Exact de tabel uit SPEC.md 5.4.
  const testgevallen: Array<{ urenPerWeek: number; wtf: number; norm: number }> =
    [
      { urenPerWeek: 8, wtf: 0.2, norm: 331.8 },
      { urenPerWeek: 16, wtf: 0.4, norm: 663.6 },
      { urenPerWeek: 20, wtf: 0.5, norm: 829.5 },
      { urenPerWeek: 24, wtf: 0.6, norm: 995.4 },
      { urenPerWeek: 32, wtf: 0.8, norm: 1327.2 },
      { urenPerWeek: 40, wtf: 1.0, norm: 1659.0 },
    ];

  for (const { urenPerWeek, wtf, norm } of testgevallen) {
    it(`${urenPerWeek} uur per week geeft wtf ${wtf} en jaarnorm ${norm}`, () => {
      expect(werktijdfactor(urenPerWeek)).toBe(wtf);
      expect(persoonlijkeJaarnorm(NORM_FULLTIME, urenPerWeek)).toBe(norm);
    });
  }
});

describe("inzetbare dagen (SPEC.md 5.4 stap 2)", () => {
  it("telt 261 weekdagen in 2027 zonder niet-inzetbare dagen", () => {
    expect(inzetbareDagen("2027-01-01", "2027-12-31", [])).toBe(261);
  });

  it("telt alleen maandag tot en met vrijdag", () => {
    // 2027-03-08 is een maandag, 2027-03-14 een zondag.
    expect(inzetbareDagen("2027-03-08", "2027-03-14", [])).toBe(5);
  });

  it("geeft 0 als de einddatum vóór de startdatum ligt", () => {
    expect(inzetbareDagen("2027-12-31", "2027-01-01", [])).toBe(0);
  });

  it("trekt een schoolvakantie die ook feestdag is maar één keer af", () => {
    // 2027-12-27 is een maandag: kerstvakantie én — in dit testgeval —
    // aangemerkt als feestdag. Mag niet dubbel worden afgetrokken
    // (SPEC.md hoofdstuk 9, testeis 6).
    expect(
      inzetbareDagen("2027-01-01", "2027-12-31", [
        "2027-12-27",
        "2027-12-27",
      ]),
    ).toBe(260);
  });

  it("trekt een niet-inzetbare dag in het weekend niet af", () => {
    // 2027-12-25 (eerste kerstdag) valt op een zaterdag.
    expect(inzetbareDagen("2027-01-01", "2027-12-31", ["2027-12-25"])).toBe(261);
  });
});

describe("controle op de vakantiegegevens (SPEC.md 5.4)", () => {
  it("waarschuwt als de vakantiedagen ontbreken", () => {
    // 261 dagen wijkt ver af van de verwachte 207,4.
    expect(vakantiegegevensLijkenOnvolledig(261)).toBe(true);
  });

  it("waarschuwt niet bij een volledig gevulde tabel", () => {
    expect(vakantiegegevensLijkenOnvolledig(206)).toBe(false);
    expect(vakantiegegevensLijkenOnvolledig(VERWACHTE_INZETBARE_DAGEN)).toBe(
      false,
    );
  });

  it("hanteert een marge van 5 procent", () => {
    // 5% van 207,4 is 10,37 — de grens ligt dus op 197,03 en 217,77.
    expect(vakantiegegevensLijkenOnvolledig(198)).toBe(false);
    expect(vakantiegegevensLijkenOnvolledig(196)).toBe(true);
    expect(vakantiegegevensLijkenOnvolledig(217)).toBe(false);
    expect(vakantiegegevensLijkenOnvolledig(219)).toBe(true);
  });
});

describe("normlijn over het jaar (SPEC.md 5.4 stap 2)", () => {
  /**
   * Verzonnen vakantieperiode om te toetsen dat de normlijn stilstaat: de hele
   * maand augustus 2027 is niet inzetbaar. Niet de echte vakantiedata van
   * regio Noord — die vult de beheerder in.
   */
  const augustusVrij = Array.from({ length: 31 }, (_, dag) => {
    return `2027-08-${String(dag + 1).padStart(2, "0")}`;
  });

  function balansOp(peildatum: string) {
    return berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 40,
      normFulltime: NORM_FULLTIME,
      nietInzetbareDatums: augustusVrij,
      peildatum,
      gerealiseerdeUren: 0,
      geplandeUren: 0,
    });
  }

  it("laat de verwachte uren niet oplopen tijdens een vakantie", () => {
    const voorDeVakantie = balansOp("2027-07-31");
    const naDeVakantie = balansOp("2027-08-31");
    expect(naDeVakantie.verwachteUren).toBe(voorDeVakantie.verwachteUren);
  });

  it("laat de verwachte uren weer oplopen in een schoolweek", () => {
    expect(balansOp("2027-09-30").verwachteUren).toBeGreaterThan(
      balansOp("2027-08-31").verwachteUren,
    );
  });

  it("komt op 31 december precies op de jaarnorm uit", () => {
    const eindejaar = balansOp("2027-12-31");
    expect(eindejaar.verwachteUren).toBe(eindejaar.persoonlijkeJaarnorm);
    expect(eindejaar.verstrekenDeel).toBe(1);
  });

  it("berekent het saldo als gerealiseerd min verwacht", () => {
    const balans = berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 40,
      normFulltime: NORM_FULLTIME,
      nietInzetbareDatums: augustusVrij,
      peildatum: "2027-12-31",
      gerealiseerdeUren: 1600,
      geplandeUren: 1700,
    });

    expect(balans.saldo).toBe(1600 - 1659);
    // Alleen gerealiseerde uren tellen mee voor het saldo.
    expect(balans.geplandeUren).toBe(1700);
  });
});

describe("eerste jaar naar rato (SPEC.md 5.4 stap 3)", () => {
  // 2027 telt 261 weekdagen; zonder vakantiedata blijft dat de deler.
  const testgevallen: Array<{
    inDienstVanaf: string;
    dagen: number;
    norm: number;
  }> = [
    { inDienstVanaf: "2027-03-01", dagen: 220, norm: 1398.39 },
    { inDienstVanaf: "2027-07-01", dagen: 132, norm: 839.03 },
    { inDienstVanaf: "2027-10-01", dagen: 66, norm: 419.52 },
  ];

  for (const { inDienstVanaf, dagen, norm } of testgevallen) {
    it(`indiensttreding op ${inDienstVanaf} geeft ${dagen} inzetbare dagen en norm ${norm}`, () => {
      const balans = berekenJaarnorm({
        jaar: 2027,
        urenPerWeek: 40,
        normFulltime: NORM_FULLTIME,
        nietInzetbareDatums: [],
        inDienstVanaf,
        peildatum: "2027-12-31",
        gerealiseerdeUren: 0,
        geplandeUren: 0,
      });

      expect(balans.inzetbareDagenJaar).toBe(261);
      expect(balans.inzetbareDagenPeriode).toBe(dagen);
      expect(balans.normPeriode).toBe(norm);
      // Aan het eind van het jaar is de verwachting gelijk aan de periodenorm.
      expect(balans.verwachteUren).toBe(norm);
      expect(balans.verstrekenDeelPeriode).toBe(1);
    });
  }

  it("rekent naar rato door bij een deeltijdcontract", () => {
    const balans = berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 20,
      normFulltime: NORM_FULLTIME,
      nietInzetbareDatums: [],
      inDienstVanaf: "2027-07-01",
      peildatum: "2027-12-31",
      gerealiseerdeUren: 0,
      geplandeUren: 0,
    });

    expect(balans.persoonlijkeJaarnorm).toBe(829.5);
    // 829,50 × 132 ÷ 261 = 419,52
    expect(balans.normPeriode).toBe(419.52);
  });

  it("telt de periode vóór indiensttreding niet mee", () => {
    const balans = berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 40,
      normFulltime: NORM_FULLTIME,
      nietInzetbareDatums: [],
      inDienstVanaf: "2027-07-01",
      peildatum: "2027-06-30",
      gerealiseerdeUren: 0,
      geplandeUren: 0,
    });

    expect(balans.inzetbareDagenVerstreken).toBe(0);
    expect(balans.verwachteUren).toBe(0);
  });

  it("stopt bij uitdiensttreding", () => {
    const balans = berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 40,
      normFulltime: NORM_FULLTIME,
      nietInzetbareDatums: [],
      uitDienstPer: "2027-06-30",
      peildatum: "2027-12-31",
      gerealiseerdeUren: 0,
      geplandeUren: 0,
    });

    // 1 januari tot en met 30 juni 2027: 261 − 132 = 129 weekdagen.
    expect(balans.inzetbareDagenPeriode).toBe(129);
    expect(balans.inzetbareDagenVerstreken).toBe(129);
  });
});
