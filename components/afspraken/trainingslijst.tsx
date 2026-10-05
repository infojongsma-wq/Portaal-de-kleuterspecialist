"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, ChevronDown, Plus, Undo2 } from "lucide-react";

import {
  planTrainingIn,
  voegAfgesprokenTrainingenToe,
} from "@/app/afspraken/acties";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Datumveld } from "@/components/ui/datumveld";
import { Label } from "@/components/ui/label";
import { formatteerDatum } from "@/lib/formatteer";
import type { Activiteitsoort, AfspraakMetContext } from "@/lib/data/types";
import { cn } from "@/lib/utils";

/**
 * De trainingen die met een school zijn afgesproken.
 *
 * Boven staat een uitklapmenu met de soorten die het beheer heeft ingericht;
 * je kunt er meerdere tegelijk aanvinken. Wat je toevoegt komt zonder datum in
 * de lijst als "nog in te plannen". Vul je er een datum bij in, dan wordt het
 * een gewone afspraak: hij verschijnt in de agenda en telt mee in de uren.
 */
export function Trainingslijst({
  klantId,
  klantNaam,
  trainingen,
  trainingsoorten,
  onKiesAfspraak,
  compact = false,
}: {
  klantId: string | null;
  klantNaam?: string;
  trainingen: AfspraakMetContext[];
  trainingsoorten: Activiteitsoort[];
  onKiesAfspraak?: (afspraakId: string) => void;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [gekozen, setGekozen] = React.useState<string[]>([]);
  const [bezig, setBezig] = React.useState(false);
  const [melding, setMelding] = React.useState<string | null>(null);
  const omhulsel = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function bijKlik(gebeurtenis: MouseEvent) {
      if (!omhulsel.current?.contains(gebeurtenis.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", bijKlik);
    return () => document.removeEventListener("mousedown", bijKlik);
  }, [open]);

  async function voegToe() {
    if (!klantId || gekozen.length === 0) return;
    setBezig(true);
    const resultaat = await voegAfgesprokenTrainingenToe({
      klantId,
      activiteitsoortIds: gekozen,
    });
    setBezig(false);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) {
      setGekozen([]);
      setOpen(false);
      router.refresh();
    }
  }

  async function zetDatum(afspraakId: string, datum: string | null) {
    const resultaat = await planTrainingIn(afspraakId, datum);
    setMelding(resultaat.melding ?? null);
    if (resultaat.gelukt) router.refresh();
  }

  const ingepland = trainingen.filter((training) => training.datum);
  const ongepland = trainingen.filter((training) => !training.datum);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {klantNaam
            ? `Afgesproken met ${klantNaam}`
            : "Kies eerst een school."}
        </p>

        <div ref={omhulsel} className="relative">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!klantId}
            onClick={() => setOpen((huidig) => !huidig)}
            aria-expanded={open}
            aria-haspopup="true"
          >
            <Plus aria-hidden />
            Trainingen toevoegen
            <ChevronDown aria-hidden />
          </Button>

          {open ? (
            <div className="absolute right-0 z-50 mt-1 w-72 rounded-md border bg-popover p-3 shadow-md">
              <p className="mb-2 text-xs text-muted-foreground">
                Vink aan wat je met deze school hebt afgesproken.
              </p>

              <div className="grid max-h-64 gap-2 overflow-auto">
                {trainingsoorten.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Er zijn nog geen soorten trainingen ingericht. Dat doet de
                    beheerder bij Beheer.
                  </p>
                ) : (
                  trainingsoorten.map((soort) => (
                    <div key={soort.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`soort-${soort.id}`}
                        checked={gekozen.includes(soort.id)}
                        onCheckedChange={(aan) =>
                          setGekozen((huidig) =>
                            aan === true
                              ? [...huidig, soort.id]
                              : huidig.filter((id) => id !== soort.id),
                          )
                        }
                      />
                      <Label
                        htmlFor={`soort-${soort.id}`}
                        className="flex flex-1 items-center gap-2 font-normal"
                      >
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: soort.kleur }}
                          aria-hidden
                        />
                        {soort.naam}
                      </Label>
                    </div>
                  ))
                )}
              </div>

              <Button
                type="button"
                size="sm"
                className="mt-3 w-full"
                disabled={bezig || gekozen.length === 0}
                onClick={voegToe}
              >
                {bezig
                  ? "Bezig…"
                  : gekozen.length === 1
                    ? "1 training toevoegen"
                    : `${gekozen.length} trainingen toevoegen`}
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      {trainingen.length === 0 ? (
        <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          Nog geen trainingen afgesproken met deze school.
        </p>
      ) : (
        <ul className="divide-y rounded-md border">
          {[...ongepland, ...ingepland].map((training) => (
            <li
              key={training.id}
              className={cn(
                "flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm",
                !training.datum && "bg-muted/40",
              )}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: training.activiteitsoort.kleur }}
                aria-hidden
              />

              <span className="min-w-0 flex-1">
                {onKiesAfspraak ? (
                  <button
                    type="button"
                    onClick={() => onKiesAfspraak(training.id)}
                    className="text-left hover:underline"
                  >
                    {training.titel}
                  </button>
                ) : (
                  training.titel
                )}
                <span className="block text-xs text-muted-foreground">
                  {training.activiteitsoort.naam}
                </span>
              </span>

              {training.datum ? (
                <span className="flex items-center gap-2">
                  <span className="tabular-nums">
                    {formatteerDatum(training.datum)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Datum van ${training.titel} weghalen`}
                    title="Terug naar nog in te plannen"
                    onClick={() => zetDatum(training.id, null)}
                  >
                    <Undo2 aria-hidden />
                  </Button>
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {!compact ? (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5" aria-hidden />
                      nog in te plannen
                    </span>
                  ) : null}
                  <div className="w-36">
                    <Datumveld
                      aria-label={`Datum voor ${training.titel}`}
                      waarde=""
                      onWijzig={(datum) => {
                        if (datum) zetDatum(training.id, datum);
                      }}
                    />
                  </div>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {melding ? (
        <p className="text-sm text-muted-foreground" role="status">
          {melding}
        </p>
      ) : null}
    </div>
  );
}
