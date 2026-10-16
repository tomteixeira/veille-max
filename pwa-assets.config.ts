import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// The app icons of the web app manifest and the iPhone home screen, drawn from
// the favicon. Regenerate with `npm run pwa:icons` after changing it, and commit
// the images.

/** The favicon's orange, as a full-bleed background where the platform rounds or masks the icon. */
const background = '#f97316'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // The rounded square as it is, for the manifest's `any` icons.
    transparent: { ...minimal2023Preset.transparent, sizes: [192, 512], favicons: [] },
    // Android masks the icon to a circle or squircle: keep the ticket inside its safe zone.
    maskable: { ...minimal2023Preset.maskable, padding: 0.1, resizeOptions: { background } },
    // iOS rounds the corners itself.
    apple: { ...minimal2023Preset.apple, padding: 0, resizeOptions: { background } },
  },
  images: ['public/favicon.svg'],
})
