# 16: Home: the whole page scrolls horizontally

**What to fix:** On the home page (Accueil), on iPhone, a horizontal swipe moves the entire page sideways: the title, the « Dernier instantané » chip, the trip ticket and the « Préparer » list all slide off to the left, leaving an empty grey canvas on the right. Only the tab bar, which is fixed, stays in place. It feels like leaving the app. The page must never scroll horizontally; only the trip carousel (« Vos week-ends ») may scroll sideways, inside its own bounds.

**Type:** bug

**Blocked by:** none

**Status:** needs-triage

## Observed

Screenshot from the reporter (iPhone, Safari or installed PWA, 2026-10-16): the page is shifted left by roughly a screen width. The ticket's right perforation notch is visible at the card edge, and the legal note in the footer is cut off at the left.

## Leads (not confirmed)

- The document is wider than the viewport somewhere, and nothing clips it: `html` and `body` in `app/assets/css/main.css` have no `overflow-x` rule, and `app/layouts/default.vue` does not clip either.
- Candidate overflowing elements: the perforation notches in `app/components/TicketPerforation.vue` are pushed half outside the card (`translate-x-1/2`); any wide content in the home sections of `app/pages/index.vue`.
- The trip carousel in `app/pages/index.vue` (`overflow-x-auto`, `snap-x`) may hand the swipe over to the page once it reaches its end (scroll chaining). It has no `overscroll-behavior-x: contain`.

Find the actual overflowing element before fixing (for example by checking `document.documentElement.scrollWidth` against `clientWidth` at 375 px). Fix the cause, and also make the page robust against future overflow (for example `overflow-x: clip` on the root) without breaking the sticky/fixed elements, the bottom sheet scroll lock, or the carousel.

## Acceptance criteria

- [ ] At 375 px wide, on the home page, `document.documentElement.scrollWidth` equals `clientWidth`, with and without configured routes.
- [ ] A horizontal swipe on the home page, outside the carousel, does not move the page.
- [ ] Swiping the trip carousel to its first or last card does not move the page.
- [ ] The trip carousel still scrolls and snaps, and the perforation notches still look the same.
- [ ] Same check on the leg view, Réglages and Dashboard: no horizontal page scroll.
- [ ] Playwright (mobile viewport): the home page has no horizontal overflow.

## Comments

### Implementation

- Reproduced at 375 px on Chromium's mobile project: without routes the document width is 375 px; with routes it grows to 1568 px although the carousel itself remains 375 px wide.
- Root cause: absolutely positioned `.sr-only` text on each off-screen « Modifier » link has a containing block outside the carousel and escapes its overflow clipping. Temporarily hiding those spans or positioning the carousel reduces the document width to 375 px; undoing the probe restores 1568 px. The perforation notches are not the cause.
- Position the carousel to contain these descendants, contain horizontal overscroll, and clip horizontal overflow on html/body. `clip` does not introduce a scroll container; the existing open-dialog scroll lock still takes precedence. Ticket perforations are unchanged.
- Add a 375 px Playwright regression covering home with/without routes, snap alignment, native touch gestures at both carousel ends and outside it, ordinary link taps, leg view, settings and dashboard. Restore the ordinary tap in the improvements test, which previously needed a keyboard workaround for this bug.
- Automated validation uses the existing Chromium iPhone emulation. Physical iPhone Safari/PWA validation remains a manual check.
