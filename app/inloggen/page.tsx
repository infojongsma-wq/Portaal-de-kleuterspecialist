import Image from "next/image";
import Link from "next/link";

import { Inlogformulier } from "./inlogformulier";
import { Card, CardContent } from "@/components/ui/card";
import { leesSupabaseOmgeving } from "@/lib/supabase/omgeving";

export const metadata = { title: "Inloggen · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

function tekst(waarde: string | string[] | undefined): string {
  return Array.isArray(waarde) ? (waarde[0] ?? "") : (waarde ?? "");
}

/** Inlogscherm (SPEC.md 6.1). */
export default async function InloggenPagina({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const verder = tekst((await searchParams).verder);
  const ingesteld = leesSupabaseOmgeving() !== null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.svg" alt="" width={64} height={64} priority />
          <h1 className="text-xl font-semibold tracking-tight">
            De Kleuterspecialist
          </h1>
          <p className="text-sm text-muted-foreground">
            Urenregistratie en planning
          </p>
        </div>

        <Card>
          <CardContent className="pt-5">
            {ingesteld ? (
              <Inlogformulier verder={verder} />
            ) : (
              <div className="grid gap-2 text-sm">
                <p className="font-medium">Nog niet ingesteld</p>
                <p className="text-muted-foreground">
                  Er is nog geen database gekoppeld, dus inloggen kan nog niet.
                  De stappen daarvoor staan in <code>PUBLICEREN.md</code>.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {ingesteld ? (
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link
              href="/wachtwoord-vergeten"
              className="underline underline-offset-4 hover:text-foreground"
            >
              Wachtwoord vergeten?
            </Link>
          </p>
        ) : null}

        {/* Merkband, als rustige afsluiting onderaan. */}
        <div className="mt-10 flex h-1 overflow-hidden rounded-full" aria-hidden>
          <span className="flex-1 bg-merk-turquoise" />
          <span className="flex-1 bg-merk-hardgroen" />
          <span className="flex-1 bg-merk-felgroen" />
          <span className="flex-1 bg-merk-lichtgroen" />
          <span className="flex-1 bg-merk-donkergroen" />
        </div>
      </div>
    </main>
  );
}
