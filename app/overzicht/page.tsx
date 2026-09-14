import Link from "next/link";
import { ArrowDown, ArrowUp, FileSpreadsheet } from "lucide-react";

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
import { Afdrukknop } from "@/components/afdrukknop";
import {
  haalActiviteitsoorten,
  haalKlanten,
  huidigeMedewerker,
  urenVanAfspraak,
} from "@/lib/data/queries";
import { formatteerDatum, formatteerUren } from "@/lib/formatteer";
import {
  leesFilters,
  selecteerAfspraken,
  STATUSLABELS,
  zoekreeks,
  type Sorteerveld,
} from "@/lib/export/overzicht";

export const metadata = { title: "Overzicht · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

const KOLOMMEN: Array<{ veld: Sorteerveld; label: string; rechts?: boolean }> = [
  { veld: "datum", label: "Datum" },
  { veld: "klant", label: "School" },
  { veld: "soort", label: "Soort" },
  { veld: "titel", label: "Titel" },
  { veld: "uren", label: "Uren", rechts: true },
  { veld: "status", label: "Status" },
];

/** Chronologisch overzicht met filters en sortering (SPEC.md 6.3). */
export default async function OverzichtPagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filters = leesFilters(await searchParams);
  const { vanaf, totEnMet, klantId, soortId, status, sorteer, aflopend } =
    filters;

  const medewerker = huidigeMedewerker();
  const klanten = haalKlanten();
  const soorten = haalActiviteitsoorten();
  const afspraken = selecteerAfspraken(medewerker.id, filters);

  const totaal = afspraken.reduce(
    (som, afspraak) => som + urenVanAfspraak(afspraak).totaal,
    0,
  );

  return (
    <Pagina
      titel="Overzicht"
      omschrijving={`${afspraken.length} afspraken · ${formatteerUren(totaal)} uur`}
      acties={
        <div className="flex gap-2">
          <Button variant="outline" asChild className="afdruk-verbergen">
            <a href={`/overzicht/excel?${zoekreeks(filters)}`}>
              <FileSpreadsheet aria-hidden />
              Excel
            </a>
          </Button>
          <Afdrukknop />
        </div>
      }
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
                    href={`/overzicht?${zoekreeks(filters, { sorteer: kolom.veld, aflopend: kolom.veld === sorteer && !aflopend })}`}
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
      <p className="mt-2 text-xs text-muted-foreground afdruk-verbergen">
        De Excel-export en de PDF volgen precies de filters en de sortering die
        hierboven staan ingesteld.
      </p>
    </Pagina>
  );
}

