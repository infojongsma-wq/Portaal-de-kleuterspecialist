import { describe, expect, it } from "vitest";
import {
  berekenJaarnorm,
  kalenderdagen,
  persoonlijkeJaarnorm,
  werktijdfactor,
} from "../jaarnorm";

/** Uit `contracten.norm_fulltime`. */
const NORM_FULLTIME = 1659;

describe("deeltijdfactor en jaarnorm", () => {
  // Exact de tabel uit SPEC.md 5.4 stap 1; die stap is ongewijzigd.
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
    it(`${urenPerWeek} uur per week geeft factor ${wtf} en jaarnorm ${norm}`, () => {
      expect(werktijdfactor(urenPerWeek)).toBe(wtf);
      expect(persoonlijkeJaarnorm(NORM_FULLTIME, urenPerWeek)).toBe(norm);
    });
  }
});

describe("kalenderdagen", () => {
  it("telt een heel gewoon jaar", () => {
    expect(kalenderdagen("2027-01-01", "2027-12-31")).toBe(365);
  });

  it("telt een schrikkeljaar", () => {
    expect(kalenderdagen("2028-01-01", "2028-12-31")).toBe(366);
  });

  it("telt de begin- en einddag allebei mee", () => {
    expect(kalenderdagen("2027-03-08", "2027-03-14")).toBe(7);
  });

  it("geeft 0 als de einddatum vóór de startdatum ligt", () => {
    expect(kalenderdagen("2027-12-31", "2027-01-01")).toBe(0);
  });
});

describe("jaarnorm over een heel jaar", () => {
  const basis = {
    jaar: 2027,
    urenPerWeek: 24,
    normFulltime: NORM_FULLTIME,
    gerealiseerdeUren: 0,
    geplandeUren: 0,
  };

  it("geeft bij een volledig jaar precies de persoonlijke jaarnorm", () => {
    const uitkomst = berekenJaarnorm(basis);
    expect(uitkomst.persoonlijkeJaarnorm).toBe(995.4);
    expect(uitkomst.normPeriode).toBe(995.4);
    expect(uitkomst.dagenPeriode).toBe(365);
  });

  it("rekent nog te gaan als norm min gerealiseerd", () => {
    const uitkomst = berekenJaarnorm({ ...basis, gerealiseerdeUren: 400 });
    expect(uitkomst.nogTeGaan).toBe(595.4);
  });

  it("geeft een negatief getal als er meer is gewerkt dan de norm", () => {
    const uitkomst = berekenJaarnorm({ ...basis, gerealiseerdeUren: 1000 });
    expect(uitkomst.nogTeGaan).toBe(-4.6);
  });

  it("laat de jaarnorm niet meelopen met een datum in een ander jaar", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      inDienstVanaf: "2020-08-01",
    });
    expect(uitkomst.normPeriode).toBe(995.4);
    expect(uitkomst.periodeStart).toBe("2027-01-01");
  });
});

describe("naar rato bij in- en uitdiensttreding", () => {
  const basis = {
    jaar: 2027,
    urenPerWeek: 24,
    normFulltime: NORM_FULLTIME,
    gerealiseerdeUren: 0,
    geplandeUren: 0,
  };

  // 2027 heeft 365 dagen. De norm gaat naar rato over de kalenderdagen van de
  // periode: van ingangsdatum tot en met 31 december.
  const testgevallen: Array<{
    inDienstVanaf: string;
    dagen: number;
    norm: number;
  }> = [
    { inDienstVanaf: "2027-01-01", dagen: 365, norm: 995.4 },
    { inDienstVanaf: "2027-07-01", dagen: 184, norm: 501.79 },
    { inDienstVanaf: "2027-10-01", dagen: 92, norm: 250.9 },
    { inDienstVanaf: "2027-12-31", dagen: 1, norm: 2.73 },
  ];

  for (const { inDienstVanaf, dagen, norm } of testgevallen) {
    it(`indiensttreding op ${inDienstVanaf} geeft ${dagen} dagen en norm ${norm}`, () => {
      const uitkomst = berekenJaarnorm({ ...basis, inDienstVanaf });
      expect(uitkomst.dagenPeriode).toBe(dagen);
      expect(uitkomst.normPeriode).toBe(norm);
    });
  }

  it("kort de norm ook in bij uitdiensttreding halverwege", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      uitDienstPer: "2027-06-30",
    });
    expect(uitkomst.dagenPeriode).toBe(181);
    expect(uitkomst.periodeEind).toBe("2027-06-30");
    expect(uitkomst.normPeriode).toBe(493.61);
  });

  it("rekent een dienstverband dat binnen één jaar begint en eindigt", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      inDienstVanaf: "2027-03-01",
      uitDienstPer: "2027-08-31",
    });
    expect(uitkomst.dagenPeriode).toBe(184);
    expect(uitkomst.normPeriode).toBe(501.79);
  });

  it("geeft nul als het dienstverband buiten het jaar valt", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      inDienstVanaf: "2028-01-01",
    });
    expect(uitkomst.dagenPeriode).toBe(0);
    expect(uitkomst.normPeriode).toBe(0);
  });
});

describe("gerealiseerd en gepland", () => {
  it("houdt gepland en gerealiseerd los van elkaar", () => {
    const uitkomst = berekenJaarnorm({
      jaar: 2027,
      urenPerWeek: 24,
      normFulltime: NORM_FULLTIME,
      gerealiseerdeUren: 120.5,
      geplandeUren: 240.75,
    });

    expect(uitkomst.gerealiseerdeUren).toBe(120.5);
    expect(uitkomst.geplandeUren).toBe(240.75);
    expect(uitkomst.nogTeGaan).toBe(874.9);
  });
});

describe("het contract begrenst de periode net zo goed", () => {
  const basis = {
    jaar: 2026,
    urenPerWeek: 24,
    normFulltime: NORM_FULLTIME,
    gerealiseerdeUren: 0,
    geplandeUren: 0,
  };

  it("rekent vanaf de ingangsdatum van het contract", () => {
    // 1 oktober tot en met 31 december 2026: 92 van de 365 dagen.
    const uitkomst = berekenJaarnorm({
      ...basis,
      inDienstVanaf: "2026-10-01",
      contractVanaf: "2026-10-01",
    });
    expect(uitkomst.periodeStart).toBe("2026-10-01");
    expect(uitkomst.dagenPeriode).toBe(92);
    expect(uitkomst.normPeriode).toBe(250.9);
  });

  it("neemt de laatste van de twee startdatums", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      inDienstVanaf: "2026-08-01",
      contractVanaf: "2026-10-01",
    });
    expect(uitkomst.periodeStart).toBe("2026-10-01");
  });

  it("kort ook in op de einddatum van het contract", () => {
    const uitkomst = berekenJaarnorm({
      ...basis,
      contractVanaf: "2026-01-01",
      contractTot: "2026-06-30",
    });
    expect(uitkomst.periodeEind).toBe("2026-06-30");
    expect(uitkomst.dagenPeriode).toBe(181);
  });
});
