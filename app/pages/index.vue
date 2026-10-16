<script setup lang="ts">
import { ArrowRight, BellRing, Route, Sunrise } from '@lucide/vue'
import { MAX_ACTIVE_BOOKINGS } from '#shared/domain/evaluation'

useHead({ title: 'Accueil' })

// Computed once on the server so the hydrated page shows the same day.
const today = useState('home-today', () => formatParisLongDay(new Date()))
const [lastSnapshot, { data: home }, { progress, missing }] = await Promise.all([
  useLastSnapshotTime(),
  useFetch('/api/home'),
  useOnboarding(),
])

// After their first sign-in, a traveller goes through onboarding before anything else.
if (progress.value && progress.value.current !== 'done') await navigateTo('/onboarding', { replace: true })

const trips = computed(() => home.value?.trips ?? [])
const upcoming = computed(() => home.value?.upcoming ?? [])
const headline = computed(() => home.value?.hasRoutes
  ? { title: `${trips.value.length} week-end${trips.value.length > 1 ? 's' : ''}`, accent: 'sous surveillance.' }
  : { title: 'Rien à surveiller', accent: 'pour l’instant.' })

/** A station's full name; its code if the station reference does not know it. */
function stationName(code: string): string {
  return home.value?.stationNames[code] ?? code
}

// Placeholder halves until the traveller ranks a route in their trip template.
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
      :title="headline.title"
      :accent="headline.accent"
    >
      <div class="mt-4 flex flex-wrap gap-2">
        <AppChip
          tone="surface"
          class="tnum"
        >
          {{ home?.activeBookings ?? 0 }}/{{ MAX_ACTIVE_BOOKINGS }} réservés
        </AppChip>
        <AppChip
          v-if="lastSnapshot"
          tone="surface"
          class="tnum"
        >
          <span><span class="text-ink-muted">Dernier instantané :</span> {{ lastSnapshot }}</span>
        </AppChip>
        <AppChip
          v-else
          tone="surface"
        >
          <span class="text-ink-muted">En attente du premier instantané</span>
        </AppChip>
      </div>
    </PageHeader>

    <OnboardingBanner
      v-if="missing[0]"
      :step="missing[0]"
      class="mx-6 mt-6"
    />

    <section
      v-if="home?.hasRoutes"
      class="mt-7"
      aria-label="Vos week-ends"
    >
      <div class="no-scrollbar flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto px-6 pb-4">
        <TripTicket
          v-for="trip in trips"
          :key="trip.key"
          :trip="trip"
          :station-name="stationName"
          class="w-[302px] shrink-0 snap-start"
        />
      </div>
    </section>

    <section
      v-if="home?.hasRoutes && upcoming.length > 0"
      class="mt-6 px-6"
      aria-labelledby="upcoming-title"
    >
      <h2
        id="upcoming-title"
        class="text-base font-extrabold tracking-tight"
      >
        Bientôt ouverts
      </h2>
      <ul class="mt-3 divide-y divide-line rounded-card bg-surface">
        <li
          v-for="trip in upcoming"
          :key="trip.key"
          class="flex items-center gap-3 px-5 py-4"
          :aria-label="`Week-end du ${tripTitle(trip)}`"
        >
          <div class="min-w-0 flex-1">
            <p class="text-sm font-bold">
              {{ tripTitle(trip) }}
            </p>
            <p class="tnum mt-0.5 text-[13px] font-medium text-ink-muted">
              {{ opensOnText(trip.opensOn) }}
            </p>
            <TripChips
              :trip="trip"
              class="mt-1.5"
            />
          </div>
          <NuxtLink
            :to="`/trips/${trip.key}`"
            class="shrink-0 rounded-full bg-inverse px-4 py-2 text-[13px] font-bold text-on-inverse transition-opacity hover:opacity-90"
          >
            Préparer<span class="sr-only"> le week-end du {{ tripTitle(trip) }}</span>
          </NuxtLink>
        </li>
      </ul>
    </section>

    <section
      v-if="!home?.hasRoutes"
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
      v-if="!home?.hasRoutes"
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
