<!--
  The leg's booking on the leg view, « Votre billet »: the booked train, how it
  ranks, how many candidates do better, and a way to cancel it.
-->
<script setup lang="ts">
import { BadgeCheck } from '@lucide/vue'
import type { RankedBooking } from '#shared/domain/evaluation'

const props = defineProps<{
  booking: RankedBooking
  /** The route weight the leg was ranked with, to explain an out-of-window rank. */
  routeWeight: number
  stationName: (code: string) => string
  /** Whether the leg has passed: no candidate can do better any more. */
  past?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ cancel: [] }>()

const headingId = useId()
const train = computed(() => props.booking.train)
const explanation = computed(() => {
  const { routeRank } = props.booking
  if (routeRank === null) return 'Route retirée de vos préférences'
  return rankExplanation({ ...props.booking, routeRank }, props.routeWeight)
})
</script>

<template>
  <section
    class="overflow-hidden rounded-card bg-surface ring-2 ring-booked"
    :aria-labelledby="headingId"
  >
    <h2
      :id="headingId"
      class="eyebrow flex items-center gap-1.5 bg-booked px-5 py-1.5 text-on-booked"
    >
      <BadgeCheck
        :size="12"
        :stroke-width="2.2"
        aria-hidden="true"
      />
      Votre billet
    </h2>
    <div class="p-5">
      <div class="flex items-center justify-between gap-2 text-[11px] font-bold">
        <AppChip tone="booked">
          {{ booking.routeRank === null ? 'Hors routes' : `Route ${booking.routeRank}` }}
        </AppChip>
        <span class="text-ink-muted">{{ explanation }}</span>
      </div>

      <p class="tnum mt-4 text-2xl leading-none font-extrabold">
        {{ train.departureTime }} → {{ train.arrivalTime }}
      </p>
      <p class="mt-2 text-[13px] font-medium text-ink-muted">
        {{ routeName(train, stationName) }}
      </p>
      <p class="mt-1 text-[11px] font-bold text-ink-muted">
        {{ durationText(booking.durationMinutes) }} · train {{ train.trainNumber }}
      </p>

      <p
        v-if="!past"
        class="mt-4 text-[13px] font-bold"
        :class="booking.candidatesAbove > 0 ? 'text-accent-ink' : 'text-booked-ink'"
      >
        {{ bookingStanding(booking) }}
      </p>

      <button
        type="button"
        class="mt-4 flex h-11 w-full items-center justify-center rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
        :disabled="disabled"
        @click="emit('cancel')"
      >
        Annuler la réservation
      </button>
    </div>
  </section>
</template>
