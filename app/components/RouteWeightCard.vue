<!--
  « Pondération des gares » in Réglages: how many minutes one route rank is
  worth when no train fits the time window, with a worked example of which
  route wins. Saved as soon as the slider is released.
-->
<script setup lang="ts">
import { compareOutOfWindow, MAX_ROUTE_WEIGHT } from '#shared/domain/evaluation'

const props = defineProps<{
  routeWeight: number
  save: (routeWeight: number) => Promise<void>
  disabled?: boolean
}>()

const titleId = useId()
const sliderId = useId()

/** The weight the slider shows, saved when it is released. */
const draft = ref(props.routeWeight)
watch(() => props.routeWeight, (saved) => {
  draft.value = saved
})
const saveState = ref<'idle' | 'saving' | 'saved' | 'failed'>('idle')

async function commit() {
  saveState.value = 'saving'
  try {
    await props.save(draft.value)
    saveState.value = 'saved'
  }
  catch {
    saveState.value = 'failed'
  }
}

// The worked example: arrive before 10:00, and no train does.
const routeOne = { routeRank: 1, minutesOutsideWindow: 60 }
const routeThree = { routeRank: 3, minutesOutsideWindow: 25 }
/** The route that ranks first in the example. */
const winner = computed(() => compareOutOfWindow(routeThree, routeOne, draft.value) < 0 ? 3 : 1)
</script>

<template>
  <SurfaceCard
    as="section"
    :aria-labelledby="titleId"
  >
    <h2
      :id="titleId"
      class="text-[15px] font-extrabold"
    >
      Pondération des gares
    </h2>
    <div class="mt-3 flex items-baseline justify-between gap-4">
      <label
        :for="sliderId"
        class="text-sm font-bold"
      >
        1 rang de gare vaut
      </label>
      <output
        :for="sliderId"
        class="tnum text-2xl font-extrabold"
      >
        {{ draft }} min
      </output>
    </div>
    <input
      :id="sliderId"
      v-model.number="draft"
      type="range"
      min="0"
      :max="MAX_ROUTE_WEIGHT"
      step="5"
      :disabled="disabled"
      class="mt-3 w-full accent-accent"
      @change="commit"
    >
    <div
      class="mt-3 rounded-control bg-surface-muted p-4 text-xs leading-relaxed font-medium text-ink-muted"
      aria-live="polite"
    >
      <p class="font-bold text-ink">
        Exemple : arriver avant 10:00, aucun train dans la fenêtre
      </p>
      <p class="mt-1">
        La route 1 arrive à 11:00, soit 60 min hors fenêtre. La route 3 arrive à 10:25 : 25 min + 2 rangs × {{ draft }} min.
      </p>
      <p class="mt-1 font-extrabold text-ink">
        → La route {{ winner }} passe en premier.
      </p>
    </div>
    <p
      v-if="saveState === 'failed'"
      role="alert"
      class="mt-2 text-[13px] leading-snug font-semibold text-accent-ink"
    >
      Enregistrement impossible pour l’instant. Réessayez dans un moment.
    </p>
    <p
      v-else
      role="status"
      class="mt-2 min-h-5 text-[13px] font-semibold text-ink-muted"
    >
      {{ saveState === 'saved' ? 'Enregistré' : '' }}
    </p>
  </SurfaceCard>
</template>
