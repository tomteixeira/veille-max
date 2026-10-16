<!--
  Reminds a traveller who skipped an onboarding step of what is missing, with
  a link back to that step (ticket 12).
-->
<script setup lang="ts">
import { ArrowRight, BellOff, Route, Smartphone } from '@lucide/vue'
import type { OnboardingStep } from '#shared/domain/onboarding'

defineProps<{
  /** The first missing step. */
  step: OnboardingStep
}>()

const BANNERS: Record<OnboardingStep, { icon: typeof Route, title: string, text: string, action: string }> = {
  configuration: {
    icon: Route,
    title: 'Votre week-end type est vide',
    text: 'Ajoutez une route pour que Veille MAX surveille vos trains.',
    action: 'Configurer',
  },
  installation: {
    icon: Smartphone,
    title: 'Veille MAX n’est pas sur l’écran d’accueil',
    text: 'Sur iPhone, c’est indispensable pour recevoir les notifications.',
    action: 'Installer',
  },
  notifications: {
    icon: BellOff,
    title: 'Les notifications sont désactivées',
    text: 'Vous ne serez pas prévenu des nouveaux trains.',
    action: 'Activer',
  },
}
</script>

<template>
  <aside
    aria-label="Configuration à terminer"
    class="flex items-center gap-4 rounded-card bg-accent-soft px-5 py-4"
  >
    <component
      :is="BANNERS[step].icon"
      :size="20"
      :stroke-width="2"
      class="shrink-0 text-accent-ink"
      aria-hidden="true"
    />
    <div class="min-w-0 flex-1">
      <p class="text-sm font-bold">
        {{ BANNERS[step].title }}
      </p>
      <p class="mt-0.5 text-[13px] leading-snug font-medium text-ink-muted">
        {{ BANNERS[step].text }}
      </p>
    </div>
    <NuxtLink
      :to="`/onboarding?step=${step}`"
      class="flex shrink-0 items-center gap-1 rounded-full bg-inverse px-4 py-2 text-[13px] font-bold text-on-inverse transition-opacity hover:opacity-90"
    >
      {{ BANNERS[step].action }}
      <ArrowRight
        :size="14"
        :stroke-width="2.2"
        aria-hidden="true"
      />
    </NuxtLink>
  </aside>
</template>
