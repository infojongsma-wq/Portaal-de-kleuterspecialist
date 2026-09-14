"use client";

import { useActionState } from "react";
import { Mail } from "lucide-react";

import {
  vraagWachtwoordHerstel,
  type InlogResultaat,
} from "@/app/inloggen/acties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function HerstelFormulier() {
  const [stand, verstuur, bezig] = useActionState<
    InlogResultaat | null,
    FormData
  >(vraagWachtwoordHerstel, null);

  if (stand?.melding) {
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {stand.melding}
      </p>
    );
  }

  return (
    <form action={verstuur} className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor="email">E-mailadres</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          aria-invalid={stand?.velden?.email ? true : undefined}
        />
        {stand?.velden?.email ? (
          <p className="text-xs text-destructive" role="alert">
            {stand.velden.email}
          </p>
        ) : null}
      </div>

      <Button type="submit" disabled={bezig} className="w-full">
        <Mail aria-hidden />
        {bezig ? "Bezig…" : "Stuur een herstellink"}
      </Button>
    </form>
  );
}
