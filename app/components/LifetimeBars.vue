<!--
  The opening lifetimes of the dashboard, as horizontal bars: the share of the
  seats seen taken, by how long they stayed open. The shortest range, the one
  to react to, is emphasised.
-->
<script setup lang="ts">
import type { LifetimeBucket } from '#shared/domain/opening-history'

const props = defineProps<{
  buckets: readonly LifetimeBucket[]
}>()

const highest = computed(() => Math.max(1, ...props.buckets.map(bucket => bucket.percent)))
</script>

<template>
  <ul class="space-y-2">
    <li
      v-for="(bucket, index) in buckets"
      :key="bucket.fromDays"
      class="flex items-center gap-3"
    >
      <span class="w-12 shrink-0 text-xs font-semibold text-ink-muted">{{ lifetimeLabel(bucket) }}</span>
      <span class="flex h-6 flex-1 items-center">
        <span
          class="h-full rounded-r-[4px]"
          :class="index === 0 ? 'bg-accent' : 'bg-accent/30 dark:bg-accent/35'"
          :style="{ width: `${bucket.percent / highest * 80}%` }"
        />
        <span class="tnum ml-2 text-xs font-bold whitespace-nowrap">{{ bucket.percent }} %</span>
      </span>
    </li>
  </ul>
</template>
