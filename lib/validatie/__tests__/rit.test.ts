import { describe, expect, it } from "vitest";

import { afwijkendeReistijdMinuten, leesReisduur, ritSchema } from "../rit";

/** Een geldige rit met verzonnen plaatsen (CLAUDE.md). */
const RIT = {
  datum: "2026-10-26",
  doel: "Training bij een school",
  vanPlaats: "Thuis",
  naarPlaats: "Proefdorp",
  heenEnTerug: true,
  kmEnkel: "23,4",
  reisduurEnkelMinuten: "30",
  afwijkend: false,
  afwijkendUren: "",
  afwijkendMinuten: "",
};

describe("reistijd in het ritformulier (SPEC.md 6.7)", () => {
  it("leest de afwijkende reistijd uit uren en minuten", () => {
    expect(afwijkendeReistijdMinuten("2", "45")).toBe(165);
    expect(afwijkendeReistijdMinuten("", "50")).toBe(50);
    expect(afwijkendeReistijdMinuten("1", "")).toBe(60);
  });

  it("weigert onzin, 60 minuten of meer, nul en meer dan een dag", () => {
    expect(afwijkendeReistijdMinuten("1,5", "")).toBeNull();
    expect(afwijkendeReistijdMinuten("1", "60")).toBeNull();
    expect(afwijkendeReistijdMinuten("0", "0")).toBeNull();
    expect(afwijkendeReistijdMinuten("25", "0")).toBeNull();
  });

  it("leest de berekende reisduur als heel aantal minuten", () => {
    expect(leesReisduur("45")).toBe(45);
    expect(leesReisduur("4,5")).toBeNull();
    expect(leesReisduur("2000")).toBeNull();
  });

  it("accepteert een rit met berekende reisduur", () => {
    expect(ritSchema.safeParse(RIT).success).toBe(true);
  });

  it("vraagt om de reistijd als die niet bekend is", () => {
    const uitkomst = ritSchema.safeParse({ ...RIT, reisduurEnkelMinuten: "" });
    expect(uitkomst.success).toBe(false);
    expect(uitkomst.error?.issues[0].path).toEqual(["afwijkendUren"]);

    expect(
      ritSchema.safeParse({
        ...RIT,
        reisduurEnkelMinuten: "",
        afwijkend: true,
        afwijkendUren: "1",
        afwijkendMinuten: "10",
      }).success,
    ).toBe(true);
  });

  it("weigert een onjuiste afwijkende reistijd", () => {
    expect(
      ritSchema.safeParse({ ...RIT, afwijkend: true, afwijkendUren: "", afwijkendMinuten: "75" })
        .success,
    ).toBe(false);
  });
});
