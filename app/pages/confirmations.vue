<!--
  « Trajets à confirmer » (ticket 11): the legs booked for tomorrow, which
  SNCF cancels unless they are confirmed on MAX JEUNE before 17:00 today. The
  Confirmation Reminder opens it.
-->
<script setup lang="ts">
import { BadgeCheck, ExternalLink } from '@lucide/vue'
import { CONFIRMATION_DEADLINE, maxJeuneConfirmationLinks } from '#shared/domain/confirmation-reminder'

useHead({ title: 'Trajets à confirmer' })

const { data: list, error } = await useFetch('/api/confirmations')
const bookings = computed(() => list.value?.bookings ?? [])

/** A station's full name; its code if the station reference does not know it. */
function stationName(code: string): string {
  return list.value?.stationNames[code] ?? code
}

const links = maxJeuneConfirmationLinks()

/**
 * Installed on an iPhone, the app would open the MAX JEUNE page in an in-app
 * browser, where the traveller is not logged in: `x-safari-https://` hands it
 * to Safari instead. Where that scheme does nothing, the app is still in front
 * a moment later, and the plain https link opens.
 */
function confirmOnMaxJeune(event: MouseEvent): void {
  const standalone = (navigator as Navigator & { standalone?: boolean }).standalone === true
  if (!standalone) return

  event.preventDefault()
  // Once Safari has the page, the app goes to the background: no fallback when the traveller comes back.
  const fallback = setTimeout(() => {
    if (document.visibilityState === 'visible') window.location.href = links.https
  }, 1500)
  document.addEventListener('visibilitychange', () => clearTimeout(fallback), { once: true })
  window.location.href = links.safari
}
</script>

<template>
  <div>
    <PageHeader
      :eyebrow="`À confirmer avant ${CONFIRMATION_DEADLINE}`"
      title="Trajets à confirmer"
    >
      <p class="mt-2 text-[13px] font-medium text-ink-muted">
        SNCF annule une réservation MAX JEUNE qui n’est pas confirmée avant {{ CONFIRMATION_DEADLINE }} la veille du départ.
      </p>
    </PageHeader>

    <section
      class="mt-5 space-y-3 px-6"
      aria-label="Réservations de demain"
    >
      <SurfaceCard
        v-for="booking in bookings"
        :key="`${booking.tripKey}-${booking.legKind}`"
      >
        <p class="eyebrow flex items-center gap-1.5 text-booked-ink">
          <BadgeCheck
            :size="12"
            :stroke-width="2.2"
            aria-hidden="true"
          />
          {{ LEG_NAMES[booking.legKind] }} · {{ longDayName(booking.train.date) }}
        </p>
        <p class="tnum mt-3 text-2xl leading-none font-extrabold">
          {{ booking.train.departureTime }} → {{ booking.train.arrivalTime }}
        </p>
        <p class="mt-2 text-[13px] font-medium text-ink-muted">
          {{ routeName(booking.train, stationName) }}
        </p>
        <p class="mt-1 text-[11px] font-bold text-ink-muted">
          train {{ booking.train.trainNumber }}
        </p>
      </SurfaceCard>

      <SurfaceCard
        v-if="error"
        class="py-9 text-center"
      >
        <p
          role="alert"
          class="text-[13px] font-semibold text-accent-ink"
        >
          Impossible de charger vos trajets pour l’instant.
        </p>
      </SurfaceCard>
      <SurfaceCard
        v-else-if="bookings.length === 0"
        class="py-9 text-center"
      >
        <p class="text-[17px] font-extrabold">
          Rien à confirmer aujourd’hui
        </p>
        <p class="mt-1 text-[13px] font-medium text-ink-muted">
          Les trajets que vous avez réservés pour demain apparaîtront ici.
        </p>
      </SurfaceCard>

      <a
        :href="links.https"
        target="_blank"
        rel="noopener noreferrer"
        class="flex h-12 items-center justify-center gap-2 rounded-control bg-inverse text-[13px] font-bold text-on-inverse transition-opacity hover:opacity-80"
        @click="confirmOnMaxJeune"
      >
        Confirmer sur MAX JEUNE
        <ExternalLink
          :size="14"
          :stroke-width="2.2"
          aria-hidden="true"
        />
      </a>
      <p class="text-center text-[12px] font-medium text-ink-muted">
        S’ouvre dans Safari, où vous êtes connecté à votre compte MAX JEUNE.
      </p>
    </section>
  </div>
</template>
