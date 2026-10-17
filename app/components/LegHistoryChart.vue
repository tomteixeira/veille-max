<!--
  A leg's history on the dashboard: one column per snapshot, the number of
  candidates the leg had then. The highest column is emphasised; tapping a
  column shows its value and its best candidate.
-->
<script setup lang="ts">
import type { LegHistoryColumn } from '#shared/domain/leg-history'

const props = defineProps<{
  columns: LegHistoryColumn[]
  /** The full name of every station of the leg's routes, by code. */
  stationNames: Record<string, string>
}>()

/** The snapshot of the tapped column. */
const selectedId = ref<number | null>(null)
const selected = computed(() => props.columns.find(column => column.snapshotId === selectedId.value) ?? null)
// Another leg, other snapshots: nothing tapped yet.
watch(() => props.columns, () => selectedId.value = null)

const highest = computed(() => Math.max(0, ...props.columns.map(column => column.candidates)))
/** The first highest column, emphasised; none while every column is empty. */
const peakId = computed(() => highest.value === 0 ? null : props.columns.find(column => column.candidates === highest.value)!.snapshotId)
/** The axis labels: the first and the last snapshot. */
const ticks = computed(() => {
  const first = props.columns[0]
  const last = props.columns.at(-1)
  if (!first || !last) return []
  const label = ({ daysBefore }: LegHistoryColumn) => daysBeforeLabel(daysBefore)
  return first === last ? [{ label: label(first), class: 'left-0' }] : [{ label: label(first), class: 'left-0' }, { label: label(last), class: 'right-0' }]
})

function height(candidates: number): string {
  // A column with candidates stays visible, however small.
  return candidates === 0 ? '0%' : `${Math.max(candidates / Math.max(highest.value, 1) * 100, 3)}%`
}

function stationName(code: string): string {
  return props.stationNames[code] ?? code
}
</script>

<template>
  <div>
    <div class="relative flex h-28 items-end gap-0.5 border-b border-line">
      <button
        v-for="column in columns"
        :key="column.snapshotId"
        type="button"
        class="relative flex h-full min-w-0 flex-1 items-end justify-center"
        :aria-label="`${daysBeforeLabel(column.daysBefore)} : ${trainsText(column.candidates)}`"
        :aria-pressed="selectedId === column.snapshotId"
        @click="selectedId = selectedId === column.snapshotId ? null : column.snapshotId"
      >
        <span
          class="w-full max-w-6 rounded-t-[4px] transition-colors"
          :class="selectedId === column.snapshotId ? 'bg-inverse' : peakId === column.snapshotId ? 'bg-accent' : 'bg-accent/30 dark:bg-accent/35'"
          :style="{ height: height(column.candidates) }"
        />
      </button>
    </div>
    <div
      class="tnum relative mt-1 h-4 text-[10px] font-semibold text-ink-muted"
      aria-hidden="true"
    >
      <span
        v-for="tick in ticks"
        :key="tick.class"
        class="absolute whitespace-nowrap"
        :class="tick.class"
      >{{ tick.label }}</span>
    </div>

    <div
      v-if="selected"
      role="status"
      class="mt-3 rounded-2xl bg-surface-muted px-4 py-3"
    >
      <p class="tnum text-xs font-bold">
        {{ daysBeforeLabel(selected.daysBefore) }} · {{ trainsText(selected.candidates) }}
      </p>
      <template v-if="selected.best">
        <p class="mt-1 text-[11px] font-bold tracking-wide text-accent-ink uppercase">
          Meilleur choix
        </p>
        <p class="tnum text-lg leading-tight font-extrabold">
          {{ selected.best.train.departureTime }} → {{ selected.best.train.arrivalTime }}
        </p>
        <p class="text-xs font-medium text-ink-muted">
          {{ routeName(selected.best.train, stationName) }} · train {{ selected.best.train.trainNumber }}
        </p>
      </template>
      <p
        v-else
        class="mt-1 text-xs font-medium text-ink-muted"
      >
        Aucune place ce matin-là.
      </p>
    </div>
  </div>
</template>
