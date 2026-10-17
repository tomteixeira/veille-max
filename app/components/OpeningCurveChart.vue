<!--
  The opening curve of the dashboard: one column per day before departure, the
  openings that started that day. The waves are emphasised and labelled;
  tapping a column shows its value.
-->
<script setup lang="ts">
import type { OpeningCurve } from '#shared/domain/opening-history'

const props = defineProps<{
  columns: OpeningCurve['columns']
  peaks: readonly number[]
}>()

/** The day before departure of the tapped column. */
const selected = ref<number | null>(null)
const highest = computed(() => Math.max(1, ...props.columns.map(column => column.openings)))
/** The axis labels: the first column, every ten days, and departure; each with where it sits. */
const ticks = computed(() => props.columns
  .map((column, index) => ({ daysBefore: column.daysBefore, index }))
  .filter(({ daysBefore }) => daysBefore % 10 === 0)
  .map(({ daysBefore, index }) => {
    const first = index === 0
    const last = index === props.columns.length - 1
    return {
      daysBefore,
      label: daysBefore === 0 ? 'Départ' : `J-${daysBefore}`,
      class: first ? 'left-0' : last ? 'right-0' : '-translate-x-1/2',
      style: first || last ? {} : { left: `${(index + 0.5) / props.columns.length * 100}%` },
    }
  }))

function height(openings: number): string {
  // A column with openings stays visible, however small.
  return openings === 0 ? '0%' : `${Math.max(openings / highest.value * 100, 3)}%`
}

function placesText(openings: number): string {
  return `${openings} place${openings > 1 ? 's' : ''}`
}

/** Keeps a column's tooltip inside the chart near its edges. */
function tooltipPosition(index: number): string {
  if (index < 3) return 'left-0'
  if (index > props.columns.length - 4) return 'right-0'
  return 'left-1/2 -translate-x-1/2'
}
</script>

<template>
  <div>
    <div class="relative flex h-32 items-end gap-0.5 border-b border-line">
      <button
        v-for="(column, index) in columns"
        :key="column.daysBefore"
        type="button"
        class="relative flex h-full flex-1 items-end justify-center"
        :aria-label="`J-${column.daysBefore} : ${placesText(column.openings)}`"
        :aria-pressed="selected === column.daysBefore"
        @click="selected = selected === column.daysBefore ? null : column.daysBefore"
      >
        <span
          class="w-full max-w-6 rounded-t-[4px] transition-colors"
          :class="selected === column.daysBefore ? 'bg-inverse' : peaks.includes(column.daysBefore) ? 'bg-accent' : 'bg-accent/30 dark:bg-accent/35'"
          :style="{ height: height(column.openings) }"
        />
        <span
          v-if="peaks.includes(column.daysBefore) && selected !== column.daysBefore"
          class="absolute left-1/2 mb-1 -translate-x-1/2 text-[10px] font-bold whitespace-nowrap text-ink-muted"
          :style="{ bottom: height(column.openings) }"
          aria-hidden="true"
        >J-{{ column.daysBefore }}</span>
        <span
          v-if="selected === column.daysBefore"
          role="status"
          class="tnum absolute z-10 mb-1.5 rounded-lg bg-inverse px-2 py-1 text-[11px] font-bold whitespace-nowrap text-on-inverse"
          :class="tooltipPosition(index)"
          :style="{ bottom: height(column.openings) }"
        >J-{{ column.daysBefore }} · {{ placesText(column.openings) }}</span>
      </button>
    </div>
    <div
      class="tnum relative mt-1 h-4 text-[10px] font-semibold text-ink-muted"
      aria-hidden="true"
    >
      <span
        v-for="tick in ticks"
        :key="tick.daysBefore"
        class="absolute whitespace-nowrap"
        :class="tick.class"
        :style="tick.style"
      >{{ tick.label }}</span>
    </div>
  </div>
</template>
