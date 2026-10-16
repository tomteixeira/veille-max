<!--
  One half of the « Billet modèle » in Réglages, or of a trip's ticket on its
  page: a leg's settings, drawn like a leg of the home ticket. Tapping anywhere
  on it opens its editor, except on what the default slot adds at its bottom.
-->
<script setup lang="ts">
import type { LegKind, LegSettings } from '#shared/domain/trip-template'

const props = defineProps<{
  kind: LegKind
  /** When the leg runs: « Vendredi », « Jeudi 22 octobre ». */
  day: string
  leg: LegSettings
  stationName: (code: string) => string
  disabled?: boolean
}>()

const emit = defineEmits<{ edit: [] }>()

const headingId = useId()
const headline = computed(() => windowHeadline(props.leg))
</script>

<template>
  <section
    class="relative px-5 pt-5 pb-4"
    :aria-labelledby="headingId"
  >
    <div class="flex items-center justify-between">
      <h2
        :id="headingId"
        class="eyebrow"
      >
        {{ LEG_NAMES[kind] }} · {{ day }}
      </h2>
      <!-- Stretched over the whole half, so that tapping anywhere on it opens the editor. -->
      <button
        type="button"
        :disabled="disabled"
        class="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold transition-opacity after:absolute after:inset-0 hover:opacity-80 disabled:opacity-60"
        @click="emit('edit')"
      >
        Modifier<span class="sr-only"> {{ LEG_NAMES_IN_SENTENCE[kind] }}</span>
      </button>
    </div>

    <p class="mt-3 text-[13px] font-bold text-ink-muted">
      {{ headline.label }}
    </p>
    <p class="tnum text-[36px] leading-none font-extrabold tracking-tight">
      {{ headline.time }}
    </p>

    <LegDayBar :leg="leg" />

    <ol
      v-if="leg.routes.length > 0"
      class="mt-3 flex flex-wrap gap-1.5"
      aria-label="Routes, par ordre de préférence"
    >
      <li
        v-for="(route, index) in leg.routes"
        :key="`${route.originCode}-${route.destinationCode}`"
        class="inline-flex min-w-0 items-center gap-1.5 rounded-full bg-surface-muted py-1 pr-2.5 pl-1 text-[12px] font-bold"
      >
        <span
          class="grid size-4 shrink-0 place-items-center rounded-full bg-accent text-[9px] text-on-accent"
          aria-hidden="true"
        >{{ index + 1 }}</span>
        <span class="truncate">{{ routeName(route, stationName) }}</span>
      </li>
    </ol>
    <p
      v-else
      class="mt-3 text-[13px] font-medium text-ink-muted"
    >
      Aucune route pour l’instant
    </p>

    <!-- Above the stretched « Modifier » button. -->
    <div
      v-if="$slots.default"
      class="relative z-10 mt-4"
    >
      <slot />
    </div>
  </section>
</template>
