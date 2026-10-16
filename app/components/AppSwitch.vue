<!-- An on/off switch with its label, and an optional line under the label. -->
<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
  disabled?: boolean
}>()

const checked = defineModel<boolean>({ required: true })
const ids = { label: useId(), hint: useId() }
</script>

<template>
  <div class="flex items-center justify-between gap-4">
    <div class="min-w-0">
      <p
        :id="ids.label"
        class="text-[13px] font-bold"
      >
        {{ label }}
      </p>
      <p
        v-if="hint"
        :id="ids.hint"
        class="mt-0.5 text-[12px] leading-snug font-medium text-ink-muted"
      >
        {{ hint }}
      </p>
    </div>
    <button
      type="button"
      role="switch"
      :aria-checked="checked"
      :aria-labelledby="ids.label"
      :aria-describedby="hint ? ids.hint : undefined"
      :disabled="disabled"
      class="relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-60"
      :class="checked ? 'bg-inverse' : 'bg-ink-faint'"
      @click="checked = !checked"
    >
      <span
        class="absolute top-1 left-1 size-5 rounded-full bg-surface shadow transition-transform"
        :class="checked ? 'translate-x-5' : ''"
        aria-hidden="true"
      />
    </button>
  </div>
</template>
