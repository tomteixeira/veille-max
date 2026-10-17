<!-- Whether a trip is customised (« Personnalisé ») or muted (« En sourdine »); nothing when it is neither. -->
<script setup lang="ts">
import { BellOff } from '@lucide/vue'
import type { Trip } from '#shared/domain/evaluation'

defineProps<{
  trip: Trip
  /** Shows « En sourdine » as an icon, so both chips fit on one short line. */
  compact?: boolean
}>()
</script>

<template>
  <div
    v-if="trip.customised || trip.muted"
    class="flex flex-wrap items-center gap-1.5"
  >
    <AppChip v-if="trip.customised">
      Personnalisé
    </AppChip>
    <template v-if="trip.muted">
      <span
        v-if="compact"
        role="img"
        aria-label="En sourdine"
        title="En sourdine"
        class="text-ink-muted"
      >
        <BellOff
          :size="14"
          :stroke-width="2.2"
          aria-hidden="true"
        />
      </span>
      <AppChip v-else>
        En sourdine
      </AppChip>
    </template>
  </div>
</template>
