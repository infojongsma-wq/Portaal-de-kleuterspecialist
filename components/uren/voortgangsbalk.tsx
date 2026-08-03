import { formatteerUren } from "@/lib/formatteer";
import { cn } from "@/lib/utils";

/**
 * Voortgang richting de jaarnorm. De normlijn markeert waar je op de peildatum
 * hoort te staan; die staat stil tijdens schoolvakanties (SPEC.md 5.4).
 */
export function Voortgangsbalk({
  gerealiseerd,
  verwacht,
  norm,
}: {
  gerealiseerd: number;
  verwacht: number;
  norm: number;
}) {
  const schaal = Math.max(norm, gerealiseerd, verwacht, 1);
  const deelGerealiseerd = Math.min(100, (gerealiseerd / schaal) * 100);
  const deelVerwacht = Math.min(100, (verwacht / schaal) * 100);
  const voorloopt = gerealiseerd >= verwacht;

  return (
    <div className="grid gap-2">
      <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            voorloopt ? "bg-emerald-500" : "bg-amber-500",
          )}
          style={{ width: `${deelGerealiseerd}%` }}
        />
        <div
          className="absolute inset-y-0 w-0.5 bg-foreground"
          style={{ left: `${deelVerwacht}%` }}
          aria-hidden
        />
      </div>

      <div className="flex flex-wrap justify-between gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          <span
            className={cn(
              "mr-1.5 inline-block size-2 rounded-full align-middle",
              voorloopt ? "bg-emerald-500" : "bg-amber-500",
            )}
            aria-hidden
          />
          Gerealiseerd {formatteerUren(gerealiseerd)} uur
        </span>
        <span>
          <span
            className="mr-1.5 inline-block h-2.5 w-0.5 bg-foreground align-middle"
            aria-hidden
          />
          Verwacht op vandaag {formatteerUren(verwacht)} uur
        </span>
        <span>Jaarnorm {formatteerUren(norm)} uur</span>
      </div>
    </div>
  );
}
