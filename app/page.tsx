import { redirect } from "next/navigation";

export default function Startpagina() {
  // Na inloggen doorsturen op basis van rol (SPEC.md 6.1). Zolang er nog geen
  // auth is, gaat iedereen naar het hoofdscherm van de medewerker.
  redirect("/afspraken");
}
