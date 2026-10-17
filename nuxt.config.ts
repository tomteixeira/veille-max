import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/supabase', '@vite-pwa/nuxt'],

  devtools: { enabled: true },

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Veille MAX',
      titleTemplate: '%s · Veille MAX',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'description', content: 'Les meilleurs trains MAX JEUNE de vos week-ends, chaque matin.' },
        { name: 'color-scheme', content: 'light dark' },
        // Matches the canvas token of each theme (see app/assets/css/main.css).
        { name: 'theme-color', media: '(prefers-color-scheme: light)', content: '#f5f5f4' },
        { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: '#0c0a09' },
        { name: 'apple-mobile-web-app-title', content: 'Veille MAX' },
      ],
      link: [
        { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon-180x180.png' },
        { rel: 'manifest', href: '/manifest.webmanifest' },
      ],
    },
  },

  css: ['~/assets/css/main.css'],

  runtimeConfig: {
    // Shared with the `pg_cron` job that calls the tick endpoint (`NUXT_TICK_SECRET`).
    tickSecret: '',
    // Web Push (VAPID): the key pair that signs every push, and a contact for the push services.
    vapidPrivateKey: '',
    vapidSubject: '',
    public: {
      // Sent to the browser, which hands it to its push service when subscribing.
      vapidPublicKey: '',
    },
  },

  compatibilityDate: '2026-10-01',

  // Vercel builds pick the `vercel` Nitro preset on their own (zero config),
  // so local builds keep the default `node-server` output used by Playwright.
  nitro: {
    vercel: {
      functions: {
        // Paris, next to the Supabase database (eu-west-3). Vercel defaults to Washington (iad1).
        regions: ['cdg1'],
        // Nitro would cap the runtime at Node 22; match `engines` instead.
        runtime: 'nodejs24.x',
        // The tick ingests a snapshot within one call; pg_net waits up to 120 s for it.
        maxDuration: 300,
      },
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },

  typescript: {
    strict: true,
    tsConfig: {
      compilerOptions: {
        noUncheckedIndexedAccess: true,
      },
    },
  },

  eslint: {
    config: {
      stylistic: true,
    },
  },

  // The installable app (spec, "Stack and hosting"). iOS sends notifications
  // only to an app added to the home screen.
  pwa: {
    registerType: 'autoUpdate',
    // A service worker of our own, for push (`service-worker/sw.ts`). Paths are
    // relative to the Vite root, `app/`.
    strategies: 'injectManifest',
    srcDir: '../service-worker',
    filename: 'sw.ts',
    // No precaching: page loads always reach the server (see `sw.ts`).
    injectManifest: { injectionPoint: undefined },
    // Serves both files with explicit headers on every preset (vite-pwa/nuxt#228):
    // the manifest typed `application/manifest+json`, neither cached by the browser.
    registerWebManifestInRouteRules: true,
    manifest: {
      id: '/',
      name: 'Veille MAX',
      short_name: 'Veille MAX',
      description: 'Les meilleurs trains MAX JEUNE de vos week-ends, chaque matin.',
      lang: 'fr',
      start_url: '/',
      // Notifications only open addresses inside it.
      scope: '/',
      display: 'standalone',
      // The manifest takes one colour: the light theme's canvas. The `theme-color`
      // meta tags above, which win over it, give each theme its own.
      theme_color: '#f5f5f4',
      background_color: '#f5f5f4',
      // Drawn from the favicon by `npm run pwa:icons` (pwa-assets.config.ts).
      icons: [
        { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
        { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
    },
    client: {
      // Registers the service worker on every page; the notification settings wait for it.
      registerPlugin: true,
    },
  },

  supabase: {
    // Every page except sign-in (`/login`, and `/confirm` after Google) requires a signed-in traveller.
    redirectOptions: {
      login: '/login',
      // Where Google sign-in comes back (`app/pages/confirm.vue`), inside the manifest scope.
      callback: '/confirm',
      // After signing in, the traveller lands on the page they asked for (e.g. from a notification).
      saveRedirectToCookie: true,
    },
    cookieOptions: {
      // Long-lived session: closing and reopening the installed app keeps the traveller signed in.
      // 400 days is the longest expiry browsers accept; the module default is 8 hours.
      maxAge: 60 * 60 * 24 * 400,
    },
    types: '~~/shared/types/database.types.ts',
  },
})
