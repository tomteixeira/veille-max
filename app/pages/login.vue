<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import type { AuthError } from '@supabase/supabase-js'

definePageMeta({
  layout: 'signed-out',
  // A signed-in traveller has nothing to do here.
  middleware: () => {
    if (useSupabaseSession().value) return navigateTo('/')
  },
})

useHead({ title: 'Connexion' })

const CODE_LENGTH = 6

// The same words for a stranger and for an invitation whose link was never opened, which
// Supabase refuses alike while sign-ups are closed.
const NO_ACCESS_MESSAGE = 'Cette adresse n’a pas accès à Veille MAX. Si vous avez reçu une invitation, ouvrez d’abord son lien, puis réessayez.'

function codeRequestFailure(error: AuthError): string {
  switch (error.code) {
    case 'otp_disabled':
    case 'signup_disabled':
      return NO_ACCESS_MESSAGE
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Trop de codes demandés. Patientez quelques minutes avant de réessayer.'
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Cette adresse e-mail n’est pas valide.'
    default:
      return 'Impossible d’envoyer le code pour l’instant. Réessayez dans un moment.'
  }
}

function codeCheckFailure(error: AuthError): string {
  switch (error.code) {
    // Supabase does not tell a wrong code from an expired one.
    case 'otp_expired':
      return 'Code incorrect ou expiré. Vérifiez-le ou demandez-en un nouveau.'
    case 'over_request_rate_limit':
      return 'Trop de tentatives. Patientez quelques minutes avant de réessayer.'
    default:
      return 'Connexion impossible pour l’instant. Réessayez dans un moment.'
  }
}

const supabase = useSupabaseClient()
const redirectPath = useSupabaseCookieRedirect()

const step = ref<'email' | 'code'>('email')
const email = ref('')
const code = ref('')
const pending = ref(false)
const errorMessage = ref<string | null>(null)
const resent = ref(false)
const codeInput = useTemplateRef('codeInput')
const interactive = useInteractive()

async function requestCode(): Promise<boolean> {
  pending.value = true
  errorMessage.value = null
  const { error } = await supabase.auth.signInWithOtp({
    email: email.value.trim(),
    // Sign-ups are closed: a code only ever goes to an invited traveller.
    options: { shouldCreateUser: false },
  })
  pending.value = false
  if (error) errorMessage.value = codeRequestFailure(error)
  return !error
}

async function submitEmail() {
  if (!await requestCode()) return
  code.value = ''
  resent.value = false
  step.value = 'code'
  await nextTick()
  codeInput.value?.focus()
}

// A full-page redirect, never a popup: from the installed iPhone app, Google opens in an in-app
// sheet that brings the traveller back to the app once Supabase redirects to `/confirm`, inside
// the manifest scope. The PKCE verifier waits in a cookie for that page.
async function continueWithGoogle() {
  pending.value = true
  errorMessage.value = null
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: new URL('/confirm', window.location.origin).href,
      // Lets the traveller pick the account of their invitation rather than the last one used.
      queryParams: { prompt: 'select_account' },
    },
  })
  // On success the page is already leaving for Google.
  if (error) {
    pending.value = false
    errorMessage.value = 'Impossible de contacter Google pour l’instant. Réessayez dans un moment.'
  }
}

async function resendCode() {
  resent.value = await requestCode()
}

function changeEmail() {
  errorMessage.value = null
  step.value = 'email'
}

async function checkCode() {
  if (pending.value || code.value.length !== CODE_LENGTH) return
  pending.value = true
  errorMessage.value = null
  const { error } = await supabase.auth.verifyOtp({ email: email.value.trim(), token: code.value, type: 'email' })
  if (error) {
    pending.value = false
    errorMessage.value = codeCheckFailure(error)
    return
  }
  await navigateTo(redirectPath.pluck() || '/', { replace: true })
}

// Keeps digits only (a pasted « 123 456 » still works), and checks the code as soon as it is complete.
watch(code, (value) => {
  const digits = value.replace(/\D/g, '').slice(0, CODE_LENGTH)
  if (digits !== value) code.value = digits
  else checkCode()
})
</script>

