import type { Improvement } from '#shared/domain/evaluation'
import { IMPROVEMENT_NAMES, LEG_NAMES_IN_SENTENCE } from '#shared/utils/french-words'
import { longDayName } from '#shared/utils/paris-time'
import type { PushMessage } from '#shared/types/push'

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
    // Inside the sentence, the day starts lower-case.
    title: `${IMPROVEMENT_NAMES[kind]} pour ${LEG_NAMES_IN_SENTENCE[legKind]} du ${longDayName(date).toLowerCase()}`,
    body: `${train.departureTime} ${stationName(train.originCode)} → ${train.arrivalTime} ${stationName(train.destinationCode)}`,
    url: `/trips/${tripKey}/${legKind}`,
  }
}
