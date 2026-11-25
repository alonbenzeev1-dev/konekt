---
name: frontend-design
description: Design standards for any UI/UX work in Konekt, a Hebrew RTL, mobile-first PWA. Use before building or restyling a screen, component, sheet, empty state, loading state or animation, so the result feels like a crafted native app (think Linear, Arc, Luma) and not generic AI-generated UI.
---

# Konekt front-end design

Konekt is used one-handed, on a phone, between lectures, in Hebrew. Every screen should feel calm, fast and trustworthy. Design for 360px width first; tablets and desktop just get the same column centered (the app shell is `max-w-[480px]`).

This repo's stack: React 19, Tailwind 4 (tokens in `@theme` inside `src/index.css`), lucide-react icons, Heebo font. Reuse what exists before inventing anything: `.card`, `.btn-primary`, `.btn-ghost`, `.field`, `.anim-card / .anim-rise / .anim-fade`, `safe-top`, `safe-bottom`, `Section`, `BottomSheet`, `Avatar`, `TagChips`.

## 1. Principles

- **One clear job per screen.** One primary action, visually dominant. Everything else is secondary (ghost button, text link) or hidden until needed.
- **Hierarchy through size, weight and color, not boxes.** Three text levels are enough: title (`text-ink`, bold), body (`text-ink/80`), meta (`text-muted`, `text-xs`). Do not add a border or background just to separate things that spacing can separate.
- **Whitespace is intentional.** Use a 4px rhythm: gaps of 8 / 12 / 16 / 24, page gutter 16 (`px-4`), section spacing 24-28 (`space-y-6`/`space-y-7`). Dense lists (chats, members) can be 10-12 between rows; forms and sheets need more air.
- **Say less.** Short Hebrew labels, one sentence of helper text under a field, never a paragraph. Explain consequences (what the other person will see), not features.
- **Honest UI.** Never promise something the backend does not do (timings, privacy, "אוטומטי"). If unsure, check the SQL / hook first.

## 2. Color

Brand blue on a cool off-white canvas, white cards, slate text. Color is for meaning (action, live, danger), not decoration.

| Role | Target | Notes |
|---|---|---|
| Brand blue (accents, icons, active tab, rings) | `#0EA5E9` | Too light for white text (about 2.8:1). Never put small white text on it. |
| Action blue (filled buttons, anything with white text) | `#0284C7`, pressed `#0369A1` | About 4.1:1 with white. This is `--color-cta`. |
| Canvas | `#F8FAFC` | Page background. (`src/index.css` currently uses `#F0F9FF`; change the token, never hard-code per screen.) |
| Card | `#FFFFFF` | Always on the canvas, never white on white. |
| Primary text | `#0F172A` | `--color-ink` |
| Secondary text | `#475569` | Meta text should stay at least 4.5:1 on its background. (`--color-muted` is `#64748B`; use `#475569` for anything that must be read, not just glanced at.) |
| Border | `#E2E8F0` | `--color-line` |
| Live / success | `#10B981` | Presence dot, "אושר". Soft fill `#D1FAE5`. |
| Danger | `#E11D48` | Destructive actions, errors only. |
| Platform brands | LinkedIn `#0A66C2`, Instagram gradient | Only on that platform's own button or badge. |

Rules: use the Tailwind tokens (`bg-bg`, `bg-card`, `text-ink`, `text-muted`, `border-line`, `bg-cta`, `bg-primary-soft`), not raw hex, so a palette change is one edit. One accent per screen. Tinted soft backgrounds (`bg-primary-soft/60` + `border-primary/20`) for informational cards; amber only for warnings.

## 3. Surfaces and depth

- Cards: `rounded-2xl` (inner elements `rounded-xl`), 1px `border-line`, soft shadow (`--shadow-card`). Depth comes from border + a faint, wide, low-opacity shadow. Not from heavy drop shadows.
- **No decorative gradients.** Gradients are allowed for the Instagram brand button and the logo only. No glassmorphism stacks, no neon glows, no gradient text, no emoji as icons in UI chrome (they are fine inside user content and a few friendly empty states).
- Sticky bars (header, tab bar): `bg-card/90 backdrop-blur-xl` + hairline border. Nothing else floats.
- Sheets: `BottomSheet` with grab handle, `rounded-t-3xl`, content scrolls, max 92vh.
- Icons: lucide, 16-22px, stroke 1.8-2.3, `currentColor`. One icon style across the app.

## 4. Touch, forms and buttons

- **Every tappable thing is at least 44x44px** (`min-h-[44px]`; for icon buttons pad to `h-11 w-11` or extend the hit area with negative margin + padding). Spacing between adjacent targets at least 8px.
- Primary button: full width in sheets and cards, `py-3`-`py-3.5`, `rounded-2xl`, text 15-16px bold. Secondary: `.btn-ghost`. Destructive: ghost with `text-danger`, confirm first.
- Inputs: 16px font minimum (smaller makes iOS Safari zoom), `.field`, visible label above, helper below, error in `text-danger` with the fix, never just a red border. Use the right `inputMode` / `autoCapitalize` / `autoComplete`.
- Disabled = visibly lower contrast, and say why when it is not obvious.
- Immediate feedback on tap: `active:scale-[0.98]` (transform only) plus a loading state on the button itself after the tap.
- Prefer a one-tap path over a form. If the app can prefill, detect, or paste, do that.

