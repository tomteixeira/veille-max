<!-- A tracked trip on the home screen: a ticket with its Aller and Retour halves. -->
<script setup lang="ts">
import type { Trip } from '#shared/domain/evaluation'

const props = defineProps<{
  trip: Trip
  stationName: (code: string) => string
}>()

const headingId = useId()
const title = computed(() => tripTitle(props.trip))
</script>

<template>
  <TicketCard
    class="pb-3"
    :aria-labelledby="headingId"
  >
    <div class="flex items-start justify-between gap-2 px-5 pt-5">
      <div>
        <p class="eyebrow">
          Week-end
        </p>
        <h2
          :id="headingId"
          class="mt-0.5 text-xl font-extrabold tracking-tight"
        >
          {{ title }}
        </h2>
      </div>
      <NuxtLink
        :to="`/trips/${trip.key}`"
        class="rounded-full bg-surface-muted px-2.5 py-1 text-[11px] font-bold transition-opacity hover:opacity-80"
      >
        Modifier<span class="sr-only"> le week-end du {{ title }}</span>
      </NuxtLink>
    </div>
    <TripChips
      :trip="trip"
      class="px-5 pt-2"
    />
    <template
      v-for="(kind, index) in LEG_KINDS"
      :key="kind"
    >
      <TicketPerforation v-if="index > 0" />
      <TripLegHalf
        :trip-key="trip.key"
        :leg="trip.legs[kind]"
        :station-name="stationName"
      />
    </template>
  </TicketCard>
</template>
