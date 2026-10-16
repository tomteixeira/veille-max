<!-- A choice between a few options, drawn as segments: a group of native radio buttons. -->
<script setup lang="ts" generic="Value extends string | number">
defineProps<{
  /** Names the group for assistive technologies; the options speak for themselves on screen. */
  legend: string
  options: readonly { value: Value, label: string }[]
}>()

const model = defineModel<Value>({ required: true })
const name = useId()
</script>

<template>
  <fieldset class="inline-flex rounded-xl bg-surface-muted p-1">
    <legend class="sr-only">
      {{ legend }}
    </legend>
    <label
      v-for="option in options"
      :key="option.value"
      class="relative"
    >
      <input
        v-model="model"
        type="radio"
        :name="name"
        :value="option.value"
        class="peer absolute inset-0 z-10 cursor-pointer appearance-none opacity-0"
      >
      <span class="flex h-8 cursor-pointer items-center rounded-lg px-3 text-[13px] font-bold text-ink-muted transition peer-checked:bg-surface peer-checked:text-ink peer-checked:shadow-sm dark:peer-checked:bg-inverse dark:peer-checked:text-on-inverse peer-focus-visible:outline-2 peer-focus-visible:outline-accent">
        {{ option.label }}
      </span>
    </label>
  </fieldset>
</template>
