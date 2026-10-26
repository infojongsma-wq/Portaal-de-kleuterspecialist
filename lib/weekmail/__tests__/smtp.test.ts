import { describe, expect, it } from "vitest";

import { antwoordVanServer, mailFoutMelding } from "../smtp";

/** Foutmeldingen van de mailserver (SPEC.md 6.6): de reden erin, geen mailadressen. */
describe("foutmeldingen van de mailserver", () => {
  const geweigerd = Object.assign(new Error("Message failed: ..."), {
    code: "EMESSAGE",
    response: "554 5.7.1 <portaal@voorbeeld.nl>: Sender address rejected",
  });

  it("geeft het antwoord van de server mee, zonder mailadres", () => {
    expect(antwoordVanServer(geweigerd)).toBe("554 5.7.1 [adres] Sender address rejected");
    expect(mailFoutMelding(geweigerd)).toBe(
      'De mailserver weigert de mail zelf. Antwoord van de mailserver: "554 5.7.1 [adres] Sender address rejected".',
    );
  });

  it("noemt nooit de oorspronkelijke fouttekst", () => {
    const fout = Object.assign(new Error("geheim@voorbeeld.nl"), { code: "EAUTH" });
    expect(mailFoutMelding(fout)).not.toContain("@");
  });

  it("werkt ook zonder antwoord van de server", () => {
    expect(mailFoutMelding({ code: "EMESSAGE" })).toBe("De mailserver weigert de mail zelf.");
    expect(mailFoutMelding(new Error("x"))).toBe("De mail kon niet worden verstuurd.");
  });
});
