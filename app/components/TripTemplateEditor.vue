<!--
  The default configuration editor: the trip template as a ticket whose halves
  open their leg's editor in a bottom sheet. In Réglages, and as the first
  onboarding step (ticket 12).
-->
<script setup lang="ts">
import type { LegKind, TemplateLeg } from '#shared/domain/trip-template'

const emit = defineEmits<{
  /** A leg of the template was saved. */
  saved: []
}>()

const { template, stations, status, refresh, stationName, saveLeg } = await useTripTemplate()

/** The leg whose editor is open in the bottom sheet. */
const editing = ref<LegKind | null>(null)
const editorTitleId = useId()
const interactive = useInteractive()

async function save(kind: LegKind, leg: TemplateLeg): Promise<void> {
  await saveLeg(kind, leg)
  emit('saved')
}
</script>

<template>
  <div>
    <TicketCard v-if="template">
      <template
        v-for="(kind, index) in LEG_KINDS"
        :key="kind"
      >
        <TicketPerforation v-if="index > 0" />
        <LegHalf
          :kind="kind"
          :day="WEEKDAY_NAMES[template[kind].weekday]"
          :leg="template[kind]"
          :station-name="stationName"
          :disabled="!interactive"
          @edit="editing = kind"
        />
      </template>
    </TicketCard>
    <SurfaceCard v-else-if="status === 'error'">
      <p
        role="alert"
        class="text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Impossible de charger votre week-end type pour l’instant.
      </p>
      <button
        type="button"
        :disabled="!interactive"
        class="mt-3 h-11 w-full rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
        @click="refresh()"
      >
        Réessayer
      </button>
    </SurfaceCard>

    <BottomSheet
      :open="editing !== null"
      :labelledby="editorTitleId"
      @close="editing = null"
    >
      <LegEditor
        v-if="editing && template"
        :key="editing"
        :kind="editing"
        :title="`${LEG_NAMES[editing]} par défaut`"
        :day="template[editing].weekday"
        :days="WEEKDAY_CHOICES"
        :leg="template[editing]"
        :stations="stations"
        :station-name="stationName"
        :title-id="editorTitleId"
        :save="(weekday, leg) => save(editing!, { ...leg, weekday })"
        @close="editing = null"
      />
    </BottomSheet>
  </div>
</template>
