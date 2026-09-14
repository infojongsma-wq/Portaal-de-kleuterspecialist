"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";
import type { Profiel } from "@/lib/data/types";

const ONDERDELEN = [
  { pad: "/afspraken", label: "Afspraken" },
  { pad: "/overzicht", label: "Overzicht" },
  { pad: "/klanten", label: "Klanten" },
  { pad: "/mijn-uren", label: "Mijn uren" },
] as const;

/** Knoppenbalk boven in het scherm (SPEC.md 6.2). */
export function Hoofdnavigatie({
  medewerker,
  toonBeheer,
}: {
  medewerker: Profiel;
  toonBeheer: boolean;
}) {
  const pad = usePathname();

  const onderdelen = toonBeheer
    ? [...ONDERDELEN, { pad: "/beheer", label: "Beheer" } as const]
    : ONDERDELEN;

  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      {/* Merkband: de vijf kleuren uit de huisstijl, als dun accent. */}
      <div className="flex h-1" aria-hidden>
        <span className="flex-1 bg-merk-turquoise" />
        <span className="flex-1 bg-merk-hardgroen" />
        <span className="flex-1 bg-merk-felgroen" />
        <span className="flex-1 bg-merk-lichtgroen" />
        <span className="flex-1 bg-merk-donkergroen" />
      </div>

      <div className="flex h-14 items-center gap-6 px-6">
        <Link
          href="/afspraken"
          className="flex items-center gap-2.5 font-semibold tracking-tight"
        >
          <Image
            src="/logo.svg"
            alt=""
            width={30}
            height={30}
            priority
            className="size-[30px]"
          />
          De Kleuterspecialist
        </Link>

        <nav className="flex items-center gap-1" aria-label="Hoofdmenu">
          {onderdelen.map((onderdeel) => {
            const actief = pad === onderdeel.pad || pad.startsWith(`${onderdeel.pad}/`);
            return (
              <Link
                key={onderdeel.pad}
                href={onderdeel.pad}
                aria-current={actief ? "page" : undefined}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  actief
                    ? "bg-secondary text-secondary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
              >
                {onderdeel.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3 text-sm text-muted-foreground">
          <span>
            {medewerker.voornaam} {medewerker.achternaam}
          </span>
          <span className="rounded-md border px-2 py-0.5 text-xs capitalize">
            {medewerker.rol}
          </span>
        </div>
      </div>
    </header>
  );
}
