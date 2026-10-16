/**
 * Whether the server-rendered page has hydrated. Before that, its controls do
 * nothing (a form even reloads the page) and text typed into them is lost, so
 * pages disable them until it is `true`.
 */
export function useInteractive(): Readonly<Ref<boolean>> {
  const interactive = ref(false)
  onMounted(() => {
    interactive.value = true
  })
  return readonly(interactive)
}
