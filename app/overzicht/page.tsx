import Link from "next/link";
import { ArrowDown, ArrowUp } from "lucide-react";

import { Keuzelijst, Pagina } from "@/components/pagina";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Datumfilter } from "@/components/ui/datumfilter";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  haalActiviteitsoorten,
  haalAfsprakenMetContext,
  haalKlanten,
  huidigeMedewerker,
  urenVanAfspraak,
} from "@/lib/data/queries";
import { formatteerDatum, formatteerUren } from "@/lib/formatteer";
import type { AfspraakMetContext } from "@/lib/data/types";
import type { AfspraakStatus } from "@/lib/uren";

export const metadata = { title: "Overzicht · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

const STATUSLABELS: Record<AfspraakStatus, string> = {
  gepland: "Gepland",
  voltooid: "Voltooid",
  geannuleerd: "Geannuleerd",
  verzet: "Verzet",
};

type Sorteerveld = "datum" | "klant" | "soort" | "titel" | "uren" | "status";

const KOLOMMEN: Array<{ veld: Sorteerveld; label: string; rechts?: boolean }> = [
  { veld: "datum", label: "Datum" },
  { veld: "klant", label: "School" },
  { veld: "soort", label: "Soort" },
  { veld: "titel", label: "Titel" },
  { veld: "uren", label: "Uren", rechts: true },
  { veld: "status", label: "Status" },
];

function tekst(waarde: string | string[] | undefined): string {
  return Array.isArray(waarde) ? (waarde[0] ?? "") : (waarde ?? "");
}

/** Chronologisch overzicht met filters en sortering (SPEC.md 6.3). */
export default async function OverzichtPagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = await searchParams;
  const vanaf = tekst(filters.vanaf);
  const totEnMet = tekst(filters.tot);
  const klantId = tekst(filters.klant);
  const soortId = tekst(filters.soort);
  const status = tekst(filters.status);
  const sorteer = (tekst(filters.sorteer) || "datum") as Sorteerveld;
  const aflopend = tekst(filters.richting) === "af";

  const medewerker = huidigeMedewerker();
  const klanten = haalKlanten();
  const soorten = haalActiviteitsoorten();

  const afspraken = haalAfsprakenMetContext(medewerker.id)
    // Een afspraak zonder datum valt buiten elke periode; is er geen
    // periodefilter, dan hoort hij er wel gewoon bij te staan.
    .filter((afspraak) => !vanaf || (afspraak.datum ?? "") >= vanaf)
    .filter((afspraak) => !totEnMet || (!!afspraak.datum && afspraak.datum <= totEnMet))
    .filter((afspraak) => !klantId || afspraak.klantId === klantId)
    .filter((afspraak) => !soortId || afspraak.activiteitsoortId === soortId)
    .filter((afspraak) => !status || afspraak.status === status)
    .sort(vergelijker(sorteer, aflopend));

  const totaal = afspraken.reduce(
    (som, afspraak) => som + urenVanAfspraak(afspraak).totaal,
    0,
  );

  return (
    <Pagina
      titel="Overzicht"
      omschrijving={`${afspraken.length} afspraken · ${formatteerUren(totaal)} uur`}
    >
      <Card className="mb-5 p-4">
        <form method="get" className="flex flex-wrap items-end gap-3">
          <div className="grid w-36 gap-1.5">
            <Label htmlFor="vanaf">Vanaf</Label>
            <Datumfilter id="vanaf" name="vanaf" beginwaarde={vanaf} />
          </div>
          <div className="grid w-36 gap-1.5">
            <Label htmlFor="tot">Tot en met</Label>
            <Datumfilter id="tot" name="tot" beginwaarde={totEnMet} />
          </div>
          <div className="grid min-w-52 gap-1.5">
            <Label htmlFor="klant">School</Label>
            <Keuzelijst id="klant" name="klant" defaultValue={klantId}>
              <option value="">Alle scholen</option>
              {klanten.map((klant) => (
                <option key={klant.id} value={klant.id}>
                  {klant.naam} — {klant.plaats}
                </option>
              ))}
            </Keuzelijst>
          </div>
          <div className="grid min-w-40 gap-1.5">
            <Label htmlFor="soort">Soort</Label>
            <Keuzelijst id="soort" name="soort" defaultValue={soortId}>
              <option value="">Alle soorten</option>
              {soorten.map((soort) => (
                <option key={soort.id} value={soort.id}>
                  {soort.naam}
                </option>
              ))}
            </Keuzelijst>
          </div>
          <div className="grid min-w-40 gap-1.5">
            <Label htmlFor="status">Status</Label>
            <Keuzelijst id="status" name="status" defaultValue={status}>
              <option value="">Alle statussen</option>
              {Object.entries(STATUSLABELS).map(([waarde, label]) => (
                <option key={waarde} value={waarde}>
                  {label}
                </option>
              ))}
            </Keuzelijst>
          </div>
          <input type="hidden" name="sorteer" value={sorteer} />
          <input type="hidden" name="richting" value={aflopend ? "af" : "op"} />
          <Button type="submit">Filteren</Button>
          <Button type="button" variant="ghost" asChild>
            <Link href="/overzicht">Wissen</Link>
          </Button>
        </form>
      </Card>

      <Card className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              {KOLOMMEN.map((kolom) => (
                <TableHead key={kolom.veld} className={kolom.rechts ? "text-right" : undefined}>
                  <Link
                    href={`/overzicht?${nieuweZoekreeks(filters, kolom.veld, sorteer, aflopend)}`}
                    className="inline-flex items-center gap-1 hover:text-foreground"
                  >
                    {kolom.label}
                    {sorteer === kolom.veld ? (
                      aflopend ? (
                        <ArrowDown className="size-3" aria-label="aflopend" />
                      ) : (
                        <ArrowUp className="size-3" aria-label="oplopend" />
                      )
                    ) : null}
                  </Link>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {afspraken.length === 0 ? (
              <TableRow>
                <TableCell colSpan={KOLOMMEN.length} className="py-10 text-center text-muted-foreground">
                  Geen afspraken gevonden met deze filters.
                </TableCell>
              </TableRow>
            ) : (
              afspraken.map((afspraak) => {
                const uren = urenVanAfspraak(afspraak);
                return (
                  <TableRow key={afspraak.id}>
                    <TableCell className="whitespace-nowrap tabular-nums">
                      {afspraak.datum ? (
                        formatteerDatum(afspraak.datum)
                      ) : (
                        <span className="text-muted-foreground">
                          Nog in te plannen
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium">{afspraak.klant.naam}</span>
                      <span className="text-muted-foreground">
                        {" "}
                        · {afspraak.klant.plaats}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: afspraak.activiteitsoort.kleur }}
                          aria-hidden
                        />
                        {afspraak.activiteitsoort.naam}
                      </span>
                    </TableCell>
                    <TableCell>{afspraak.titel}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatteerUren(uren.totaal)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          afspraak.status === "voltooid"
                            ? "default"
                            : afspraak.status === "gepland"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {STATUSLABELS[afspraak.status]}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      <p className="mt-4 text-xs text-muted-foreground">
        De reistijd in de kolom Uren is de declarabele reistijd van die afspraak.
        Staan er meerdere afspraken op één dag, dan geldt de reistijd van de
        verste bestemming één keer per dag — kijk voor het dagtotaal bij Mijn
        uren.
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Exporteren naar Excel en PDF hoort bij fase 4 en zit nog niet in dit
        prototype.
      </p>
    </Pagina>
  );
}

function vergelijker(veld: Sorteerveld, aflopend: boolean) {
  const richting = aflopend ? -1 : 1;
  return (a: AfspraakMetContext, b: AfspraakMetContext) => {
    const uitkomst = (() => {
      switch (veld) {
        case "klant":
          return a.klant.naam.localeCompare(b.klant.naam, "nl");
        case "soort":
          return a.activiteitsoort.naam.localeCompare(
            b.activiteitsoort.naam,
            "nl",
          );
        case "titel":
          return a.titel.localeCompare(b.titel, "nl");
        case "uren":
          return urenVanAfspraak(a).totaal - urenVanAfspraak(b).totaal;
        case "status":
          return a.status.localeCompare(b.status, "nl");
        default:
          // Afspraken zonder datum achteraan.
          if (!a.datum) return b.datum ? 1 : 0;
          if (!b.datum) return -1;
          return a.datum.localeCompare(b.datum);
      }
    })();
    return uitkomst * richting;
  };
}

function nieuweZoekreeks(
  filters: Record<string, string | string[] | undefined>,
  veld: Sorteerveld,
  huidigVeld: Sorteerveld,
  huidigAflopend: boolean,
): string {
  const reeks = new URLSearchParams();
  for (const [sleutel, waarde] of Object.entries(filters)) {
    const enkel = tekst(waarde);
    if (enkel && sleutel !== "sorteer" && sleutel !== "richting") {
      reeks.set(sleutel, enkel);
    }
  }
  reeks.set("sorteer", veld);
  // Nog een keer op dezelfde kolom klikt de richting om.
  reeks.set("richting", veld === huidigVeld && !huidigAflopend ? "af" : "op");
  return reeks.toString();
}
