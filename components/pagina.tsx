import { Hoofdnavigatie } from "@/components/hoofdnavigatie";
import { huidigeMedewerker } from "@/lib/data/queries";

/** Vaste schil om elk scherm heen: knoppenbalk boven, inhoud eronder. */
export function Pagina({
  titel,
  omschrijving,
  acties,
  children,
}: {
  titel: string;
  omschrijving?: string;
  acties?: React.ReactNode;
  children: React.ReactNode;
}) {
  const medewerker = huidigeMedewerker();

  return (
    <>
      <Hoofdnavigatie medewerker={medewerker} toonBeheer />
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-6">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
            {omschrijving ? (
              <p className="mt-1 text-sm text-muted-foreground">
                {omschrijving}
              </p>
            ) : null}
          </div>
          {acties}
        </div>
        {children}
      </main>
    </>
  );
}

/** Native keuzelijst voor filterformulieren die zonder JavaScript werken. */
export function Keuzelijst({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={[
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className ?? "",
      ].join(" ")}
      {...props}
    />
  );
}
