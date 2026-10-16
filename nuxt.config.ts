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
    // Sign-in arrives with ticket 02; until then every page is public.
    redirect: false,
    types: '~~/shared/types/database.types.ts',
  },
})
