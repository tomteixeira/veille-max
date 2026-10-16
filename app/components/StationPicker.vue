<!--
  Picks a station by typing part of its full name: a combobox whose matching
  stations are listed right below it, so they stay visible above the keyboard.
-->
<script setup lang="ts">
import type { Station } from '#shared/domain/trip-template'

const props = defineProps<{
  label: string
  stations: readonly Station[]
}>()

const selected = defineModel<Station | null>({ required: true })

const id = useId()
const listId = `${id}-stations`
const query = ref(selected.value?.name ?? '')
const active = ref(0)

const results = computed(() => (selected.value ? [] : searchStations(props.stations, query.value)))
const expanded = computed(() => results.value.length > 0)
const activeStation = computed(() => (expanded.value ? results.value[active.value] : undefined))

function optionId(station: Station): string {
  return `${id}-${station.code}`
}

function search() {
  selected.value = null
  active.value = 0
}

function choose(station: Station) {
  selected.value = station
  query.value = station.name
}

function move(offset: number) {
  if (!expanded.value) return
  active.value = (active.value + offset + results.value.length) % results.value.length
}
</script>

<template>
  <div>
    <label
      :for="id"
      class="text-[13px] font-bold"
    >{{ label }}</label>
    <input
      :id="id"
      v-model="query"
      type="text"
      role="combobox"
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      placeholder="Rechercher une gare"
      aria-autocomplete="list"
      :aria-expanded="expanded"
      :aria-controls="listId"
      :aria-activedescendant="activeStation ? optionId(activeStation) : undefined"
      class="mt-1.5 h-11 w-full rounded-xl bg-surface-muted px-3 text-base font-bold placeholder:font-semibold placeholder:text-ink-faint"
      @input="search"
      @keydown.down.prevent="move(1)"
      @keydown.up.prevent="move(-1)"
      @keydown.enter.prevent="activeStation && choose(activeStation)"
    >
    <ul
      v-show="expanded"
      :id="listId"
      role="listbox"
      :aria-label="label"
      class="mt-1.5 divide-y divide-line overflow-hidden rounded-xl border border-line"
    >
      <li
        v-for="station in results"
        :id="optionId(station)"
        :key="station.code"
        role="option"
        :aria-selected="station === activeStation"
        class="cursor-pointer px-3 py-2.5 text-[14px] font-semibold"
        :class="station === activeStation ? 'bg-surface-muted' : ''"
        @click="choose(station)"
      >
        {{ station.name }}
      </li>
    </ul>
  </div>
</template>
