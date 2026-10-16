<script setup lang="ts">
/**
 * - `surface`: a chip sitting on the page canvas (header facts).
 * - `muted`: a neutral chip sitting on a card.
 * - `accent`: something new for the traveller (« Amélioration »).
 * - `booked`: a booking (« Réservé »).
 */
type ChipTone = 'surface' | 'muted' | 'accent' | 'booked'

const props = withDefaults(defineProps<{ tone?: ChipTone }>(), { tone: 'muted' })

const toneClasses: Record<ChipTone, string> = {
  surface: 'bg-surface text-ink px-3 py-1.5 text-xs',
  muted: 'bg-surface-muted text-ink-muted px-2.5 py-1 text-[11px]',
  accent: 'bg-accent text-on-accent px-2.5 py-1 text-[11px]',
  booked: 'bg-booked-soft text-booked-ink px-2.5 py-1 text-[11px]',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full font-bold whitespace-nowrap"
    :class="toneClasses[props.tone]"
  >
    <slot />
  </span>
</template>
