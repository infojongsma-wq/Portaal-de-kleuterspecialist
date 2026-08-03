/**
 * De enige plek in de codebase waar rekenconstanten mogen staan.
 *
 * Alle overige waarden komen uit de database en worden als argument
 * doorgegeven aan de functies in deze map:
 *
 * | Waarde                          | Herkomst                                  |
 * |---------------------------------|-------------------------------------------|
 * | uren op locatie / voorbereiding | `activiteitsoorten`                        |
 * | eigen reistijd per dag          | `instellingen.eigen_reistijd_uren_per_dag` |
 * | 1659 uur bij 1,0 fte            | `contracten.norm_fulltime`                 |
 * | schoolvakanties en feestdagen   | `niet_inzetbare_dagen`                     |
 *
 * Zie CLAUDE.md, hoofdstuk "Rekenregels — nooit hardcoderen".
 */

/**
 * Vaste deler in de werktijdfactor: een fulltime werkweek is 40 uur
 * (SPEC.md hoofdstuk 2). Dit is bewust wél een constante — het is geen
 * instelbare bedrijfswaarde maar de noemer van de definitie zelf.
 */
export const FULLTIME_UREN_PER_WEEK = 40;

/** Uren worden met twee decimalen opgeslagen en getoond (SPEC.md 5.6). */
export const UREN_DECIMALEN = 2;

/**
 * Referentieaantal inzetbare dagen bij 1,0 fte (SPEC.md 5.4):
 * 1659 uur is 41,48 werkweken × 40 uur, oftewel 207,4 dagen van 8 uur.
 * Dient uitsluitend als controle op de volledigheid van `niet_inzetbare_dagen`.
 */
export const VERWACHTE_INZETBARE_DAGEN = 207.4;

/**
 * Wijkt het berekende aantal inzetbare dagen meer dan dit deel af van
 * `VERWACHTE_INZETBARE_DAGEN`, dan zijn de vakantiedata waarschijnlijk
 * onvolledig ingevoerd en toont de app een waarschuwing (SPEC.md 5.4).
 */
export const INZETBARE_DAGEN_AFWIJKING_DREMPEL = 0.05;
