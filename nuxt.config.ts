import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: ['@nuxt/eslint', '@nuxtjs/supabase'],

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
      ],
    },
  },

  css: ['~/assets/css/main.css'],

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

  supabase: {
    // Every page except sign-in requires a signed-in traveller.
    redirectOptions: {
      login: '/login',
      // The module's default, required by its types. The page arrives with Google sign-in (ticket 13).
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
