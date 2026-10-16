import type { Improvement, ImprovementKind } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import type { PushMessage } from '#shared/types/push'

const KIND_WORDS: Record<ImprovementKind, string> = {
  'first-candidate': 'Premier train',
  'new-best': 'Meilleur train',
  'better-than-booking': 'Mieux que votre billet',
}

const LEG_WORDS: Record<LegKind, string> = { outbound: 'l’aller', return: 'le retour' }

// Calendar days are formatted at UTC midnight, where they never shift.
const longDay = new Intl.DateTimeFormat('fr-FR', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })

/**
 * The notification of an improvement (spec, "Notifications"), in French: its
 * kind, leg and date as the title, the train's times and stations as the body.
 * Tapping it opens the leg view.
 *
 * « Meilleur train pour l’aller du vendredi 23 octobre »
 * « 07:00 Paris Gare de Lyon → 08:56 Lyon Part-Dieu »
 */
export function improvementMessage({ tripKey, legKind, date, kind, candidate: { train } }: Improvement, stationName: (code: string) => string): PushMessage {
  return {
    title: `${KIND_WORDS[kind]} pour ${LEG_WORDS[legKind]} du ${longDay.format(new Date(`${date}T00:00:00Z`))}`,
    body: `${train.departureTime} ${stationName(train.originCode)} → ${train.arrivalTime} ${stationName(train.destinationCode)}`,
    url: `/trips/${tripKey}/${legKind}`,
  }
}
