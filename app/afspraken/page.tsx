import { Werkblad } from "@/components/afspraken/werkblad";
import { Hoofdnavigatie } from "@/components/hoofdnavigatie";
import {
  haalActiviteitsoorten,
  haalAfsprakenMetContext,
  haalContactpersonen,
  haalInstellingen,
  haalKlanten,
  haalNietInzetbareDagen,
  huidigeMedewerker,
} from "@/lib/data/queries";

export const metadata = {
  title: "Afspraken · De Kleuterspecialist",
};

// De gegevens komen uit een opslag die tijdens het draaien verandert, dus niet
// vooraf renderen. Zodra Supabase Auth erbij komt is de pagina hoe dan ook
// dynamisch, omdat de sessie uit een cookie wordt gelezen.
export const dynamic = "force-dynamic";

/** Hoofdscherm van de medewerker (SPEC.md 6.2). */
export default function AfsprakenPagina() {
  const medewerker = huidigeMedewerker();

  return (
    <>
      <Hoofdnavigatie medewerker={medewerker} toonBeheer />
      <main className="flex min-h-0 flex-1 flex-col">
        <Werkblad
          klanten={haalKlanten()}
          contactpersonen={haalContactpersonen()}
          activiteitsoorten={haalActiviteitsoorten()}
          instellingen={haalInstellingen()}
          afspraken={haalAfsprakenMetContext(medewerker.id)}
          nietInzetbareDagen={haalNietInzetbareDagen()}
        />
      </main>
    </>
  );
}
