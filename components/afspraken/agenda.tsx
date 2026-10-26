"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import type { EventClickArg, EventInput } from "@fullcalendar/core";
import nlLocale from "@fullcalendar/core/locales/nl";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import timeGridPlugin from "@fullcalendar/timegrid";

import { naarIsoDatum } from "@/lib/formatteer";
import type { AfspraakMetContext, NietInzetbareDag } from "@/lib/data/types";

// FullCalendar meet het venster op bij het opbouwen en kan daarom niet op de
// server worden gerenderd.
const FullCalendar = dynamic(() => import("@fullcalendar/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Agenda wordt geladen…
    </div>
  ),
});

/**
 * Permanente agenda naast het afspraakformulier (SPEC.md 6.2).
 * Kleuren per activiteitsoort, schoolvakanties met een grijze achtergrond,
 * klikken op een afspraak laadt deze in het formulier.
 *
 * De agenda van de medewerkers in Beheer (SPEC.md 6.6) gebruikt hem ook, met
 * een kleur en een titel per medewerker en zonder klikken op een datum.
 */
export function Agenda({
  afspraken,
  nietInzetbareDagen,
  geselecteerdeAfspraakId,
  onKiesAfspraak,
  onKiesDatum,
  kleurVan = standaardKleur,
  titelVan = standaardTitel,
}: {
  afspraken: AfspraakMetContext[];
  nietInzetbareDagen: NietInzetbareDag[];
  geselecteerdeAfspraakId: string | null;
  onKiesAfspraak: (afspraakId: string) => void;
  /** Zonder deze functie gebeurt er niets bij klikken op een lege dag. */
  onKiesDatum?: (datum: string) => void;
  kleurVan?: (afspraak: AfspraakMetContext) => string;
  titelVan?: (afspraak: AfspraakMetContext) => string;
}) {
  const nietInzetbaar = React.useMemo(
    () => new Map(nietInzetbareDagen.map((dag) => [dag.datum, dag])),
    [nietInzetbareDagen],
  );

  const gebeurtenissen = React.useMemo<EventInput[]>(
    () =>
      afspraken.flatMap((afspraak) => {
        // Een training die nog ingepland moet worden hoort niet in de agenda;
        // die staat in de lijst per school.
        if (!afspraak.datum) return [];

        const heeftTijd = Boolean(afspraak.starttijd);
        const geselecteerd = afspraak.id === geselecteerdeAfspraakId;
        const vervallen =
          afspraak.status === "geannuleerd" || afspraak.status === "verzet";

        const kleur = kleurVan(afspraak);

        return [
          {
            id: afspraak.id,
            title: titelVan(afspraak),
            start: heeftTijd
              ? `${afspraak.datum}T${afspraak.starttijd}`
              : afspraak.datum,
            end:
              heeftTijd && afspraak.eindtijd
                ? `${afspraak.datum}T${afspraak.eindtijd}`
                : undefined,
            allDay: !heeftTijd,
            backgroundColor: kleur,
            borderColor: geselecteerd ? "#111827" : kleur,
            textColor: "#ffffff",
            classNames: [
              vervallen ? "line-through opacity-60" : "",
              geselecteerd ? "ring-2 ring-offset-1 ring-foreground" : "",
            ].filter(Boolean),
          },
        ];
      }),
    [afspraken, geselecteerdeAfspraakId, kleurVan, titelVan],
  );

  return (
    <div className="h-full">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
        initialView="dayGridMonth"
        locale={nlLocale}
        firstDay={1}
        height="100%"
        headerToolbar={{
          left: "prev,next today",
          center: "title",
          right: "dayGridMonth,timeGridWeek,timeGridDay",
        }}
        buttonText={{
          today: "Vandaag",
          month: "Maand",
          week: "Week",
          day: "Dag",
        }}
        weekNumbers
        weekNumberFormat={{ week: "numeric" }}
        weekends={false}
        slotMinTime="07:00:00"
        slotMaxTime="20:00:00"
        nowIndicator
        events={gebeurtenissen}
        eventClick={(gebeurtenis: EventClickArg) => {
          gebeurtenis.jsEvent.preventDefault();
          onKiesAfspraak(gebeurtenis.event.id);
        }}
        dateClick={
          onKiesDatum
            ? (gebeurtenis) => onKiesDatum(gebeurtenis.dateStr.slice(0, 10))
            : undefined
        }
        // Schoolvakanties en feestdagen een grijze achtergrond (SPEC.md 6.2).
        // Via een klasse en niet via achtergrondgebeurtenissen, want die zetten
        // hun omschrijving in elke cel.
        dayCellClassNames={(argument) =>
          nietInzetbaar.has(naarIsoDatum(argument.date))
            ? ["dag-niet-inzetbaar"]
            : []
        }
        dayCellDidMount={(argument) => {
          const dag = nietInzetbaar.get(naarIsoDatum(argument.date));
          if (dag) argument.el.title = dag.omschrijving;
        }}
        eventTimeFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
        slotLabelFormat={{
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }}
      />
    </div>
  );
}

// Buiten de component, zodat het steeds dezelfde functie is en de lijst met
// afspraken niet bij elke weergave opnieuw wordt opgebouwd.
function standaardKleur(afspraak: AfspraakMetContext): string {
  return afspraak.activiteitsoort.kleur;
}

function standaardTitel(afspraak: AfspraakMetContext): string {
  return afspraak.klant
    ? `${afspraak.klant.naam} — ${afspraak.titel}`
    : afspraak.titel;
}
