<!-- The leg view (spec, "Leg detail"): every candidate of a leg as a ticket, in ranking order. -->
<script setup lang="ts">
import { ChevronLeft, Clock, ExternalLink } from '@lucide/vue'
import { liveCheckLink } from '#shared/domain/sncf-connect'

const route = useRoute()
const key = computed(() => String(route.params.key))
const kind = computed(() => String(route.params.kind))

const [lastSnapshot, { data: view, error }] = await Promise.all([
  useLastSnapshotTime(),
  useFetch(() => `/api/trips/${key.value}/legs/${kind.value}`),
])

const leg = computed(() => view.value?.leg ?? null)
useHead({ title: () => leg.value ? `${LEG_NAMES[leg.value.kind]} · ${shortDay(leg.value.date)}` : 'Trajet' })

/** A station's full name; its code if the station reference does not know it. */
function stationName(code: string): string {
  return view.value?.stationNames[code] ?? code
}

const banner = computed(() => leg.value && windowBanner(leg.value.settings))
const liveCheck = computed(() => leg.value && liveCheckLink(leg.value))

/** The route rank the tickets are filtered on, `null` for « Tous ». */
const routeFilter = ref<number | null>(null)
const filters = computed(() => [
  { rank: null, label: 'Tous' },
  ...(leg.value?.settings.routes ?? []).map((route, index) => ({ rank: index + 1, label: `${index + 1} · ${routeName(route, stationName)}` })),
])
const shownCandidates = computed(() => (leg.value?.candidates ?? [])
  .filter(candidate => routeFilter.value === null || candidate.routeRank === routeFilter.value))
</script>

<template>
  <div>
    <header class="px-6 pt-12">
      <NuxtLink
        to="/"
        class="grid size-10 place-items-center rounded-full bg-surface"
      >
        <ChevronLeft
          :size="18"
          :stroke-width="2.2"
          aria-hidden="true"
        />
        <span class="sr-only">Retour à l’accueil</span>
      </NuxtLink>

      <template v-if="leg && banner">
        <p class="mt-5 eyebrow">
          {{ LEG_NAMES[leg.kind] }} · {{ longDayName(leg.date) }}
        </p>
        <h1 class="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">
          {{ legHeadline(leg) }}
        </h1>
        <p class="mt-4 flex items-center gap-2.5 rounded-control bg-surface px-4 py-3 text-[13px] font-semibold">
          <Clock
            :size="16"
            class="shrink-0 text-accent-ink"
            aria-hidden="true"
          />
          <span>{{ banner.window }}</span>
          <span
            class="text-ink-faint"
            aria-hidden="true"
          >·</span>
          <span class="text-ink-muted">{{ banner.ideal }}</span>
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
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

        <div
          v-if="leg.candidates.length"
          role="group"
          aria-label="Filtrer par route"
          class="no-scrollbar -mx-6 mt-5 flex gap-2 overflow-x-auto px-6"
        >
          <button
            v-for="filter in filters"
            :key="filter.label"
            type="button"
            :aria-pressed="routeFilter === filter.rank"
            class="h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition"
            :class="routeFilter === filter.rank ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink-muted'"
            @click="routeFilter = filter.rank"
          >
            {{ filter.label }}
          </button>
        </div>
      </template>
      <template v-else>
        <h1 class="mt-5 text-[28px] leading-tight font-extrabold tracking-tight">
          {{ error?.statusCode === 404 ? 'Ce trajet n’est pas suivi' : 'Trajet indisponible' }}
        </h1>
        <p class="mt-2 text-[13px] font-medium text-ink-muted">
          {{ error?.statusCode === 404 ? 'Seuls les week-ends des 30 prochains jours sont suivis.' : 'Impossible de charger ce trajet pour l’instant.' }}
        </p>
      </template>
    </header>

    <section
      v-if="leg"
      class="mt-4 space-y-3 px-6"
      aria-label="Trains"
    >
      <!-- The best candidate is the first of the ranking: `leg.best` is a copy of it once fetched. -->
      <!-- The best candidate is the first of the ranking: `leg.best` is a copy of it once fetched. -->
      <CandidateTicket
        v-for="candidate in shownCandidates"
        :key="`${candidate.train.trainNumber}-${candidate.train.originCode}-${candidate.train.destinationCode}`"
        :candidate="candidate"
        :best="candidate === leg.candidates[0]"
        :route-weight="view!.routeWeight"
        :station-name="stationName"
      />
      <SurfaceCard
        v-if="leg.candidates.length === 0 && leg.status !== 'past'"
        class="py-9 text-center"
      >
        <p class="text-[17px] font-extrabold">
          Pas encore de place
        </p>
        <p class="mt-1 text-[13px] font-medium text-ink-muted">
          On vous prévient dès qu’un train apparaît sur vos routes.
        </p>
      </SurfaceCard>

      <a
        v-if="liveCheck && leg.status !== 'past'"
        :href="liveCheck"
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-12 items-center justify-center gap-2 rounded-control border-2 border-dashed border-line text-[13px] font-bold text-ink-muted transition-opacity hover:opacity-80"
      >
        Vérifier en direct sur SNCF Connect
        <ExternalLink
          :size="14"
          :stroke-width="2.2"
          aria-hidden="true"
        />
      </a>
    </section>
  </div>
</template>
