# Manual iPhone checklist

Home-screen installation and real push delivery cannot be automated (spec, Testing Decisions). Run this on an iPhone with iOS 16.4 or later, against the production deployment, after changing the manifest, the service worker or push delivery. It needs the VAPID variables set on Vercel (README, Deploy, step 6).

## Install

- [ ] In Safari, open the app and sign in. Réglages → Notifications says to add the app to the home screen first, and the switch is disabled.
- [ ] Share → « Sur l’écran d’accueil »: the suggested name is « Veille MAX » and the icon is the orange ticket, full-bleed.
- [ ] Open the app from the home screen: it opens without Safari's address bar, the status bar matches the theme (light and dark), and the traveller is still signed in (or signs in with an emailed code).

## Turn notifications on

- [ ] Réglages → Notifications: the switch reads « Notifications sur cet iPhone ».
- [ ] Tap it: iOS asks for permission at once. Allow: the switch turns on and « Appareils » lists « iPhone » with « Cet appareil ».
- [ ] Close and reopen the app: the switch is still on.

## Test notification

- [ ] Tap « Envoyer une notification de test »: the card says « Notification envoyée à 1 appareil. » and the notification « Veille MAX — Notification de test : tout fonctionne sur cet appareil. » arrives within a few seconds, also with the app closed and the phone locked.
- [ ] Tap the notification: the app opens on Réglages.
- [ ] With notifications also on for a second device (another iPhone, or a desktop browser), the test reaches both, and the card says « … à 2 appareils ».

## Turn notifications off

- [ ] Tap the switch again: the iPhone leaves « Appareils ». A test sent from the other device no longer reaches it.
- [ ] Turn them on again, then in iOS Réglages → Notifications → Veille MAX, turn « Autoriser les notifications » off. Back in the app, Réglages says notifications are refused and where to allow them.

## Session lifetime (ticket 02)

- [ ] Leave the installed app unopened for more than 7 days, then open it: the traveller is still signed in. The service worker never answers page loads ([ADR 0004](adr/0004-service-worker-without-fetch-handling.md)), so the server keeps rewriting the 400-day auth cookies.
