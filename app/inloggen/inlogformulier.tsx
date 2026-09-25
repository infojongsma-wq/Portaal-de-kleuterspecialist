"use client";

import * as React from "react";
import { useActionState } from "react";
import { LogIn } from "lucide-react";

import { logIn, type InlogResultaat } from "./acties";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function Inlogformulier({ verder }: { verder: string }) {
  const [stand, verstuur, bezig] = useActionState<InlogResultaat | null, FormData>(
    logIn,
    null,
  );

  return (
    <form action={verstuur} className="grid gap-4">
      <input type="hidden" name="verder" value={verder} />

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
        <Fout melding={stand?.velden?.email} />
      </div>

      <div className="grid gap-1.5">
        <Label htmlFor="wachtwoord">Wachtwoord</Label>
        <Input
          id="wachtwoord"
          name="wachtwoord"
          type="password"
          autoComplete="current-password"
          required
          aria-invalid={stand?.velden?.wachtwoord ? true : undefined}
        />
        <Fout melding={stand?.velden?.wachtwoord} />
      </div>

      {stand?.melding ? (
        <p
          className="rounded-md bg-destructive/10 p-3 text-sm text-destructive"
          role="alert"
        >
          {stand.melding}
        </p>
      ) : null}

      <Button type="submit" disabled={bezig} className="w-full">
        <LogIn aria-hidden />
        {bezig ? "Bezig met inloggen…" : "Inloggen"}
      </Button>
    </form>
  );
}

function Fout({ melding }: { melding?: string }) {
  if (!melding) return null;
  return (
    <p className="text-xs text-destructive" role="alert">
      {melding}
    </p>
  );
}
