<script setup lang="ts">
import { ArrowRight, BellRing, Route, Sunrise } from '@lucide/vue'

useHead({ title: 'Accueil' })

// Computed once on the server so the hydrated page shows the same day.
const today = useState('home-today', () => formatParisLongDay(new Date()))

// Placeholder halves until the traveller has a trip template (ticket 03).
const legs = [
  { kind: 'Aller', weekday: 'Vendredi' },
  { kind: 'Retour', weekday: 'Dimanche' },
] as const

const steps = [
  {
    icon: Route,
    title: 'Décrivez votre week-end type',
    text: 'Vos routes par ordre de préférence, une fenêtre horaire et une heure idéale, pour l’aller comme pour le retour.',
  },
  {
    icon: Sunrise,
    title: 'Chaque matin, on lit les places SNCF',
    text: 'Tous les trains avec une place MAX JEUNE sur vos routes, classés pour chaque week-end des 30 prochains jours.',
  },
  {
    icon: BellRing,
    title: 'Vous êtes prévenu du meilleur train',
    text: 'Une notification dès qu’un train plus intéressant sort, et un rappel la veille pour confirmer votre billet.',
  },
] as const
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="today"
      title="Rien à surveiller"
      accent="pour l’instant."
    >
      <div class="mt-4 flex flex-wrap gap-2">
        <AppChip
          tone="surface"
          class="tnum"
        >
          0/6 réservés
        </AppChip>
        <AppChip tone="surface">
          <span class="text-ink-muted">En attente du premier instantané</span>
        </AppChip>
      </div>
    </PageHeader>

    <section
      class="mt-7 px-6"
      aria-labelledby="first-trip-title"
    >
      <TicketCard>
        <div class="px-5 pt-5">
          <p class="eyebrow">
            Votre premier week-end
          </p>
          <h2
            id="first-trip-title"
            class="mt-0.5 text-xl font-extrabold tracking-tight"
          >
            À configurer
          </h2>
        </div>

        <template
          v-for="(leg, index) in legs"
          :key="leg.kind"
        >
          <TicketPerforation v-if="index > 0" />
          <div class="px-5 py-3">
            <div class="flex items-center justify-between">
              <span class="eyebrow">{{ leg.kind }} · {{ leg.weekday }}</span>
              <AppChip>En attente</AppChip>
            </div>
            <p class="mt-2 text-[26px] leading-9 font-extrabold tracking-tight text-ink-faint">
              Aucun train
            </p>
            <p class="mt-2 text-[13px] font-medium text-ink-muted">
              Aucune route pour l’instant
            </p>
          </div>
        </template>

        <div class="px-5 pt-2 pb-5">
          <NuxtLink
            to="/settings"
            class="flex h-12 items-center justify-center gap-2 rounded-control bg-inverse text-sm font-bold text-on-inverse transition-opacity hover:opacity-90"
          >
            Configurer mon week-end type
            <ArrowRight
              :size="16"
              :stroke-width="2.2"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>
      </TicketCard>
    </section>

    <section
      class="mt-8 px-6"
      aria-labelledby="how-it-works-title"
    >
      <h2
        id="how-it-works-title"
        class="text-base font-extrabold tracking-tight"
      >
        Comment ça marche
      </h2>
      <ol class="mt-3 divide-y divide-line rounded-card bg-surface">
        <li
          v-for="step in steps"
          :key="step.title"
          class="flex gap-4 px-5 py-4"
        >
          <span class="grid size-10 shrink-0 place-items-center rounded-control bg-accent-soft text-accent-ink">
            <component
              :is="step.icon"
              :size="18"
              :stroke-width="2"
              aria-hidden="true"
            />
          </span>
          <div>
            <p class="text-sm font-bold">
              {{ step.title }}
            </p>
            <p class="mt-0.5 text-[13px] leading-snug font-medium text-ink-muted">
              {{ step.text }}
            </p>
          </div>
        </li>
      </ol>
    </section>
  </div>
</template>