## 5. Native mobile feel

- **Safe areas:** header uses `safe-top`; anything pinned to the bottom (tab bar, composer, sheets) uses `safe-bottom` (`env(safe-area-inset-bottom)`). Test with the home indicator in mind.
- **Motion at 60fps:** animate only `transform` and `opacity`. 150-300ms, ease-out for entrances (`cubic-bezier(.2,.8,.2,1)`), shorter for exits. Never animate `width/height/top/left/box-shadow` on large lists. Stagger list entrances by 30-40ms, cap at ~8 items. Everything must respect `prefers-reduced-motion` (the `.anim-*` classes already do).
- **Loading = skeletons, not spinners,** for anything that fills a known layout (lists, cards, member rows, profile). Skeleton: same height and radius as the real element, `bg-line/60`, a slow opacity pulse. Spinners are only for a button's own pending state or a very short blocking wait.
- **Optimistic updates** for cheap, reversible actions (toggles, read state, sending a message), with a quiet rollback and toast on failure.
- Scroll: `overscroll-behavior` contained inside sheets/chats, no horizontal scroll anywhere, `-webkit-tap-highlight-color: transparent` (already set), no hover-only affordances.
- Offline / failure states are designed screens: one sentence, one retry action.
- Empty states: an icon in a soft circle, one bold line, one helpful sentence, and the primary action that fills the emptiness. Never a blank screen.

## 6. Hebrew and RTL

- The document is `dir="rtl"`. Use **logical properties**: `ms-/me-`, `ps-/pe-`, `start-/end-`, `text-start`, `border-s`, `rounded-s`/`rounded-ss-md`. Avoid `left/right/ml/mr` unless something is physically fixed (a map, a play-head). Flex rows reverse automatically; do not reverse them again.
- **Mirror directional icons** (back arrows, chevrons, send): use `ArrowRight` for "back", `ChevronLeft` for "go on", and `-scale-x-100` where the glyph is LTR by nature. Do not mirror logos, check marks, clocks, phone, or media controls.
- **Mixed content:** Latin words, numbers, URLs, handles, time and countdowns go in `dir="ltr"` spans (`<span dir="ltr">`) so punctuation does not jump. Wrap pasted or user-generated text in `dir="auto"`. Inputs that hold URLs, handles or emails are `dir="ltr"` with `text-right` placeholder only if it reads better.
- Typography: Heebo (Rubik is an acceptable fallback; system sans after that). Weights 400 / 500 / 700 / 800 only. Body 15px, meta 11-13px (never below 11), titles 18-24px, line-height 1.4-1.6 for Hebrew paragraphs. No letter-spacing on Hebrew (only on the Latin `KONEKT` wordmark).
- Copy: warm, direct, short. Use plural / neutral forms ("שלחו", "לחצו", "אתם") or slash forms ("מאשר/ת") instead of guessing a gender. Buttons are verbs ("אשר", "שלחו בקשה"). Quote Hebrew UI names with ״...״. Sentence case, no exclamation marks except real celebration.

## 7. Accessibility floor

- Text contrast at least 4.5:1 (3:1 for 18px+ bold). White text only on `#0284C7` or darker.
- Real elements: `<button>` for actions, `<a>` for navigation. Icon-only buttons need `aria-label` (Hebrew). Toggles use `role="switch"` + `aria-checked` (or `aria-pressed`). Modals: `role="dialog"`, `aria-modal`, Escape closes, focus lands inside.
- Visible `:focus-visible` ring (the `.field` focus style is the reference). Never remove outlines without replacing them.
- Do not rely on color alone: pair the green dot with text, the red error with a message.
- External links: `target="_blank" rel="noopener noreferrer"`, built only from validated URLs (see `safeProfileUrl` in `src/lib/social.ts`).

## 8. Anti-patterns (do not ship these)

Purple/pink gradient hero blocks; five different border radii on one screen; shadows darker than the card edge; centered paragraphs of body text; icon + title + subtitle in three colors on every row; badges on everything; modal-on-modal; toasts for things the screen already shows; spinner-only loading; tiny gray text carrying essential info; copy that sounds like a marketing page ("Unlock the power of..."); generic stock-style empty illustrations; animations longer than 300ms; hard-coded hex values instead of tokens.

## 9. Before calling a UI task done

1. Looks right at **360px** and **390px** width, RTL, with a long Hebrew name and a long headline (truncate, do not overflow).
2. Every tappable target is 44px, bottom elements clear the safe area, nothing scrolls sideways.
3. Loading, empty, error and "no permission / not set up yet" states exist and read well.
4. Uses existing tokens and components; no new raw colors, no new one-off radii or shadows.
5. Numbers, URLs and handles are in LTR spans; directional icons are mirrored correctly.
6. Motion is transform/opacity only and respects reduced motion.
7. `npm run build` is clean (strict TS, no unused locals). For anything visual, render it (headless Chrome screenshot at 360px) and look at it before saying it is finished.
