<!-- Whether a trip is customised (« Personnalisé ») or muted (« En sourdine »); nothing when it is neither. -->
<script setup lang="ts">
import type { Trip } from '#shared/domain/evaluation'

defineProps<{ trip: Trip }>()
</script>

<template>
  <div
    v-if="trip.customised || trip.muted"
    class="flex flex-wrap gap-1.5"
  >
    <AppChip v-if="trip.customised">
      Personnalisé
    </AppChip>
    <AppChip v-if="trip.muted">
      En sourdine
    </AppChip>
  </div>
</template>
