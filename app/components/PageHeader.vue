<script setup lang="ts">
defineProps<{
  /** Small line above the title: the date, the page name, a scope. */
  eyebrow: string
  title: string
  /** Optional second line of the title, in the accent colour. */
  accent?: string
}>()
</script>

<template>
  <header class="px-6 pt-14">
    <p class="text-[13px] font-semibold text-ink-muted">
      {{ eyebrow }}
    </p>
    <h1 class="mt-2 text-[31px] leading-[1.08] font-extrabold tracking-tight text-balance">
      {{ title }}
      <template v-if="accent">
        <br>
        <span class="text-accent-ink">{{ accent }}</span>
      </template>
    </h1>
    <slot />
  </header>
</template>
