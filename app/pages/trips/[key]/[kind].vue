<!-- The leg view (spec, "Leg detail"): the leg's booking, and every candidate of the leg as a ticket, in ranking order. -->
<script setup lang="ts">
import { ChevronLeft, Clock, ExternalLink, TicketPlus } from '@lucide/vue'
import { sameTrain, type BookedTrain, type Candidate } from '#shared/domain/evaluation'
import { liveCheckLink } from '#shared/domain/sncf-connect'
import { isLegKind } from '#shared/domain/trip-template'
import { cancelBooking, saveBooking } from '#shared/utils/booking-store'

const route = useRoute()
const key = computed(() => String(route.params.key))
const kind = computed(() => String(route.params.kind))

const [lastSnapshot, { data: view, error, refresh }] = await Promise.all([
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

// Bookings are written straight to Supabase under RLS (spec, "Settings writes"), then the leg is ranked again.
const supabase = useSupabaseClient()
const travellerId = useSupabaseUser().value?.sub
const interactive = useInteractive()
const saving = ref(false)
const bookingFailed = ref(false)

const booking = computed(() => leg.value?.booking ?? null)

/** Whether a candidate ranks strictly above the booking: the first `candidatesAbove` of the ranking. */
function betterThanBooking(candidate: Candidate): boolean {
  return booking.value !== null && leg.value!.candidates.indexOf(candidate) < booking.value.candidatesAbove
}

async function changeBooking(change: () => Promise<void>): Promise<void> {
  saving.value = true
  bookingFailed.value = false
  try {
    await change()
    await refresh()
  }
  finally {
    saving.value = false
  }
}

/** Declares `train` as the leg's booking, replacing the one held, if any. */
/** The leg kind of the URL, `null` when it names no leg (the view then shows « not tracked »). */
const legKind = computed(() => isLegKind(kind.value) ? kind.value : null)

async function book(train: BookedTrain): Promise<void> {
  const legKindValue = legKind.value
  if (!travellerId) throw new Error('No signed-in traveller')
  if (!legKindValue) throw new Error('No leg to book')
  const { date, trainNumber, originCode, destinationCode, departureTime, arrivalTime } = train
  await changeBooking(() => saveBooking(supabase, travellerId, {
    tripKey: key.value,
    legKind: legKindValue,
    train: { date, trainNumber, originCode, destinationCode, departureTime, arrivalTime },
  }))
}

async function bookCandidate(candidate: Candidate): Promise<void> {
  await book(candidate.train).catch(() => {
    bookingFailed.value = true
  })
}

async function cancel(): Promise<void> {
  const legKindValue = legKind.value
  await changeBooking(async () => {
    if (!travellerId) throw new Error('No signed-in traveller')
    if (!legKindValue) throw new Error('No leg to cancel')
    await cancelBooking(supabase, travellerId, key.value, legKindValue)
  }).catch(() => {
    bookingFailed.value = true
  })
}

const pickerOpen = ref(false)
const pickerTitleId = useId()
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

    <div
      v-if="leg"
      class="mt-4 space-y-3 px-6"
    >
      <p
        v-if="bookingFailed"
        role="alert"
        class="text-[13px] font-bold text-accent-ink"
      >
        Impossible d’enregistrer la réservation. Réessayez.
      </p>
      <BookingTicket
        v-if="booking"
        :booking="booking"
        :route-weight="view!.routeWeight"
        :station-name="stationName"
        :past="leg.status === 'past'"
        :disabled="!interactive || saving"
        @cancel="cancel"
      />
      <button
        v-if="leg.status !== 'past'"
        type="button"
        class="flex h-12 w-full items-center justify-center gap-2 rounded-control bg-surface text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-50"
        :disabled="!interactive || saving"
        @click="pickerOpen = true"
      >
        <TicketPlus
          :size="16"
          :stroke-width="2.2"
          aria-hidden="true"
        />
        {{ booking ? 'Déclarer une autre réservation' : 'Déclarer une réservation' }}
      </button>
    </div>

    <BottomSheet
      :open="pickerOpen"
      :labelledby="pickerTitleId"
      @close="pickerOpen = false"
    >
      <BookingPicker
        v-if="pickerOpen && leg"
        :trip-key="key"
        :kind="leg.kind"
        :booked="booking?.train ?? null"
        :station-name="stationName"
        :title-id="pickerTitleId"
        :pick="book"
        @close="pickerOpen = false"
      />
    </BottomSheet>

    <section
      v-if="leg"
      class="mt-3 space-y-3 px-6"
      aria-label="Trains"
    >
      <!-- The best candidate is the first of the ranking: `leg.best` is a copy of it once fetched. -->
      <CandidateTicket
        v-for="candidate in shownCandidates"
        :key="`${candidate.train.trainNumber}-${candidate.train.originCode}-${candidate.train.destinationCode}`"
        :candidate="candidate"
        :best="candidate === leg.candidates[0]"
        :route-weight="view!.routeWeight"
        :station-name="stationName"
        :booked="booking !== null && sameTrain(booking.train, candidate.train)"
        :better-than-booking="betterThanBooking(candidate)"
        :disabled="!interactive || saving"
        @book="bookCandidate(candidate)"
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
