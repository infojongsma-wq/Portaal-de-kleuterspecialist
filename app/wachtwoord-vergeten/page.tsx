import Image from "next/image";
import Link from "next/link";

import { HerstelFormulier } from "./herstelformulier";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Wachtwoord vergeten · De Kleuterspecialist" };
export const dynamic = "force-dynamic";

export default function WachtwoordVergetenPagina() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Image src="/logo.svg" alt="" width={64} height={64} priority />
          <h1 className="text-xl font-semibold tracking-tight">
            Wachtwoord vergeten
          </h1>
          <p className="text-sm text-muted-foreground">
            Vul je e-mailadres in, dan sturen we een link om een nieuw
            wachtwoord in te stellen.
          </p>
        </div>

        <Card>
          <CardContent className="pt-5">
            <HerstelFormulier />
          </CardContent>
        </Card>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          <Link
            href="/inloggen"
            className="underline underline-offset-4 hover:text-foreground"
          >
            Terug naar inloggen
          </Link>
        </p>
      </div>
    </main>
  );
}
