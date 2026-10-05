import { describe, expect, it } from "vitest";

import {
  eerderGebruiktePlaatsen,
  isThuis,
  leesGoogleAfstand,
  leesPdokSuggesties,
  onthoudenAfstand,
  routeAdres,
  schoolLabel,
  zelfdeRoutepunt,
  type Adresboek,
  type EerdereRit,
} from "../plaatsen";

/** Verzonnen adressen, zoals in de ontwikkelomgeving afgesproken (CLAUDE.md). */
const BOEK: Adresboek = {
  thuis: { adres: "Voorbeeldstraat 1", postcode: "1234 AB", plaats: "Proefdorp" },
  scholen: [
    {
      naam: "De Proeftuin",
      adres: "Schoolweg 5",
      postcode: "5678 CD",
      plaats: "Hengelo",
    },
    { naam: "Het Testlab", adres: null, postcode: null, plaats: "Zwolle" },
  ],
};

/** Verzonnen ritten; plaatsnamen zijn openbaar, er staan geen adressen in. */
function rit(velden: Partial<EerdereRit>): EerdereRit {
  return {
    datum: "2026-10-01",
    aangemaaktOp: "2026-10-01T08:00:00Z",
    vanPlaats: "Thuis",
    naarPlaats: "Hengelo",
    kmEnkel: 10.4,
    ...velden,
  };
}

describe("routeadres", () => {
  it("gebruikt voor Thuis het volledige thuisadres, zonder naam", () => {
    // Op verzoek van de opdrachtgever (SPEC.md 5.7): van deur tot deur.
    expect(routeAdres("Thuis", BOEK)).toBe("Voorbeeldstraat 1, 1234 AB Proefdorp");
    expect(routeAdres("thuis ", BOEK)).toBe("Voorbeeldstraat 1, 1234 AB Proefdorp");
  });

  it("gebruikt de woonplaats als straat en postcode ontbreken", () => {
    const boek = { ...BOEK, thuis: { adres: null, postcode: null, plaats: "Proefdorp" } };
    expect(routeAdres("Thuis", boek)).toBe("Proefdorp");
  });

  it("weet niets zolang er geen woonplaats is ingesteld", () => {
    expect(routeAdres("Thuis", { ...BOEK, thuis: null })).toBeNull();
    expect(
      routeAdres("Thuis", { ...BOEK, thuis: { adres: "Voorbeeldstraat 1", postcode: null, plaats: " " } }),
    ).toBeNull();
  });

  it("gebruikt voor een school uit Klanten het adres van de school", () => {
    expect(routeAdres("De Proeftuin, Schoolweg 5, 5678 CD Hengelo", BOEK)).toBe(
      "Schoolweg 5, 5678 CD Hengelo",
    );
    expect(routeAdres("Het Testlab, Zwolle", BOEK)).toBe("Zwolle");
  });

  it("geeft een getypt adres ongewijzigd door", () => {
    expect(routeAdres("Kerkplein 2, 4321 EF Almelo", BOEK)).toBe(
      "Kerkplein 2, 4321 EF Almelo",
    );
  });

  it("maakt van de toevoeging tussen haakjes een deel van het adres", () => {
    expect(routeAdres("Hengelo (Gelderland)", BOEK)).toBe("Hengelo, Gelderland");
  });

  it("geeft een gewone plaatsnaam ongewijzigd door", () => {
    expect(routeAdres(" Zwolle ", BOEK)).toBe("Zwolle");
  });

  it("herkent dat van en naar op hetzelfde punt liggen", () => {
    expect(zelfdeRoutepunt("Zwolle", "zwolle", BOEK)).toBe(true);
    expect(zelfdeRoutepunt("Het Testlab, Zwolle", "Zwolle", BOEK)).toBe(true);
    // Thuis is een adres, geen woonplaats: binnen dezelfde plaats valt er wél
    // iets uit te rekenen.
    expect(zelfdeRoutepunt("Thuis", "Proefdorp", BOEK)).toBe(false);
  });

  it("herkent Thuis ongeacht hoofdletters", () => {
    expect(isThuis("THUIS")).toBe(true);
    expect(isThuis("Thuisbasis")).toBe(false);
  });
});

describe("onthouden afstand", () => {
  it("vindt een eerdere rit over dezelfde route", () => {
    const ritten = [rit({ kmEnkel: 10.4 })];
    expect(onthoudenAfstand(ritten, "Thuis", "Hengelo")?.kmEnkel).toBe(10.4);
  });

  it("vindt ook de omgekeerde richting", () => {
    const ritten = [rit({ kmEnkel: 10.4 })];
    expect(onthoudenAfstand(ritten, "Hengelo", "Thuis")?.kmEnkel).toBe(10.4);
  });

  it("let niet op hoofdletters of spaties", () => {
    const ritten = [rit({ naarPlaats: "Hengelo" })];
    expect(onthoudenAfstand(ritten, "thuis", " hengelo ")).not.toBeNull();
  });

  it("neemt de meest recente rit, zodat een verbetering blijft hangen", () => {
    const ritten = [
      rit({ datum: "2026-09-01", kmEnkel: 9.8 }),
      rit({ datum: "2026-10-03", kmEnkel: 11.2 }),
      rit({ datum: "2026-09-15", kmEnkel: 10.4 }),
    ];
    expect(onthoudenAfstand(ritten, "Thuis", "Hengelo")?.kmEnkel).toBe(11.2);
  });

  it("kiest bij dezelfde datum de laatst ingevoerde", () => {
    const ritten = [
      rit({ aangemaaktOp: "2026-10-01T08:00:00Z", kmEnkel: 9.8 }),
      rit({ aangemaaktOp: "2026-10-01T09:30:00Z", kmEnkel: 10.9 }),
    ];
    expect(onthoudenAfstand(ritten, "Thuis", "Hengelo")?.kmEnkel).toBe(10.9);
  });

  it("geeft niets voor een route die nog nooit is gereden", () => {
    expect(onthoudenAfstand([rit({})], "Thuis", "Zwolle")).toBeNull();
  });
});

