<script setup lang="ts">
import { ChartLine, House, SlidersHorizontal } from '@lucide/vue'

const tabs = [
  { to: '/', label: 'Accueil', icon: House },
  { to: '/dashboard', label: 'Dashboard', icon: ChartLine },
  { to: '/settings', label: 'Réglages', icon: SlidersHorizontal },
] as const

const route = useRoute()

// A tab stays active on the pages nested under it (e.g. a leg detail under Accueil).
function isActive(to: string): boolean {
  return to === '/' ? route.path === '/' : route.path === to || route.path.startsWith(`${to}/`)
}
</script>

<template>
  <nav
    aria-label="Navigation principale"
    class="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-30 flex justify-center"
  >
    <ul class="pointer-events-auto flex h-14 items-center gap-1 rounded-full bg-inverse px-2 text-on-inverse-muted shadow-float">
      <li
        v-for="tab in tabs"
        :key="tab.to"
      >
        <NuxtLink
          :to="tab.to"
          :aria-current="isActive(tab.to) ? 'page' : undefined"
          class="flex h-10 items-center gap-2 rounded-full px-4 text-[13px] font-bold transition-colors duration-200"
          :class="isActive(tab.to) ? 'bg-on-inverse/10 text-on-inverse' : 'hover:text-on-inverse'"
        >
          <component
            :is="tab.icon"
            :size="18"
            :stroke-width="2"
            aria-hidden="true"
          />
          <span :class="isActive(tab.to) ? '' : 'sr-only'">{{ tab.label }}</span>
        </NuxtLink>
      </li>
    </ul>
  </nav>
</template>
