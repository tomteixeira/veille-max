<!--
  A trip's page, tracked or upcoming: its two legs drawn as a ticket, each one
  editable in a bottom sheet. The first change customises the trip
  (« Personnalisé »); « Réinitialiser » gives it back to the trip template. The
  whole trip, or one of its legs, can be muted (« En sourdine »).
-->
<script setup lang="ts">
import { ChevronLeft } from '@lucide/vue'
import { legDateChoices } from '#shared/domain/evaluation'
import type { LegKind } from '#shared/domain/trip-template'
import type { ParisDate } from '#shared/utils/paris-time'

const route = useRoute()
const key = String(route.params.key)

const { trip, stations, status, refresh, stationName, saveLeg, reset, mute } = await useTrip(key)
const interactive = useInteractive()

const title = computed(() => (trip.value ? tripTitle(trip.value) : ''))
useHead({ title: () => (title.value ? `Week-end du ${title.value}` : 'Week-end') })

/** The day an upcoming trip enters the tracking horizon; `null` for a tracked trip. */
const opensOn = computed(() => (trip.value && 'opensOn' in trip.value ? trip.value.opensOn : null))

/** The leg whose editor is open in the bottom sheet. */
const editing = ref<LegKind | null>(null)
const editorTitleId = useId()

function dayChoices(kind: LegKind) {
  return trip.value ? dateChoices(legDateChoices(trip.value, kind, new Date())) : []
}

// Mutes and « Réinitialiser » apply at once; the page shows when they fail.
const busy = ref(false)
const actionFailed = ref(false)

async function act(action: () => Promise<void>) {
  busy.value = true
  actionFailed.value = false
  try {
    await action()
  }
  catch {
    actionFailed.value = true
  }
  finally {
    busy.value = false
  }
}
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

      <template v-if="trip">
        <p class="mt-5 eyebrow">
          {{ opensOn ? `Bientôt ouvert · ${opensOnText(opensOn)}` : 'Week-end' }}
        </p>
        <h1 class="mt-1 text-[28px] leading-tight font-extrabold tracking-tight">
          {{ title }}
        </h1>
        <div
          v-if="trip.customised"
          class="mt-3 flex items-center gap-2"
        >
          <AppChip tone="surface">
            Personnalisé
          </AppChip>
          <button
            type="button"
            :disabled="!interactive || busy"
            class="rounded-full bg-inverse px-3 py-1.5 text-xs font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
            @click="act(reset)"
          >
            Réinitialiser
          </button>
        </div>
        <p
          v-else
          class="mt-2 text-[13px] font-medium text-ink-muted"
        >
          Suit votre week-end type. Touchez l’aller ou le retour pour le modifier, pour ce week-end seulement.
        </p>
      </template>
    </header>

    <template v-if="trip">
      <p
        v-if="actionFailed"
        role="alert"
        class="mx-6 mt-4 text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Enregistrement impossible pour l’instant. Réessayez dans un moment.
      </p>

      <SurfaceCard class="mx-6 mt-5">
        <AppSwitch
          :model-value="trip.muted"
          label="Mettre le week-end en sourdine"
          hint="Ses trains restent affichés, sans aucune notification."
          :disabled="!interactive || busy"
          @update:model-value="muted => act(() => mute(muted))"
        />
      </SurfaceCard>

      <TicketCard class="mx-6 mt-4">
        <template
          v-for="(kind, index) in LEG_KINDS"
          :key="kind"
        >
          <TicketPerforation v-if="index > 0" />
          <LegHalf
            :kind="kind"
            :day="longDayName(trip.legs[kind].date)"
            :leg="trip.legs[kind].settings"
            :station-name="stationName"
            :disabled="!interactive"
            @edit="editing = kind"
          >
            <AppSwitch
              :model-value="trip.legs[kind].muted"
              :label="`Mettre ${LEG_NAMES_IN_SENTENCE[kind]} en sourdine`"
              :disabled="!interactive || busy || trip.muted"
              @update:model-value="muted => act(() => mute(muted, kind))"
            />
          </LegHalf>
        </template>
      </TicketCard>

      <BottomSheet
        :open="editing !== null"
        :labelledby="editorTitleId"
        @close="editing = null"
      >
        <LegEditor
          v-if="editing"
          :key="editing"
          :kind="editing"
          :title="`${LEG_NAMES[editing]} du ${title}`"
          :day="trip.legs[editing].date"
          :days="dayChoices(editing)"
          :leg="trip.legs[editing].settings"
          :stations="stations"
          :station-name="stationName"
          :title-id="editorTitleId"
          :save="(date: ParisDate, leg) => saveLeg(editing!, date, leg)"
          @close="editing = null"
        />
      </BottomSheet>
    </template>

    <SurfaceCard
      v-else
      class="mx-6 mt-5"
    >
      <p
        v-if="status === 'error'"
        role="alert"
        class="text-[13px] leading-snug font-semibold text-accent-ink"
      >
        Impossible de charger ce week-end pour l’instant.
      </p>
      <p
        v-else
        class="text-[13px] leading-snug font-medium text-ink-muted"
      >
        Ce week-end n’est pas suivi : il est passé, ou trop loin pour être préparé.
      </p>
      <button
        v-if="status === 'error'"
        type="button"
        :disabled="!interactive"
        class="mt-3 h-11 w-full rounded-control bg-surface-muted text-[13px] font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
        @click="refresh()"
      >
        Réessayer
      </button>
    </SurfaceCard>
  </div>
</template>
