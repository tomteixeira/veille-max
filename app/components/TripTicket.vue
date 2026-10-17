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
    :aria-labelledby="headingId"
  >
    <div class="flex items-start justify-between gap-2 px-5 pt-5">
      <div>
        <!--
          The chips borrow the eyebrow's line, so every ticket of the carousel keeps the same header height.
          A chip is taller than that line: `-my-2` keeps it from growing the line.
        -->
        <div class="flex items-center gap-2">
          <p class="eyebrow">
            Week-end
          </p>
          <TripChips
            :trip="trip"
            compact
            class="-my-2"
          />
        </div>
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
    <template
      v-for="(kind, index) in LEG_KINDS"
      :key="kind"
    >
      <TicketPerforation v-if="index > 0" />
      <TripLegHalf
        :class="index > 0 ? 'pb-6' : undefined"
        :trip-key="trip.key"
        :leg="trip.legs[kind]"
        :station-name="stationName"
      />
    </template>
  </TicketCard>
</template>
