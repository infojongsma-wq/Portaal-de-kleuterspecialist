"use client";

import { LogOut } from "lucide-react";

import { logUit } from "@/app/inloggen/acties";
import { Button } from "@/components/ui/button";

export function Uitlogknop() {
  return (
    <form action={logUit}>
      <Button
        type="submit"
        variant="ghost"
        size="sm"
        className="text-muted-foreground"
      >
        <LogOut aria-hidden />
        Uitloggen
      </Button>
    </form>
  );
}
