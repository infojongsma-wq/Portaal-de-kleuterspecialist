import Image from "next/image";

import { Wachtwoordformulier } from "./wachtwoordformulier";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Wachtwoord instellen · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

/**
 * Waar een uitnodiging en een herstellink op uitkomen (SPEC.md 6.1).
 *
 * Openbaar bereikbaar, want wie hier langskomt heeft per definitie nog geen
 * wachtwoord. Wat iemand hier kan, hangt volledig af van de sessie die in de
 * link zat: zonder geldige link valt er niets in te stellen.
 */
export default function InstellenPagina() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.svg" alt="" width={64} height={64} priority />
          <h1 className="text-xl font-semibold tracking-tight">
            Wachtwoord instellen
          </h1>
          <p className="text-sm text-muted-foreground">
            Kies een wachtwoord, dan kun je meteen naar het portaal.
          </p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <Wachtwoordformulier />
          </CardContent>
        </Card>

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
