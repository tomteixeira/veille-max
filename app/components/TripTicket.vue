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
    <div class="px-5 pt-5">
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
