<!--
  « Déclarer une réservation », inside a bottom sheet: every train of the leg's
  date on its routes in the latest snapshot, open or not, to pick the one the
  traveller booked, even if they just took its last seat.
-->
<script setup lang="ts">
import { BadgeCheck, X } from '@lucide/vue'
import type { BookedTrain } from '#shared/domain/evaluation'

const props = defineProps<{
  tripKey: string
  kind: string
  /** The train the traveller holds for the leg, if any. */
  booked: BookedTrain | null
  stationName: (code: string) => string
  titleId: string
  pick: (train: BookedTrain) => Promise<void>
}>()

const emit = defineEmits<{ close: [] }>()

const { data: trains, status } = useFetch(`/api/trips/${props.tripKey}/legs/${props.kind}/trains`, { server: false })

const saving = ref(false)
const failed = ref(false)

async function choose(train: BookedTrain) {
  saving.value = true
  failed.value = false
  try {
    await props.pick(train)
    emit('close')
  }
  catch {
    failed.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mt-4 flex items-center justify-between gap-4">
    <h2
      :id="titleId"
      class="text-xl font-extrabold tracking-tight"
    >
      Déclarer une réservation
    </h2>
    <button
      type="button"
      class="grid size-9 place-items-center rounded-full bg-surface-muted"
      @click="emit('close')"
    >
      <X
        :size="16"
        :stroke-width="2.2"
        aria-hidden="true"
      />
      <span class="sr-only">Fermer</span>
    </button>
  </div>
  <p class="mt-1 text-[13px] font-medium text-ink-muted">
    Tous les trains du jour sur vos routes, même complets.
  </p>

  <p
    v-if="failed"
    role="alert"
    class="mt-4 text-[13px] font-bold text-accent-ink"
  >
    Impossible d’enregistrer la réservation. Réessayez.
  </p>

  <p
    v-if="status === 'pending' || status === 'idle'"
    class="mt-6 text-[13px] font-medium text-ink-muted"
  >
    Chargement des trains…
  </p>
  <p
    v-else-if="status === 'error'"
    class="mt-6 text-[13px] font-medium text-ink-muted"
  >
    Impossible de charger les trains pour l’instant.
  </p>
  <p
    v-else-if="!trains?.length"
    class="mt-6 text-[13px] font-medium text-ink-muted"
  >
    Aucun train ce jour-là sur vos routes dans le dernier instantané.
  </p>
  <ul
    v-else
    class="mt-4 divide-y divide-line"
    aria-label="Trains du jour"
  >
    <li
      v-for="train in trains"
      :key="`${train.trainNumber}-${train.originCode}-${train.destinationCode}`"
      class="flex items-center gap-3 py-3"
    >
      <div class="min-w-0 flex-1">
        <p class="tnum flex items-center gap-2 text-[17px] font-extrabold">
          {{ train.departureTime }} → {{ train.arrivalTime }}
          <AppChip v-if="!train.open">
            Complet
          </AppChip>
        </p>
        <p class="mt-0.5 truncate text-[12px] font-medium text-ink-muted">
          Route {{ train.routeRank }} · {{ routeName(train, stationName) }} · train {{ train.trainNumber }}
        </p>
      </div>
      <p
        v-if="booked && sameTrain(booked, train)"
        class="flex h-9 shrink-0 items-center gap-1 rounded-control bg-booked-soft px-3 text-[12px] font-bold text-booked-ink"
      >
        <BadgeCheck
          :size="13"
          :stroke-width="2.2"
          aria-hidden="true"
        />
        Réservé
      </p>
      <button
        v-else
        type="button"
        class="h-9 shrink-0 rounded-control bg-inverse px-3 text-[12px] font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-50"
        :disabled="saving"
        @click="choose(train)"
      >
        Choisir<span class="sr-only"> le train {{ train.trainNumber }} de {{ train.departureTime }}</span>
      </button>
    </li>
  </ul>
</template>
