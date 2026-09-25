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
