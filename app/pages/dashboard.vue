<script setup lang="ts">
import { MAX_ACTIVE_BOOKINGS } from '#shared/domain/evaluation'

useHead({ title: 'Dashboard' })

/** The travel days counted: the trip template's weekdays by default, or every day. */
const days = ref<'trip' | 'all'>('trip')
const { data: dashboard } = await useFetch('/api/dashboard', { query: { days } })

const filters = computed(() => [
  { value: 'trip', label: dashboard.value ? weekdaysLabel(dashboard.value.tripWeekdays) : 'Vos jours de voyage' },
  { value: 'all', label: 'Tous les jours' },
] as const)

const emptyText = computed(() => emptyHistoryText(dashboard.value?.since ?? null, dashboard.value?.hasRoutes ?? false))
const curveTitle = computed(() => dashboard.value && curveHeadline(dashboard.value.curve.peaks))
const slotTitle = computed(() => dashboard.value && slotHeadline(dashboard.value.slots))
const lifetimeTitle = computed(() => dashboard.value && lifetimeHeadline(dashboard.value.lifetimes))
const activeBookings = computed(() => dashboard.value?.bookings.active ?? 0)

// Decorative silhouette of the opening curve, shown until real history exists.
const ghostBarHeights = [36, 52, 68, 44, 28, 24, 20, 24, 18, 16, 20, 28, 48, 60, 40, 24, 18, 16, 20, 24, 32, 44, 56, 36, 20]
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="dashboardScope(dashboard?.since ?? null)"
      title="Dashboard"
    >
      <div
        class="mt-4 flex flex-wrap gap-2"
        role="group"
        aria-label="Jours de voyage"
      >
        <button
          v-for="filter in filters"
          :key="filter.value"
          type="button"
          class="h-9 rounded-full px-4 text-[13px] font-bold transition"
          :class="days === filter.value ? 'bg-inverse text-on-inverse' : 'bg-surface text-ink-muted'"
          :aria-pressed="days === filter.value"
          @click="days = filter.value"
        >
          {{ filter.label }}
        </button>
      </div>
    </PageHeader>

    <div class="mt-5 space-y-4 px-6">
      <SurfaceCard
        as="section"
        aria-label="Réservations"
      >
        <div class="flex items-center gap-5">
          <p class="tnum shrink-0 text-[52px] leading-none font-extrabold tracking-tight">
            {{ activeBookings }}<span class="text-ink-faint">/{{ MAX_ACTIVE_BOOKINGS }}</span>
          </p>
          <div>
            <p class="text-sm font-bold">
              {{ bookedTripsText(activeBookings) }}
            </p>
            <div
              class="mt-2 flex gap-1.5"
              aria-hidden="true"
            >
              <span
                v-for="slot in MAX_ACTIVE_BOOKINGS"
                :key="slot"
                class="size-2.5 rounded-full"
                :class="slot <= activeBookings ? 'bg-booked' : 'bg-line'"
              />
            </div>
            <p class="mt-2 text-xs font-medium text-ink-muted">
              {{ bookingPaceText(dashboard?.bookings.averageDaysBefore ?? null) }}
            </p>
          </div>
        </div>
        <template v-if="dashboard && dashboard.bookings.past.length > 0">
          <p class="eyebrow mt-5">
            Réservations passées
          </p>
          <ul class="mt-2 divide-y divide-line">
            <li
              v-for="booking in dashboard.bookings.past"
              :key="`${booking.tripKey}/${booking.legKind}`"
              class="flex items-center justify-between gap-3 py-2"
            >
              <span class="tnum min-w-0 text-xs font-bold">
                {{ historyLegLabel({ kind: booking.legKind, date: booking.train.date }) }} · {{ booking.train.departureTime }}
              </span>
              <AppChip tone="booked">
                Réservé à J-{{ booking.daysBefore }}
              </AppChip>
            </li>
          </ul>
        </template>
      </SurfaceCard>

      <SurfaceCard
        as="section"
        aria-labelledby="curve-title"
      >
        <p class="eyebrow">
          Sorties de places
        </p>
        <h2
          id="curve-title"
          class="mt-1 text-[19px] leading-snug font-extrabold tracking-tight"
        >
          {{ curveTitle ?? 'Vos premières tendances arrivent après quelques matins de veille.' }}
        </h2>
        <template v-if="dashboard && curveTitle">
          <div class="mt-5">
            <OpeningCurveChart
              :columns="dashboard.curve.columns"
              :peaks="dashboard.curve.peaks"
            />
          </div>
          <p class="mt-2 text-xs font-medium text-ink-muted">
            {{ dashboard.curve.total }} place{{ dashboard.curve.total > 1 ? 's' : '' }} apparue{{ dashboard.curve.total > 1 ? 's' : '' }}, selon le nombre de jours avant le départ. Touchez une barre.
          </p>
        </template>
        <template v-else>
          <div
            class="mt-5 flex h-28 items-end gap-0.5"
            aria-hidden="true"
          >
            <span
              v-for="(height, index) in ghostBarHeights"
              :key="index"
              class="flex-1 rounded-t-[4px] bg-surface-muted"
              :style="{ height: `${height}%` }"
            />
          </div>
          <p class="mt-3 text-xs font-medium text-ink-muted">
            {{ emptyText }}
          </p>
        </template>
      </SurfaceCard>

      <SurfaceCard
        as="section"
        aria-labelledby="slots-title"
      >
        <p class="eyebrow">
          Créneaux
        </p>
        <h2
          id="slots-title"
          class="mt-1 text-[19px] leading-snug font-extrabold tracking-tight"
        >
          {{ slotTitle ?? 'Les meilleurs créneaux apparaîtront ici.' }}
        </h2>
        <div
          v-if="dashboard && slotTitle"
          class="mt-4"
        >
          <SlotHeatmap :grid="dashboard.slots" />
        </div>
        <p
          v-else
          class="mt-3 text-xs font-medium text-ink-muted"
        >
          {{ emptyText }}
        </p>
      </SurfaceCard>

      <SurfaceCard
        as="section"
        aria-labelledby="lifetimes-title"
      >
        <p class="eyebrow">
          Durée de vie
        </p>
        <h2
          id="lifetimes-title"
          class="mt-1 text-[19px] leading-snug font-extrabold tracking-tight"
        >
          {{ lifetimeTitle ?? 'Combien de temps une place reste, bientôt ici.' }}
        </h2>
        <template v-if="dashboard && lifetimeTitle">
          <div class="mt-4">
            <LifetimeBars :buckets="dashboard.lifetimes.buckets" />
          </div>
          <p class="mt-3 text-xs font-medium text-ink-muted">
            Temps pendant lequel une place reste disponible avant d’être prise, sur {{ dashboard.lifetimes.total }} place{{ dashboard.lifetimes.total > 1 ? 's' : '' }}.
          </p>
        </template>
        <p
          v-else
          class="mt-3 text-xs font-medium text-ink-muted"
        >
          {{ emptyText }}
        </p>
      </SurfaceCard>

      <LegHistoryCard
        :legs="dashboard?.legs ?? []"
        :empty-text="emptyText"
      />
    </div>
  </div>
</template>
