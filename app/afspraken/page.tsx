import { Werkblad } from "@/components/afspraken/werkblad";
import { Hoofdnavigatie } from "@/components/hoofdnavigatie";
import {
  haalAfsprakenMetContext,
  haalContactpersonen,
  haalKlanten,
  haalNietInzetbareDagen,
  haalTrainingsoorten,
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
export default async function AfsprakenPagina() {
  const medewerker = await huidigeMedewerker();

  return (
    <>
      <Hoofdnavigatie
        medewerker={medewerker}
        toonBeheer={medewerker.rol === "beheerder"}
      />
      <main className="flex min-h-0 flex-1 flex-col">
        <Werkblad
          klanten={await haalKlanten()}
          contactpersonen={await haalContactpersonen()}
          trainingsoorten={await haalTrainingsoorten()}
          afspraken={await haalAfsprakenMetContext(medewerker.id)}
          nietInzetbareDagen={await haalNietInzetbareDagen()}
        />
      </main>
    </>
  );
}
