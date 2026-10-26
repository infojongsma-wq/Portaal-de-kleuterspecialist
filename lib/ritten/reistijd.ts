import type { Rit } from "@/lib/data/types";
import type { RitReistijdInvoer } from "@/lib/uren";

/**
 * Van een rit naar de velden die de reistijdberekening nodig heeft (SPEC.md
 * 5.2). Los van `lib/data/ritten.ts`, zodat ook het scherm in de browser hem
 * kan gebruiken.
 */
export function naarRitReistijdInvoer(rit: Rit): RitReistijdInvoer {
  return {
    datum: rit.datum,
    heenEnTerug: rit.heenEnTerug,
    reisduurEnkelMinuten: rit.reisduurEnkelMinuten,
    afwijkendeReistijdMinuten: rit.afwijkendeReistijdMinuten,
  };
}
