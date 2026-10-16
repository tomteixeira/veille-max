<!-- An on/off switch, drawn like iOS's. The parent changes `checked` once the change is done. -->
<script setup lang="ts">
defineProps<{
  checked: boolean
  disabled?: boolean
  /** The id of the text that names the switch. */
  labelledby: string
  describedby?: string
}>()

defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    :aria-labelledby="labelledby"
    :aria-describedby="describedby"
    :disabled="disabled"
    class="relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
    :class="checked ? 'bg-accent' : 'bg-ink-faint'"
    @click="$emit('toggle')"
  >
    <span
      class="absolute top-[2px] size-[27px] rounded-full bg-white shadow transition-all"
      :class="checked ? 'left-[22px]' : 'left-[2px]'"
    />
  </button>
</template>
