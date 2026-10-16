<!--
  A modal sheet that slides up from the bottom of the screen, on the native
  <dialog>: it traps focus and makes the page behind it inert. Escape and a tap
  on the dimmed page close it, like its own close actions.
-->
<script setup lang="ts">
const props = defineProps<{
  open: boolean
  /** The id of the element that names the sheet (its title). */
  labelledby: string
}>()

const emit = defineEmits<{ close: [] }>()

const dialog = useTemplateRef('dialog')

function sync() {
  if (!dialog.value) return
  if (props.open && !dialog.value.open) dialog.value.showModal()
  if (!props.open && dialog.value.open) dialog.value.close()
}

onMounted(sync)
watch(() => props.open, sync, { flush: 'post' })

// The dialog itself only receives the taps that land outside its panel, on the backdrop.
function closeOnBackdrop(event: MouseEvent) {
  if (event.target === dialog.value) emit('close')
}
</script>

<template>
  <dialog
    ref="dialog"
    :aria-labelledby="labelledby"
    class="mx-auto mt-auto mb-0 max-h-[88dvh] w-full max-w-lg overflow-y-auto overscroll-contain rounded-t-ticket bg-surface text-ink shadow-float animate-sheet-up backdrop:bg-black/35 motion-reduce:animate-none"
    @cancel.prevent="emit('close')"
    @click="closeOnBackdrop"
  >
    <div class="px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+2rem)]">
      <div
        class="mx-auto h-1 w-10 rounded-full bg-line"
        aria-hidden="true"
      />
      <slot />
    </div>
  </dialog>
</template>
