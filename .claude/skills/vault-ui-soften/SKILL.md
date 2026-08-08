---
name: vault-ui-soften
description: Converts a Flutter widget file in this app's "brutalist" era (thick black borders, hard zero-blur offset shadows, sharp rectangular corners) into the app's current rounded, soft-shadow, theme-aware style. Use this whenever the user asks to "soften," "round," "update the UI," "match the new design," "make it consistent with the rest of the app," or points out that a specific screen "still looks brutalist" / "still has the old style" / "hasn't been transformed yet" — even if they don't name this skill directly. Also trigger proactively when editing or reviewing any screen under flutter app/lib/screens or flutter app/lib/widgets and you notice BoxDecoration with a hard-edged Border.all(...) or a BoxShadow with blurRadius: 0 — that's this skill's signature pattern to fix.
---

# Vault UI Soften

This app moved from a deliberate "brutalist" design system (thick 2-4px black
borders, hard zero-blur offset shadows like
`BoxShadow(color: AppColors.black, offset: Offset(5,5), blurRadius: 0)`, sharp
rectangular corners everywhere) to a softer, rounded, modern-mobile look —
rounded cards, pill-shaped nav tabs, real blurred drop shadows. The shared
widgets (`BrutalistCard`, `BrutalistButton`, `NavTabBar`, `AppHeader`) already
do the right thing by default now. This skill is for everywhere else: the
many screens that hand-roll their own `Container` + `BoxDecoration` instead of
using those shared widgets, which is most of the actual surface area.

Read this whole file before editing — the four transformation rules below are
short, but the two gotchas at the end have each caused a real bug in this
codebase and are worth internalizing before you start.

## Before you start: confirm the shared widgets are still current

Skim `flutter app/lib/widgets/brutalist_card.dart`,
`brutalist_button.dart`, `nav_tab_bar.dart`, and `app_header.dart`. If they
still show the hard-edged pattern (0-blur `BoxShadow`, no `borderRadius`),
convert those four first — every other screen either uses them directly or
should be made to match them, so they're the source of truth for the exact
radius/shadow values to use everywhere else. If they've already been
converted (look for `borderRadius: BorderRadius.circular(...)` and a
`blurRadius` greater than 0 in their shadows), skip straight to the per-screen
pass below.

## The four transformation rules

Work through the target file (or files) applying these in order. Each one is
a search-and-replace pattern, not a rewrite — the goal is the smallest diff
that gets the visual result, not restructuring the widget tree.

### 1. Hard borders → soft or none

Find: `border: Border.all(color: AppColors.black, width: N)` (or any
similarly hard, opaque, multi-pixel border).

Replace: in most cases, remove the border entirely — the new soft shadow
alone is usually enough definition. Where a screen genuinely reads as flat
without *some* edge (e.g. a card sitting on a background of a very similar
color), keep a hairline instead: `Border.all(color:
context.ink.withValues(alpha: 0.08–0.14), width: 1–1.5)`.

### 2. Hard offset shadows → real blurred shadows

Find: `boxShadow: [BoxShadow(color: AppColors.black, offset: Offset(N, N),
blurRadius: 0)]` — the brutalist signature: a solid-color rectangle offset
behind the box, not an actual drop shadow.

Replace: `BoxShadow(color: AppColors.black.withValues(alpha: 0.08–0.15),
offset: Offset(0, 3–5), blurRadius: 8–14)`. Scale intensity with the
element's visual weight — a big section card can take alpha ~0.1–0.12 and
blurRadius ~14; a small chip or badge wants something lighter, alpha ~0.08
and blurRadius ~6–8.

For elements sitting on a *colored* surface (a yellow button, a colored
badge), tint the shadow to match instead of using black — it reads as the
surface casting its own soft glow rather than a generic drop shadow:
`accentColor.withValues(alpha: 0.3–0.4)`, same offset/blur ballpark.

