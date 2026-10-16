<!--
  Edits one leg, of the trip template or of a trip, inside a <BottomSheet />:
  its day (a weekday or a date), time window, ideal time and ranked routes.
  Changes stay a draft until « OK » saves them; « Annuler » drops them.
  The window is edited as a single bound (« Arriver avant 10:00 »), although
  the domain accepts both bounds: a window with both keeps them until the
  traveller changes its bound or its time.
-->
<script setup lang="ts" generic="Day extends string | number">
import { Check, ChevronDown, ChevronUp, X } from '@lucide/vue'
import {
  addRoute,
  moveRoute,
  removeRoute,
  routeProblem,
  type LegKind,
  type LegSettings,
  type RouteProblem,
  type Station,
  type TimeAnchor,
} from '#shared/domain/trip-template'

const props = defineProps<{
  kind: LegKind
  /** The sheet's title: « Aller par défaut », « Aller du 23 – 25 oct. ». */
  title: string
  /** The day the leg runs, among `days`. */
  day: Day
  days: readonly DayChoice<Day>[]
  leg: LegSettings
  stations: readonly Station[]
  stationName: (code: string) => string
  /** The leg's title, also naming the sheet (`aria-labelledby`). */
  titleId: string
  save: (day: Day, leg: LegSettings) => Promise<void>
}>()

const emit = defineEmits<{ close: [] }>()

const ids = { window: useId(), windowTime: useId(), idealTime: useId(), routes: useId() }

type Bound = 'before' | 'after'

/** The single bound the editor shows: the end of the window if it has one, else its start. */
function initialBound({ anchor, window }: LegSettings): { bound: Bound, time: string } {
  if (window.start && window.end) return anchor === 'arrival' ? { bound: 'before', time: window.end } : { bound: 'after', time: window.start }
  if (window.end) return { bound: 'before', time: window.end }
  if (window.start) return { bound: 'after', time: window.start }
  return { bound: anchor === 'arrival' ? 'before' : 'after', time: '' }
}

const ANCHORS = [
  { value: 'departure', label: ANCHOR_WORDS.departure.verb },
  { value: 'arrival', label: ANCHOR_WORDS.arrival.verb },
] as const
const BOUNDS = [{ value: 'before', label: 'avant' }, { value: 'after', label: 'après' }] as const
const ROUTE_PROBLEMS: Record<RouteProblem, string> = {
  'same-station': 'Choisissez deux gares différentes.',
  'already-ranked': 'Cette route est déjà dans la liste.',
}

const initial = initialBound(props.leg)
const day = ref(props.day) as Ref<Day>
const anchor = ref<TimeAnchor>(props.leg.anchor)
const bound = ref<Bound>(initial.bound)
const boundTime = ref(initial.time)
const idealTime = ref(props.leg.idealTime)
const routes = ref(props.leg.routes)

const windowChanged = ref(false)
watch([bound, boundTime], () => {
  windowChanged.value = true
})

const draft = computed((): LegSettings => {
  const time = boundTime.value || null
  const singleBound = bound.value === 'before' ? { start: null, end: time } : { start: time, end: null }
  const window = windowChanged.value ? singleBound : props.leg.window
  return { anchor: anchor.value, window, idealTime: idealTime.value, routes: routes.value }
})

// « + Ajouter une route »
const adding = ref(false)
const origin = ref<Station | null>(null)
const destination = ref<Station | null>(null)
const newRoute = computed(() =>
  origin.value && destination.value ? { originCode: origin.value.code, destinationCode: destination.value.code } : null)
const newRouteProblem = computed(() => (newRoute.value ? routeProblem(routes.value, newRoute.value) : null))

function startAdding() {
  origin.value = null
  destination.value = null
  adding.value = true
}

function confirmNewRoute() {
  const route = newRoute.value
  if (!route || newRouteProblem.value) return
  routes.value = addRoute(routes.value, route)
  adding.value = false
}

// « OK »
const saving = ref(false)
const saveFailed = ref(false)

