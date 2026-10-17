<script setup lang="ts">
// Where Supabase sends the traveller back after Google sign-in (ticket 13), inside the manifest
// scope. The Supabase client trades the `code` of the URL for a session, with the PKCE verifier
// that `/login` left in a cookie, before this page mounts.
definePageMeta({ layout: 'signed-out' })

useHead({ title: 'Connexion' })

const route = useRoute()
const session = useSupabaseSession()
const redirectPath = useSupabaseCookieRedirect()

const NOT_FINISHED_MESSAGE = 'La connexion avec Google n’a pas abouti. Réessayez, ou recevez un code par e-mail.'

// Supabase refuses a Google account it does not know while sign-ups are closed, and passes on
// the other failures (the traveller closed Google's screen, Google refused the client).
function providerFailure(errorCode: unknown): string {
  switch (errorCode) {
    case 'signup_disabled':
      return 'Ce compte Google n’a pas accès à Veille MAX. Connectez-vous avec l’adresse de votre invitation, ou recevez un code par e-mail.'
    default:
      return NOT_FINISHED_MESSAGE
  }
}

const exchangeFailed = ref(false)
const errorMessage = computed(() => {
  if (route.query.error) return providerFailure(route.query.error_code)
  return exchangeFailed.value ? NOT_FINISHED_MESSAGE : null
})

onMounted(async () => {
  if (route.query.error) return
  if (session.value) {
    await navigateTo(redirectPath.pluck() || '/', { replace: true })
    return
  }
  // A code with no session: its verifier is missing (the sign-in started in another browser) or
  // Supabase refused the trade.
  if (route.query.code) exchangeFailed.value = true
  else await navigateTo('/login', { replace: true })
})
</script>

<template>
  <div>
    <PageHeader
      eyebrow="Connexion"
      title="Connexion avec Google"
      :accent="errorMessage ? 'impossible.' : 'en cours…'"
    />

    <div
      v-if="errorMessage"
      class="mt-7 px-6"
    >
      <SurfaceCard>
        <p
          role="alert"
          class="text-[13px] leading-snug font-semibold text-accent-ink"
        >
          {{ errorMessage }}
        </p>
        <NuxtLink
          to="/login"
          replace
          class="mt-4 flex h-12 w-full items-center justify-center rounded-control bg-inverse text-sm font-bold text-on-inverse transition-opacity hover:opacity-90"
        >
          Retour à la connexion
        </NuxtLink>
      </SurfaceCard>
    </div>
  </div>
</template>