### 3. Sharp corners → rounded, sized by role

Every `BoxDecoration` you touch should end up with a `borderRadius`. Pick the
value by what the element *is*, not by habit — these are the values already
in use across the app, keep new ones consistent with them:

| Element type | Radius |
|---|---|
| Big section/page-level cards | 18–22 |
| Medium cards (list items, resource rows, subject cards) | 14–18 |
| Nav tabs / grid tiles / toggle chips | 12–16 |
| Buttons | 12–16 |
| Small badges, pills, chips | 8–20 (a short pill uses a *larger* radius relative to its height, so it reads as fully rounded — e.g. a 6–8px-tall pill wants radius ~20) |
| Bottom sheets | round only the top: `BorderRadius.only(topLeft: Radius.circular(22–26), topRight: Radius.circular(22–26))` |
| Full-bleed top banners/headers | round only the bottom, same values, mirrored |

Don't forget small decorative rectangles — a colored "accent bar" next to a
list row, a thin divider chip — these look like leftover sharp edges once
their neighbors are rounded. A small `borderRadius: BorderRadius.circular(2–3)`
on something like a 5×34 accent strip is enough to fix that.

### 4. Hardcoded colors → theme-aware colors

While you're in a `BoxDecoration` or `Text`/`Icon` color anyway, check
whether it's hardcoded `AppColors.black` / `AppColors.white` on a screen that
supports dark mode. If so, swap it for the theme-aware equivalent from
`ThemeInk` (the `BuildContext` extension in
`flutter app/lib/theme/app_theme_controller.dart`):

- `context.ink` — replaces a hardcoded black/white used for primary text/icons
- `context.inkMuted` — replaces a manually-alpha'd muted text color
- `context.screenBg` — replaces `AppColors.white` used as a screen background
- `context.cardBg` — replaces `AppColors.white` used as a card fill

This isn't optional polish: a hardcoded black icon/text color on what becomes
a dark card in dark mode goes invisible. That exact bug happened once already
in this codebase (an unselected tab's label text was hardcoded black against
a newly-dark unselected-tab background) — treat any hardcoded black/white
you encounter as a thing to check, not skip.

## Two gotchas that have already bitten this exact transformation

**Removing a wrapper widget.** Sometimes a `borderRadius` +
`clipBehavior: Clip.antiAlias` on a `Container` makes a wrapping `ClipRect`
(or similar) redundant, and it's tempting to delete it. If you do, you must
remove **both** its opening call and its matching closing paren — deleting
just the opening line leaves a stray `)` at the end of the `build` method
that won't surface as an error until you run analyze, and by then the extra
paren has usually drifted away from the line you actually edited, making it
confusing to find. If you're not going to carefully trace the closing paren
too, it's safer to leave the wrapper in place and just add the new
`decoration`/`clipBehavior` alongside it.

**Trusting a find-and-replace without re-reading the surrounding braces.**
When a `Container(... border: ..., boxShadow: ...)` has several sibling
properties, replacing just the `border` and `boxShadow` lines can silently
change indentation or comma placement in a way that still parses fine in your
head but not to `dart analyze`. After each file, don't just visually skim the
diff — run analyze (below) before moving to the next file, not once at the
very end. Catching a paren mismatch immediately, in the file you just edited,
is fast; catching it after touching six more files means re-deriving which
edit caused it.

## Verification — do this after every file, not just at the end

```bash
flutter analyze lib/path/to/the_file_you_just_edited.dart
```

Fix anything it reports before moving on. Once you've worked through every
file in this pass:

```bash
dart format lib/path/to/file_one.dart lib/path/to/file_two.dart  # every touched file
flutter analyze  # whole project, catches cross-file fallout
```

Don't skip the whole-project analyze even if every individual file passed —
shared color/theme changes can surface warnings in files you didn't directly
touch (e.g. an unused variable left behind after removing a border that used
to reference it).
