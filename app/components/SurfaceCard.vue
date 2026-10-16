<script setup lang="ts">
withDefaults(defineProps<{
  as?: 'article' | 'section' | 'div'
}>(), {
  as: 'article',
})
</script>

<template>
  <component
    :is="as"
    class="rounded-card bg-surface p-5"
  >
    <slot />
  </component>
</template>
