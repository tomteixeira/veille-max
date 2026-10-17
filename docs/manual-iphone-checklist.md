# Manual iPhone checklist

Home-screen installation, real push delivery and real Google sign-in cannot be automated (spec, Testing Decisions). Run this on an iPhone with iOS 16.4 or later, against the production deployment, after changing the manifest, the service worker, push delivery or sign-in. It needs the VAPID variables set on Vercel (README, Deploy, step 6).

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

## Confirmation Reminder (ticket 11)

Needs a booking for tomorrow on the iPhone's traveller, and Safari logged in to [MAX JEUNE](https://www.maxjeune-tgvinoui.sncf/sncf-connect/mes-voyages).

- [ ] Réglages → Notifications: « Rappel de confirmation » is on.
- [ ] At the first tick after noon Paris the day before, the reminder « Votre aller de demain est à confirmer » arrives once, naming the stations, the times and the 17:00 deadline. Later ticks send nothing more.
- [ ] Tap it: the app opens on « Trajets à confirmer », listing tomorrow's booked legs.
- [ ] Tap « Confirmer sur MAX JEUNE »: Safari opens on « Mes voyages », logged in. If the `x-safari-https://` link does nothing from the installed app, the page opens as plain https a moment later: write down what happened here, since that fallback opens it outside Safari's session.
- [ ] Turn « Rappel de confirmation » off: the next day's reminder does not come.

## Google sign-in (ticket 13)

Needs Google sign-in set up on the hosted project (README, Sign-in), with a Google account whose address is an invited traveller's.

- [ ] Sign out in Réglages. From the installed app, tap « Continuer avec Google »: Google opens in a sheet over the app, not in Safari, and offers to pick an account.
- [ ] Pick the invited account: the sheet closes and the standalone app (no Safari address bar) opens on Accueil, signed in. Close and reopen the app: still signed in.
- [ ] Sign out, then sign in with a Google account that is not invited: the app says « Ce compte Google n’a pas accès à Veille MAX », and « Retour à la connexion » leads back to sign-in.
- [ ] If the sign-in ends in Safari, or the app says « La connexion avec Google n’a pas abouti » after picking the invited account: the redirect does not return to the installed app on this iOS version. Hide « Continuer avec Google » in standalone mode (`display-mode: standalone`) and record the iOS version and what happened in ticket 13.
