"use client";

import { useRouter } from "next/navigation";

import { Keuzelijst } from "@/components/ui/keuzelijst";
import { Label } from "@/components/ui/label";

/**
 * Voor de beheerder: van wie zijn de ritten die je ziet en exporteert
 * (SPEC.md 6.7). Een medewerker ziet deze keuzelijst niet.
 */
export function MedewerkerKiezer({
  medewerkers,
  gekozenId,
  eigenId,
  maand,
}: {
  medewerkers: { id: string; naam: string }[];
  gekozenId: string;
  eigenId: string;
  maand: string;
}) {
  const router = useRouter();

  return (
    <div className="afdruk-verbergen flex items-center gap-2">
      <Label htmlFor="ritten-van" className="whitespace-nowrap">
        Ritten van
      </Label>
      <Keuzelijst
        id="ritten-van"
        value={gekozenId}
        className="h-10 min-w-56"
        onChange={(gebeurtenis) => {
          const parameters = new URLSearchParams({ maand });
          if (gebeurtenis.target.value !== eigenId) {
            parameters.set("medewerker", gebeurtenis.target.value);
          }
          router.push(`/ritten?${parameters.toString()}`);
        }}
      >
        {medewerkers.map((medewerker) => (
          <option key={medewerker.id} value={medewerker.id}>
            {medewerker.id === eigenId ? `${medewerker.naam} (ik)` : medewerker.naam}
          </option>
        ))}
      </Keuzelijst>
    </div>
  );
}
