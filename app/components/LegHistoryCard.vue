<!--
  « Historique d’un trajet » on the dashboard: leg chips to pick a leg of a
  tracked or archived trip, its settings, and how many candidates it had in
  each snapshot, titled with the history's conclusion.
-->
<script setup lang="ts">
import type { HistoryLeg } from '#shared/domain/leg-history'

const props = defineProps<{
  legs: HistoryLeg[]
  /** Why the history is still empty, when it is. */
  emptyText: string
}>()

const legId = (leg: Pick<HistoryLeg, 'tripKey' | 'kind'>) => `${leg.tripKey}/${leg.kind}`

/** The picked leg: the next one to leave by default, the latest one once every leg has passed. */
const pickedId = ref<string | null>(null)
const picked = computed(() =>
  props.legs.find(leg => legId(leg) === pickedId.value)
  ?? props.legs.find(leg => !leg.past)
  ?? props.legs.at(-1)
  ?? null)

const requestFetch = useRequestFetch()
const { data: history } = await useAsyncData(
  () => `leg-history:${picked.value ? legId(picked.value) : 'none'}`,
  () => picked.value ? requestFetch(`/api/dashboard/legs/${picked.value.tripKey}/${picked.value.kind}`) : Promise.resolve(null),
)

const headline = computed(() => history.value && legHistoryHeadline(history.value))
const banner = computed(() => history.value && windowBanner(history.value.settings))

function stationName(code: string): string {
  return history.value?.stationNames[code] ?? code
}

// Keeps the picked chip in view in a long row of legs.
const chips = useTemplateRef<HTMLElement>('chips')
onMounted(() => chips.value?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center' }))
</script>

<template>
  <SurfaceCard
    as="section"
    aria-labelledby="leg-history-title"
  >
    <p class="eyebrow">
      Historique d’un trajet
    </p>
    <h2
      id="leg-history-title"
      class="mt-1 text-[19px] leading-snug font-extrabold tracking-tight"
    >
      {{ headline ?? 'L’historique de chaque trajet apparaîtra ici.' }}
    </h2>

    <div
      v-if="legs.length > 0"
      ref="chips"
      class="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5"
      role="group"
      aria-label="Trajets"
    >
      <button
        v-for="leg in legs"
        :key="legId(leg)"
        type="button"
        class="h-8 shrink-0 rounded-full px-3 text-xs font-bold transition"
        :class="picked && legId(picked) === legId(leg) ? 'bg-inverse text-on-inverse' : 'bg-surface-muted text-ink-muted'"
        :aria-pressed="picked !== null && legId(picked) === legId(leg)"
        @click="pickedId = legId(leg)"
      >
        {{ historyLegLabel(leg) }}
      </button>
    </div>

    <template v-if="history && banner">
      <p class="mt-3 text-xs font-bold">
        {{ banner.window }} · <span class="text-ink-muted">{{ banner.ideal }}</span>
      </p>
      <ol class="mt-1 space-y-0.5 text-xs font-medium text-ink-muted">
        <li
          v-for="(route, index) in history.settings.routes"
          :key="`${route.originCode}>${route.destinationCode}`"
        >
          {{ index + 1 }}. {{ routeName(route, stationName) }}
        </li>
      </ol>
      <div
        v-if="history.columns.length > 0"
        class="mt-5"
      >
        <LegHistoryChart
          :columns="history.columns"
          :station-names="history.stationNames"
        />
        <p class="mt-2 text-xs font-medium text-ink-muted">
          Trains avec une place à chaque instantané du matin, classés avec les réglages de ce trajet. Touchez une barre.
        </p>
      </div>
      <p
        v-else
        class="mt-3 text-xs font-medium text-ink-muted"
      >
        {{ emptyText }}
      </p>
    </template>
    <p
      v-else-if="legs.length === 0"
      class="mt-3 text-xs font-medium text-ink-muted"
    >
      {{ emptyText }}
    </p>
  </SurfaceCard>
</template>
