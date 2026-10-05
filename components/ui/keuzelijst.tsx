import { cn } from "@/lib/utils";

/**
 * Gewone keuzelijst van de browser.
 *
 * Bewust geen Radix-variant: dit veld wordt gebruikt in formulieren die met een
 * gewone GET of POST versturen, en dan moet de waarde ook zonder JavaScript
 * meegaan. Staat in een eigen bestand omdat client components hem gebruiken.
 */
export function Keuzelijst({
  className,
  ...props
}: React.ComponentProps<"select">) {
  return (
    <select
      className={cn(
        "h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
      {...props}
    />
  );
}
