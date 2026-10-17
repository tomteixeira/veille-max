import type { ImprovementKind } from '../domain/evaluation'
import type { LegKind } from '../domain/trip-template'

// The French words both the app's screens and the server's notifications use.

/** « l’aller », « le retour »: a leg named inside a sentence. */
export const LEG_NAMES_IN_SENTENCE: Record<LegKind, string> = { outbound: 'l’aller', return: 'le retour' }

/** What an improvement brought: the chip in « Nouveautés », the start of its notification. */
export const IMPROVEMENT_NAMES: Record<ImprovementKind, string> = {
  'first-candidate': 'Premier train',
  'new-best': 'Meilleur train',
  'better-than-booking': 'Mieux que votre billet',
}
