<!--
  A leg's day at a glance: the accepted zone of its time window and an orange
  dot at its ideal time, from 05:00 to midnight, captioned in words. The bar
  is decorative; the caption carries the same information for everyone.
-->
<script setup lang="ts">
import type { LocalTime, TemplateLeg } from '#shared/domain/trip-template'

const props = defineProps<{ leg: TemplateLeg }>()

// Trains run from about 05:00 to midnight.
const DAY_START = 5 * 60
const DAY_END = 24 * 60
const TICKS = [6, 12, 18] as const

function percent(minutes: number): number {
  return Math.min(100, Math.max(0, ((minutes - DAY_START) / (DAY_END - DAY_START)) * 100))
}

/** Where `time` sits along the bar, in percent of its width. */
function position(time: LocalTime): number {
  const [hours = 0, minutes = 0] = time.split(':').map(Number)
  return percent(hours * 60 + minutes)
}

const zone = computed(() => {
  const { start, end } = props.leg.window
  const from = start ? position(start) : 0
  const to = end ? position(end) : 100
  return { left: `${from}%`, width: `${Math.max(0, to - from)}%` }
})

const ideal = computed(() => (props.leg.idealTime ? position(props.leg.idealTime) : null))
</script>

<template>
  <div class="pointer-events-none">
    <div
      class="relative mt-4 h-8"
      aria-hidden="true"
    >
      <span
        v-if="ideal !== null"
        class="tnum absolute top-0 -translate-x-1/2 text-[11px] font-extrabold"
        :style="{ left: `clamp(1rem, ${ideal}%, calc(100% - 1rem))` }"
      >{{ leg.idealTime }}</span>
      <div class="absolute inset-x-0 bottom-1 h-2.5 rounded-full bg-surface-muted" />
      <div
        class="absolute bottom-1 h-2.5 rounded-full bg-accent/35"
        :style="zone"
      />
      <div
        v-if="ideal !== null"
        class="absolute bottom-px size-4 -translate-x-1/2 rounded-full bg-accent ring-[3px] ring-surface"
        :style="{ left: `${ideal}%` }"
      />
    </div>
    <div
      class="tnum relative h-4 text-[10px] font-semibold text-ink-muted"
      aria-hidden="true"
    >
      <span
        v-for="hour in TICKS"
        :key="hour"
        class="absolute -translate-x-1/2"
        :style="{ left: `${percent(hour * 60)}%` }"
      >{{ hour }}h</span>
      <span class="absolute right-0">24h</span>
    </div>
    <p class="mt-1 text-[12px] font-semibold text-ink-muted">
      {{ windowCaption(leg) }}
    </p>
  </div>
</template>
