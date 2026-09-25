import { formatteerUren } from "@/lib/formatteer";
import { cn } from "@/lib/utils";

/**
 * Voortgang richting de jaarnorm, over het hele jaar.
 *
 * Bewust zónder markering voor "waar je vandaag hoort te staan": de uren
 * worden niet gelijkmatig over het jaar gemaakt — de ene week meer dan de
 * andere — en aan het eind van het jaar telt alleen het totaal.
 */
export function Voortgangsbalk({
  gerealiseerd,
  norm,
}: {
  gerealiseerd: number;
  norm: number;
}) {
  const schaal = Math.max(norm, gerealiseerd, 1);
  const deelGerealiseerd = Math.min(100, (gerealiseerd / schaal) * 100);
  const eroverheen = gerealiseerd > norm;
  const percentage = norm > 0 ? Math.round((gerealiseerd / norm) * 100) : 0;

  return (
    <div className="grid gap-2">
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            eroverheen ? "bg-amber-500" : "bg-merk-felgroen",
          )}
          style={{ width: `${deelGerealiseerd}%` }}
        />
      </div>

      <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span
            className={cn(
              "mr-1.5 inline-block size-2 rounded-full align-middle",
              eroverheen ? "bg-amber-500" : "bg-merk-felgroen",
            )}
            aria-hidden
          />
          Gerealiseerd {formatteerUren(gerealiseerd)} uur
        </span>
        <span>{percentage}% van de norm</span>
        <span>Jaarnorm {formatteerUren(norm)} uur</span>
      </div>
    </div>
  );
}
