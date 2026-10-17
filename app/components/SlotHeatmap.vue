<!--
  The slots of the dashboard: weekday × departure-hour band, the share of
  train-mornings with an open seat, on a single orange sequential ramp with the
  percentage in each cell.
-->
<script setup lang="ts">
import type { SlotGrid } from '#shared/domain/opening-history'

const props = defineProps<{
  grid: SlotGrid
}>()

/** The ramp's top: the highest cell, so the ramp always spans the data. */
const highest = computed(() => Math.max(1, ...props.grid.rows.flatMap(row => row.percents.map(percent => percent ?? 0))))

/** The cell's share of the ramp, from 8 % (lightest step) to 100 %. */
function strength(percent: number): number {
  return 8 + percent / highest.value * 92
}

function cellStyle(percent: number | null) {
  if (percent === null) return {}
  return { backgroundColor: `color-mix(in oklab, var(--color-accent) ${strength(percent).toFixed(0)}%, var(--color-surface-muted))` }
}
</script>

<template>
  <div>
    <table class="tnum w-full table-fixed border-separate border-spacing-0.5">
      <caption class="sr-only">
        Part des trains avec une place, selon le jour et l’heure de départ
      </caption>
      <thead>
        <tr>
          <th
            scope="col"
            class="w-9"
          >
            <span class="sr-only">Jour</span>
          </th>
          <th
            v-for="band in grid.bands"
            :key="band.fromHour"
            scope="col"
            class="pb-1 text-center text-[9px] font-bold whitespace-nowrap text-ink-muted"
          >
            {{ bandLabel(band) }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="row in grid.rows"
          :key="row.weekday"
        >
          <th
            scope="row"
            class="text-left text-[11px] font-bold text-ink-muted"
          >
            {{ shortWeekday(row.weekday) }}
          </th>
          <td
            v-for="(percent, index) in row.percents"
            :key="index"
            class="h-10 rounded-[6px] text-center text-[11px] font-bold"
            :class="percent === null ? 'bg-surface-muted text-ink-faint' : strength(percent) > 75 ? 'text-on-ramp' : 'text-ink'"
            :style="cellStyle(percent)"
          >
            {{ percent === null ? '–' : `${percent} %` }}
          </td>
        </tr>
      </tbody>
    </table>
    <div
      class="tnum mt-3 flex items-center gap-2 text-[10px] font-semibold text-ink-muted"
      aria-hidden="true"
    >
      <span>0 %</span>
      <span
        class="h-2 flex-1 rounded-full"
        style="background: linear-gradient(90deg, color-mix(in oklab, var(--color-accent) 8%, var(--color-surface-muted)), var(--color-accent))"
      />
      <span>{{ highest }} % des trains avec une place</span>
    </div>
  </div>
</template>
