<!--
  A candidate on the leg view, drawn as a ticket: its route rank, why it ranks
  where it does, its departure and arrival, a link to book it and a way to
  declare it booked.
-->
<script setup lang="ts">
import { BadgeCheck, ExternalLink, Sparkles } from '@lucide/vue'
import type { Candidate } from '#shared/domain/evaluation'
import { bookingLink } from '#shared/domain/sncf-connect'

const props = defineProps<{
  candidate: Candidate
  /** Whether it is the leg's best candidate: « Meilleur choix ». */
  best: boolean
  /** The route weight the leg was ranked with, to explain an out-of-window rank. */
  routeWeight: number
  stationName: (code: string) => string
  /** Whether it is the train the traveller booked. */
  booked?: boolean
  /** Whether it ranks strictly above the traveller's booking. */
  betterThanBooking?: boolean
  disabled?: boolean
}>()

const emit = defineEmits<{ book: [] }>()

const headingId = useId()
const train = computed(() => props.candidate.train)
</script>

<template>
  <article
    class="overflow-hidden rounded-card bg-surface"
    :class="best ? 'ring-2 ring-accent' : ''"
    :aria-labelledby="headingId"
  >
    <p
      v-if="best"
      class="eyebrow flex items-center gap-1.5 bg-accent px-5 py-1.5 text-on-accent"
    >
      <Sparkles
        :size="12"
        :stroke-width="2.2"
        aria-hidden="true"
      />
      Meilleur choix
    </p>
    <div class="p-5">
      <div class="flex items-center justify-between gap-2 text-[11px] font-bold">
        <span class="flex flex-wrap gap-1.5">
          <AppChip>Route {{ candidate.routeRank }}</AppChip>
          <AppChip
            v-if="betterThanBooking"
            tone="accent"
          >Mieux que votre billet</AppChip>
        </span>
        <span :class="candidate.inWindow ? 'text-booked-ink' : 'text-accent-ink'">{{ rankExplanation(candidate, routeWeight) }}</span>
      </div>

      <h2
        :id="headingId"
        class="sr-only"
      >
        {{ train.departureTime }} → {{ train.arrivalTime }}, train {{ train.trainNumber }}
      </h2>
      <div class="mt-4 flex gap-4">
        <div
          class="flex flex-col items-center pt-2"
          aria-hidden="true"
        >
          <span class="size-2.5 rounded-full border-2 border-ink" />
          <span class="my-1 w-0.5 flex-1 bg-line" />
          <span class="size-2.5 rounded-full bg-ink" />
        </div>
        <dl class="flex-1 space-y-3">
          <div>
            <dt class="sr-only">
              Départ
            </dt>
            <dd class="tnum text-2xl leading-none font-extrabold">
              {{ train.departureTime }}
            </dd>
            <dd class="mt-1 text-[13px] font-medium text-ink-muted">
              {{ stationName(train.originCode) }}
            </dd>
          </div>
          <div>
            <dt class="sr-only">
              Durée et train
            </dt>
            <dd class="text-[11px] font-bold text-ink-muted">
              {{ durationText(candidate.durationMinutes) }} · train {{ train.trainNumber }}
            </dd>
          </div>
          <div>
            <dt class="sr-only">
              Arrivée
            </dt>
            <dd class="tnum text-2xl leading-none font-extrabold">
              {{ train.arrivalTime }}
            </dd>
            <dd class="mt-1 text-[13px] font-medium text-ink-muted">
              {{ stationName(train.destinationCode) }}
            </dd>
          </div>
        </dl>
      </div>

      <div class="mt-5 grid grid-cols-2 gap-2">
        <p
          v-if="booked"
          class="flex h-11 items-center justify-center gap-1.5 rounded-control bg-booked-soft text-[13px] font-bold text-booked-ink"
        >
          <BadgeCheck
            :size="14"
            :stroke-width="2.2"
            aria-hidden="true"
          />
          Réservé
        </p>
        <button
          v-else
          type="button"
          class="h-11 rounded-control bg-inverse text-[13px] font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
          :disabled="disabled"
          @click="emit('book')"
        >
          J’ai réservé
        </button>
        <a
          :href="bookingLink(candidate)"
          target="_blank"
          rel="noopener noreferrer"
          class="flex h-11 items-center justify-center gap-1.5 rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80"
        >
          Réserver
          <ExternalLink
            :size="14"
            :stroke-width="2.2"
            aria-hidden="true"
          />
          <span class="sr-only">sur SNCF Connect</span>
        </a>
      </div>
    </div>
  </article>
</template>
