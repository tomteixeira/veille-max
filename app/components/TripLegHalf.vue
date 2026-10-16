<!--
  One half of a home ticket: a leg of a tracked trip, with its status and its
  best candidate in the latest snapshot. Tapping anywhere on it opens its leg view.
-->
<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { Leg } from '#shared/domain/evaluation'

defineProps<{
  tripKey: string
  leg: Leg
  stationName: (code: string) => string
}>()

const headingId = useId()
</script>

<template>
  <section
    class="relative px-5 py-3"
    :aria-labelledby="headingId"
  >
    <div class="flex items-center justify-between gap-2">
      <h3
        :id="headingId"
        class="eyebrow"
      >
        <!-- Stretched over the whole half, so that tapping anywhere on it opens the leg view. -->
        <NuxtLink
          :to="`/trips/${tripKey}/${leg.kind}`"
          class="after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-control focus-visible:after:outline-2 focus-visible:after:outline-accent"
        >
          {{ LEG_NAMES[leg.kind] }} · {{ shortDay(leg.date) }}
        </NuxtLink>
      </h3>
      <AppChip>{{ LEG_STATUS_NAMES[leg.status] }}</AppChip>
    </div>

    <template v-if="leg.best">
      <p class="tnum mt-2 flex items-center gap-2">
        <span class="text-[36px] leading-none font-extrabold tracking-tight">{{ leg.best.train.departureTime }}</span>
        <ArrowRight
          :size="18"
          class="text-ink-faint"
          aria-label="à"
        />
        <span class="text-[36px] leading-none font-extrabold tracking-tight text-ink-faint">{{ leg.best.train.arrivalTime }}</span>
      </p>
      <!-- A long route name gives way; the duration stays whole. -->
      <p class="mt-2 flex text-[13px] font-medium whitespace-pre text-ink-muted">
        <span class="truncate">{{ routeName(leg.best.train, stationName) }}</span>
        <span class="shrink-0"> · {{ durationText(leg.best.durationMinutes) }}</span>
      </p>
    </template>
    <template v-else>
      <p class="mt-2 text-[26px] leading-9 font-extrabold tracking-tight text-ink-faint">
        Aucun train
      </p>
      <p class="mt-2 text-[13px] font-medium text-ink-muted">
        {{ leg.status === 'past' ? 'Ce jour est passé' : 'On surveille pour vous' }}
      </p>
    </template>
  </section>
</template>