async function submit() {
  saving.value = true
  saveFailed.value = false
  try {
    await props.save(day.value, draft.value)
    emit('close')
  }
  catch {
    saveFailed.value = true
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <form @submit.prevent="submit">
    <header class="sticky top-0 z-10 -mx-6 flex items-center justify-between gap-3 bg-surface px-6 pt-4 pb-5">
      <h2
        :id="titleId"
        class="text-xl font-extrabold tracking-tight"
      >
        {{ title }}
      </h2>
      <div class="flex gap-2">
        <button
          type="button"
          class="h-9 rounded-full bg-surface-muted px-4 text-[13px] font-bold"
          @click="emit('close')"
        >
          Annuler
        </button>
        <button
          type="submit"
          :disabled="saving"
          class="h-9 rounded-full bg-inverse px-4 text-[13px] font-bold text-on-inverse disabled:opacity-60"
        >
          OK
        </button>
      </div>
    </header>

    <p
      v-if="saveFailed"
      role="alert"
      class="mb-5 text-[13px] leading-snug font-semibold text-accent-ink"
    >
      Enregistrement impossible pour l’instant. Réessayez dans un moment.
    </p>

    <div class="space-y-7">
      <fieldset>
        <legend class="eyebrow">
          Jour
        </legend>
        <div class="mt-2 grid grid-cols-7 gap-1.5">
          <label
            v-for="choice in days"
            :key="choice.value"
            class="relative"
          >
            <input
              v-model="day"
              type="radio"
              :name="`${kind}-day`"
              :value="choice.value"
              :aria-label="choice.label"
              class="peer absolute inset-0 z-10 cursor-pointer appearance-none opacity-0"
            >
            <span
              class="flex cursor-pointer flex-col items-center justify-center rounded-xl bg-surface-muted text-[12px] leading-tight font-bold text-ink-muted transition peer-checked:bg-inverse peer-checked:text-on-inverse peer-focus-visible:outline-2 peer-focus-visible:outline-accent"
              :class="choice.detail ? 'h-12' : 'h-10'"
              aria-hidden="true"
            >
              {{ choice.short }}
              <span
                v-if="choice.detail"
                class="tnum"
              >{{ choice.detail }}</span>
            </span>
          </label>
        </div>
      </fieldset>

      <section :aria-labelledby="ids.window">
        <h3
          :id="ids.window"
          class="eyebrow"
        >
          Fenêtre optimale
        </h3>
        <div class="mt-2 flex flex-wrap items-center gap-2">
          <SegmentedControl
            v-model="anchor"
            legend="Horaire visé"
            :options="ANCHORS"
          />
          <SegmentedControl
            v-model="bound"
            legend="Limite"
            :options="BOUNDS"
          />
          <label
            class="sr-only"
            :for="ids.windowTime"
          >Heure de la fenêtre</label>
          <input
            :id="ids.windowTime"
            v-model="boundTime"
            type="time"
            required
            class="tnum h-10 rounded-xl bg-surface-muted px-3 text-base font-bold"
          >
        </div>
        <div class="mt-3 flex items-center gap-3">
          <label
            :for="ids.idealTime"
            class="text-[14px] font-bold text-ink-muted"
          >{{ ANCHOR_WORDS[anchor].ideal }}</label>
          <input
            :id="ids.idealTime"
            v-model="idealTime"
            type="time"
            required
            class="tnum h-10 rounded-xl bg-surface-muted px-3 text-base font-bold"
          >
        </div>
        <LegDayBar :leg="draft" />
      </section>

      <section :aria-labelledby="ids.routes">
        <h3
          :id="ids.routes"
          class="eyebrow"
        >
          Routes, par ordre de préférence
        </h3>
        <ol
          v-if="routes.length > 0"
          class="mt-2 space-y-2"
        >
          <li
            v-for="(route, index) in routes"
            :key="`${route.originCode}-${route.destinationCode}`"
            class="flex items-center gap-2 rounded-2xl bg-surface-muted py-1.5 pr-1 pl-3"
          >
            <span
              class="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-[11px] font-extrabold text-on-accent"
              aria-hidden="true"
            >{{ index + 1 }}</span>
            <span class="min-w-0 flex-1 text-[13px] leading-snug font-bold">{{ routeName(route, stationName) }}</span>
            <button
              type="button"
              :disabled="index === 0"
              :aria-label="`Monter ${routeName(route, stationName)}`"
              class="grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-25"
              @click="routes = moveRoute(routes, index + 1, 'up')"
            >
              <ChevronUp
                :size="18"
                :stroke-width="2.2"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              :disabled="index === routes.length - 1"
              :aria-label="`Descendre ${routeName(route, stationName)}`"
              class="grid size-9 shrink-0 place-items-center rounded-full disabled:opacity-25"
              @click="routes = moveRoute(routes, index + 1, 'down')"
            >
              <ChevronDown
                :size="18"
                :stroke-width="2.2"
                aria-hidden="true"
              />
            </button>
            <button
              type="button"
              :aria-label="`Retirer ${routeName(route, stationName)}`"
              class="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted"
              @click="routes = removeRoute(routes, index + 1)"
            >
              <X
                :size="17"
                :stroke-width="2.2"
                aria-hidden="true"
              />
            </button>
          </li>
        </ol>
        <p
          v-else
          class="mt-2 text-[13px] font-medium text-ink-muted"
        >
          Aucune route pour l’instant. Ajoutez celles que vous acceptez, la préférée en premier.
        </p>

        <div
          v-if="adding"
          class="mt-2 space-y-3 rounded-2xl border-2 border-dashed border-line p-3"
        >
          <StationPicker
            v-model="origin"
            label="Gare de départ"
            :stations="stations"
          />
          <StationPicker
            v-model="destination"
            label="Gare d’arrivée"
            :stations="stations"
          />
          <p
            v-if="newRouteProblem"
            role="alert"
            class="text-[13px] leading-snug font-semibold text-accent-ink"
          >
            {{ ROUTE_PROBLEMS[newRouteProblem] }}
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              class="h-10 flex-1 rounded-xl bg-surface-muted text-[13px] font-bold"
              @click="adding = false"
            >
              Annuler
            </button>
            <button
              type="button"
              :disabled="!newRoute || newRouteProblem !== null"
              class="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl bg-inverse text-[13px] font-bold text-on-inverse disabled:opacity-40"
              @click="confirmNewRoute"
            >
              <Check
                :size="16"
                :stroke-width="2.4"
                aria-hidden="true"
              />
              Ajouter
            </button>
          </div>
        </div>
        <button
          v-else
          type="button"
          class="mt-2 h-11 w-full rounded-2xl border-2 border-dashed border-line text-[13px] font-bold text-ink-muted"
          @click="startAdding"
        >
          + Ajouter une route
        </button>
      </section>
    </div>
  </form>
</template>
