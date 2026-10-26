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
 * | vergoeding per kilometer        | `ritten.vergoeding_per_km`, bij het       |
 * |                                 | opslaan overgenomen uit `instellingen`     |
 *
 * Zie CLAUDE.md, hoofdstuk "Rekenregels — nooit hardcoderen".
 */

/**
 * Vaste deler in de werktijdfactor: een fulltime werkweek is 40 uur
 * (SPEC.md hoofdstuk 2). Dit is bewust wél een constante — het is geen
 * instelbare bedrijfswaarde maar de noemer van de definitie zelf.
 */
export const FULLTIME_UREN_PER_WEEK = 40;

/**
 * De eigen reistijd per dag (`instellingen.eigen_reistijd_uren_per_dag`, 2,0
 * uur) staat voor één reis heen en één terug: twee enkele reizen. Per enkele
 * reis is de eigen tijd dus de helft, een uur (SPEC.md 5.2). Geen instelbare
 * bedrijfswaarde maar de betekenis van de instelling zelf.
 */
export const ENKELE_REIZEN_IN_EIGEN_REISTIJD = 2;

/** Uren worden met twee decimalen opgeslagen en getoond (SPEC.md 5.6). */
export const UREN_DECIMALEN = 2;

/** Kilometers worden met één decimaal opgeslagen en getoond (SPEC.md 5.7). */
export const KM_DECIMALEN = 1;

/** Bedragen in hele centen (SPEC.md 5.7). */
export const BEDRAG_DECIMALEN = 2;