<template>
  <div>
    <template v-if="step === 'email'">
      <PageHeader
        eyebrow="Veille MAX"
        title="Recevez un code"
        accent="pour vous connecter."
      />

      <form
        class="mt-7 px-6"
        @submit.prevent="submitEmail"
      >
        <SurfaceCard
          as="fieldset"
          :disabled="!interactive"
        >
          <label
            for="email"
            class="text-[13px] font-bold"
          >Adresse e-mail</label>
          <input
            id="email"
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            required
            placeholder="vous@exemple.fr"
            class="mt-2 h-12 w-full rounded-control bg-surface-muted px-4 text-base font-semibold placeholder:text-ink-faint"
          >
          <p
            v-if="errorMessage"
            role="alert"
            class="mt-3 text-[13px] leading-snug font-semibold text-accent-ink"
          >
            {{ errorMessage }}
          </p>
          <button
            type="submit"
            :disabled="pending"
            class="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-control bg-inverse text-sm font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Recevoir un code
            <ArrowRight
              :size="16"
              :stroke-width="2.2"
              aria-hidden="true"
            />
          </button>
          <div
            class="my-4 flex items-center gap-3 text-[12px] font-semibold text-ink-muted"
            aria-hidden="true"
          >
            <span class="h-px flex-1 bg-line" />
            ou
            <span class="h-px flex-1 bg-line" />
          </div>
          <button
            type="button"
            :disabled="pending"
            class="flex h-12 w-full items-center justify-center gap-2.5 rounded-control bg-surface-muted text-sm font-bold transition-opacity hover:opacity-80 disabled:opacity-60"
            @click="continueWithGoogle"
          >
            <svg
              viewBox="0 0 48 48"
              class="size-[18px]"
              aria-hidden="true"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
            </svg>
            Continuer avec Google
          </button>
        </SurfaceCard>
        <p class="mt-4 px-1 text-[13px] leading-snug font-medium text-ink-muted">
          Veille MAX est sur invitation : utilisez l’adresse de votre invitation, par code ou avec Google. Le code arrive par e-mail : saisissez-le ici, sans quitter l’application.
        </p>
      </form>
    </template>

    <template v-else>
      <PageHeader
        eyebrow="Connexion"
        title="Saisissez le code"
        accent="reçu par e-mail."
      />

      <form
        class="mt-7 px-6"
        @submit.prevent="checkCode"
      >
        <SurfaceCard
          as="fieldset"
          :disabled="!interactive"
        >
          <p class="text-[13px] leading-snug font-medium text-ink-muted">
            {{ resent ? 'Nouveau code envoyé à' : 'Code envoyé à' }}
            <span class="font-bold break-all text-ink">{{ email }}</span>.
            Il est valable une heure.
          </p>
          <label
            for="code"
            class="mt-4 block text-[13px] font-bold"
          >Code à 6 chiffres</label>
          <input
            id="code"
            ref="codeInput"
            v-model="code"
            type="text"
            name="code"
            inputmode="numeric"
            autocomplete="one-time-code"
            required
            class="tnum mt-2 h-14 w-full rounded-control bg-surface-muted text-center text-[28px] font-extrabold tracking-[0.35em]"
          >
          <p
            v-if="errorMessage"
            role="alert"
            class="mt-3 text-[13px] leading-snug font-semibold text-accent-ink"
          >
            {{ errorMessage }}
          </p>
          <button
            type="submit"
            :disabled="pending || code.length !== CODE_LENGTH"
            class="mt-4 flex h-12 w-full items-center justify-center rounded-control bg-inverse text-sm font-bold text-on-inverse transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            Se connecter
          </button>
        </SurfaceCard>
        <div class="mt-4 flex items-center justify-between gap-4 px-1 text-[13px] font-bold text-ink-muted">
          <button
            type="button"
            :disabled="pending"
            class="hover:text-ink"
            @click="resendCode"
          >
            Renvoyer le code
          </button>
          <button
            type="button"
            class="hover:text-ink"
            @click="changeEmail"
          >
            Changer d’adresse
          </button>
        </div>
      </form>
    </template>
  </div>
</template>
