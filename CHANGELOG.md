# Changelog

## 0.1.1 — 2026-10-10

* **Locale-independent test hooks.** Every toolbar control now carries a stable `data-dsa-*`
  hook (`data-dsa-tool`, `data-dsa-action`, `data-dsa-color`, `data-dsa-width`) next to its
  localized label, so tooling and tests no longer depend on the UI language.
* **CI actually passes now.** The fixture suites selected buttons by their localized `title`,
  which worked on a zh-CN machine and timed out on the English GitHub runners. They now use the
  stable hooks, and both suites accept `DSH_TEST_LOCALE` so the English environment can be
  reproduced locally. Verified green in `en-US` **and** `zh-CN` (17 + 19 checks each).
* **Releases no longer paint a red X.** `npm-publish` skips the publish step with a notice when
  `NPM_TOKEN` is not configured, so tagging a release before npm access exists is safe.

## 0.1.0 — 2026-10-09

First public release.

* **Annotate button** on the DSH original-image lightbox (native 36px round button, bottom-right).
* **Seven tools** — move · pen · arrow · box · circle · text · eraser, with the traced-points
  bounding box used for boxes/circles, so a hand-drawn closed circle still forms a shape.
* **Everything stays editable** — click to select, drag to move, corner handles to scale,
  `Delete` to remove, arrow keys to nudge; double-click a text label to re-edit it; the text tool can
  drag a placed label directly. Full undo / redo over draw, move, scale, edit and delete.
* **Delivery to the composer** — flattened at the original image resolution and handed to the
  composer's own paste intake (fallbacks: document drop → clipboard → PNG download).
* **Native styling** — built entirely from DSH design tokens (menu surface + blur + elevation for the
  toolbar, tool-bar fills for buttons, toast surface for messages, native static colors for the
  palette).
* **Zero dependencies / no build step** — one hand-written browser half (`lib/client.js`) plus a
  no-op host half; nothing is imported from `@deepseek-ai/*`.
* **Tests** — 17 fixture checks (drawing/export/delivery), 19 fixture checks (select/move/resize/
  edit), and a 21-check end-to-end run against an isolated real DSH instance.