describe("eerder gebruikte plaatsen", () => {
  it("zet de vaakst gebruikte plaats bovenaan en laat Thuis weg", () => {
    const ritten = [
      { vanPlaats: "Thuis", naarPlaats: "Hengelo" },
      { vanPlaats: "Thuis", naarPlaats: "Zwolle" },
      { vanPlaats: "Hengelo", naarPlaats: "Thuis" },
    ];
    expect(eerderGebruiktePlaatsen(ritten)).toEqual(["Hengelo", "Zwolle"]);
  });

  it("telt dezelfde plaats met andere hoofdletters als één plaats", () => {
    const ritten = [
      { vanPlaats: "Thuis", naarPlaats: "Almelo" },
      { vanPlaats: "Thuis", naarPlaats: "almelo" },
    ];
    expect(eerderGebruiktePlaatsen(ritten)).toEqual(["Almelo"]);
  });

  it("zet plaatsen die even vaak voorkomen op alfabet", () => {
    const ritten = [
      { vanPlaats: "Zwolle", naarPlaats: "Almelo" },
      { vanPlaats: "Deventer", naarPlaats: "Thuis" },
    ];
    expect(eerderGebruiktePlaatsen(ritten)).toEqual([
      "Almelo",
      "Deventer",
      "Zwolle",
    ]);
  });
});

describe("school in een rit", () => {
  it("zet naam en adres samen", () => {
    expect(schoolLabel(BOEK.scholen[0])).toBe("De Proeftuin, Schoolweg 5, 5678 CD Hengelo");
  });

  it("zet alleen de plaats erbij als het adres ontbreekt", () => {
    expect(schoolLabel(BOEK.scholen[1])).toBe("Het Testlab, Zwolle");
  });
});

describe("antwoord van PDOK lezen", () => {
  it("geeft een unieke plaats zonder toevoeging", () => {
    const antwoord = {
      response: {
        docs: [{ type: "woonplaats", weergavenaam: "Zwolle, Zwolle, Overijssel" }],
      },
    };
    expect(leesPdokSuggesties(antwoord)).toEqual([
      {
        label: "Zwolle",
        plaats: "Zwolle",
        gemeente: "Zwolle",
        provincie: "Overijssel",
        soort: "woonplaats",
      },
    ]);
  });

  it("zet de provincie erbij als dezelfde naam vaker voorkomt", () => {
    const antwoord = {
      response: {
        docs: [
          { weergavenaam: "Hengelo, Hengelo, Overijssel" },
          { weergavenaam: "Hengelo, Bronckhorst, Gelderland" },
        ],
      },
    };
    expect(leesPdokSuggesties(antwoord).map((s) => s.label)).toEqual([
      "Hengelo (Overijssel)",
      "Hengelo (Gelderland)",
    ]);
  });

  it("zet de gemeente erbij als de naamgenoten in dezelfde provincie liggen", () => {
    const antwoord = {
      response: {
        docs: [
          { weergavenaam: "Den Hoorn, Midden-Delfland, Zuid-Holland" },
          { weergavenaam: "Den Hoorn, Hollands Kroon, Noord-Holland" },
          { weergavenaam: "Den Hoorn, Texel, Noord-Holland" },
        ],
      },
    };
    expect(leesPdokSuggesties(antwoord).map((s) => s.label)).toEqual([
      "Den Hoorn (Zuid-Holland)",
      "Den Hoorn (Hollands Kroon)",
      "Den Hoorn (Texel)",
    ]);
  });

  it("leest adressen, met een spatie in de postcode, vóór de woonplaatsen", () => {
    const antwoord = {
      response: {
        docs: [
          { type: "woonplaats", weergavenaam: "Hengelo, Hengelo, Overijssel" },
          { type: "adres", weergavenaam: "Schoolweg 5, 5678CD Hengelo" },
        ],
      },
    };
    const suggesties = leesPdokSuggesties(antwoord);
    expect(suggesties.map((s) => [s.label, s.soort])).toEqual([
      ["Schoolweg 5, 5678 CD Hengelo", "adres"],
      ["Hengelo", "woonplaats"],
    ]);
  });

  it("geeft een lege lijst bij een onverwacht antwoord", () => {
    expect(leesPdokSuggesties(null)).toEqual([]);
    expect(leesPdokSuggesties({ fout: "storing" })).toEqual([]);
    expect(leesPdokSuggesties({ response: { docs: [{ id: 1 }] } })).toEqual([]);
  });
});

describe("antwoord van Google lezen", () => {
  it("leest de afstand in meters", () => {
    expect(leesGoogleAfstand({ routes: [{ distanceMeters: 10_437 }] })).toBe(
      10_437,
    );
  });

  it("leest een route zonder afstand als 0 meter", () => {
    // Google laat nulwaarden weg uit het antwoord.
    expect(leesGoogleAfstand({ routes: [{ duration: "0s" }] })).toBe(0);
  });

  it("geeft null als er geen route is", () => {
    expect(leesGoogleAfstand({})).toBeNull();
    expect(leesGoogleAfstand({ routes: [] })).toBeNull();
    expect(leesGoogleAfstand(null)).toBeNull();
  });

  it("geeft null bij een onzinnige afstand", () => {
    expect(leesGoogleAfstand({ routes: [{ distanceMeters: "ver" }] })).toBeNull();
    expect(leesGoogleAfstand({ routes: [{ distanceMeters: -5 }] })).toBeNull();
  });
});
