<div align="center">

# dsh-image-annotate

**Circle it, label it, keep nudging it — then drop the annotated image straight into DSH's composer.**

For everything a screenshot alone can't point at.

[![DSH Plugin](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4f7cff)](https://github.com/topics/dsh-plugin)
[![GitHub](https://img.shields.io/badge/github-zhishengplus%2Fdsh--image--annotate-181717?logo=github&logoColor=white)](https://github.com/zhishengplus/dsh-image-annotate)
[![license](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![tests](https://img.shields.io/badge/tests-17%20%2B%2019%20%2B%2021%20passed-brightgreen)](./test)

[简体中文](README.md) | **English**

</div>

<p align="center">
  <img src="docs/demo.gif" alt="Circling, labelling and dragging marks inside the DSH image preview, then sending the result to the composer" width="820">
</p>

<p align="center"><sub>Open an image → circle the problem → type a note → drag both into place → Add to composer → send</sub></p>

---

## You know this moment

- "Move that button 8px to the left." — Which button?
- "This overlaps on narrow screens." — So you take another screenshot and draw an arrow on it.
- You hand a screenshot to an AI and say "this is broken here" — and it starts guessing where "here" is.

The problem was never the wording. **"Here" is something you have to point at.**
dsh-image-annotate turns that into two seconds: **open the image → circle it → type → Add to composer → send.**
The model receives the marked-up picture, so "here" is finally unambiguous.

> Everything happens locally — the original file is never touched.

## Quick start

1. **Click any image** in a session (a screenshot in the conversation, a draft attachment, a tool result);
2. a round **Annotate** button appears in the bottom-right of the preview — click it;
3. use **Circle / Box / Arrow** to mark the spot, or **Text** to write a short note on the image;
4. not happy with the position? **Just drag it** (see the next section);
5. hit **Add to composer** — the flattened PNG is attached to your input box, the preview closes, and you type your message as usual.

| Shortcut | Action |
|---|---|
| `V` | Select / move |
| `1`–`7` | Tools in order: move · pen · arrow · box · circle · text · eraser |
| `E` | Eraser (removes the mark you click) |
| `Ctrl/⌘ + Z` / `Ctrl/⌘ + Shift + Z` | Undo / redo |
| `Delete` | Remove the selection |
| Arrow keys (`Shift` to accelerate) | Nudge 1px / 10px |
| Text tool | Click on the image → type → `Enter` (`Esc` cancels) |

## Every mark stays editable

This is where it differs from "screenshot + a paint tool": each mark is a **live object**, not burned-in pixels.

| Action | How |
|---|---|
| Select | Switch to **Move** (`V`) and click any mark — the one you just drew is selected automatically |
| Move | Drag it; arrow keys nudge 1px, `Shift + arrows` 10px |
| Scale | Drag a corner handle of the selection box to scale proportionally (text scales its font size too) |
| Re-edit text | **Double-click** any label and rewrite it (same mark, no duplicate layer) |
| Delete | `Delete`, or the trash button (it becomes "delete selection" whenever something is selected) |
| Regret | Every step above is one undo away — `Ctrl+Z` all the way back |

<p align="center">
  <img src="docs/demo-move-text.png" alt="The circle and the text label both moved; dashed selection box with corner handles in the native accent colour" width="820">
</p>

<p align="center"><sub>The circle and the label both moved — the dashed box and corner handles use DSH's own accent colour</sub></p>

## It looks like DSH grew it itself

The whole toolbar is built from DSH design tokens instead of inventing a second visual language:

| Part | Native tokens |
|---|---|
| Toolbar surface | `--dsw-menu-surface-fill` + `--dsw-menu-backdrop-filter` + `--dsw-elevation-panel` + `--dsw-radius-lg` |
| Tool buttons | `--dsw-alias-button-tool-bar-fill` / `-hover`, `--dsw-alias-interactive-bg-hover` |
| Primary action | `--dsw-alias-button-primary-fill` + `--dsw-alias-label-primary-foreground` |
| Entry button | The **same 36px round button** as the preview's close control (`--dsw-specific-input-major` + 0.5px hairline) |
| Toasts | `--dsw-alias-toast-bg` / `-label` + `--dsw-shadow-lv3` (top-centred, like the native toast) |
| Selection | `--dsw-alias-state-business-primary` (dashed box, handles, text-field outline) |
| Palette | Native static colours: red / amber / yellow / green / blue / brand `deepseek-450` / black / white |

Light and dark themes, font-size scaling — all inherited, nothing to configure.

---

## For developers

### Three "nots" that keep it working across DSH upgrades

| | What it does | Why it helps |
|---|---|---|
| **Doesn't touch the host** | No slot registration, no React tree surgery — it overlays its own canvas + toolbar on the preview DOM and removes both when the preview closes | No state fights with the official UI, immune to re-renders |
| **Doesn't depend on internals** | No `@deepseek-ai/*` import, no injected dsh service, no `dsh-loader` needed | Internal renames or API changes can't break it |
| **Doesn't need a build** | The browser half is a hand-written `window.__ModuleLoader__.load` factory (`lib/client.js`) — no tsdown/rollup output | Edit and reload; client-modules HMR keys on mtime; the npm tarball is 4 files |

### How it works

- **Preview detection** — one stable trait: a `div[role="dialog"][aria-modal="true"]` directly under `body` whose **direct child is an `<img>`** (that's `dsh-client-ui-primitives`' `ImageLightbox`). A throttled `MutationObserver` mounts on appear and destroys on removal.
- **Coordinate system** — all marks are stored in **original-image pixels**. The overlay scales them to the displayed size; the export draws them at natural size. A 1909×1231 screenshot shown at 1427×920 therefore exports as a 1909×1231 PNG with every mark exactly where you put it.
- **Edit model** — strokes are plain objects (`{tool, color, points[], x, y, fontSize, textWidth…}`). Select / move / scale / re-edit evaluate the object and repaint the frame; a drag recomputes from the "snapshot at pointer-down + delta" each frame instead of accumulating, so nothing drifts.
- **Delivery** — the image and marks are flattened into a PNG (`File`), then a **synthetic `paste` event carrying that file** is dispatched to the Lexical input (`[data-composer-input]`) — the same path a user-pasted screenshot takes. If that is refused it falls back to a document-level `drop`, then the clipboard (with a `Ctrl+V` hint), then a plain PNG download.
- **Taint-proof export** — the original is re-fetched as a blob and decoded via `createImageBitmap` before compositing, avoiding `toBlob` SecurityErrors on cross-origin previews.

> One of the fun traps: a `position: fixed` overlay with `left: 50%` sizes itself against the space *right of* `left`, so the toolbar wrapped for no visible reason — `width: max-content` is the fix (the native Toast CSS documents the same trap).

### How far it's verified

| Suite | Covers | Result |
|---|---|---|
| `test/test_annotate.py` | canvas alignment, stroke pixels, undo, circle forming, export size, paste delivery, auto-close | **17 / 17** |
| `test/test_edit.py` | select, drag, corner-handle scaling, text drag + double-click edit, arrow-key nudge, delete and undo | **19 / 19** |
| `test/e2e_dsh.py` | a **real dsh instance** (isolated profile + own port): open preview → circle → drag → label → deliver → assert the attachment is the original 1909×1231 | **21 / 21** |

The first two run against the bundled fixture (`test/lightbox-fixture.html`, which mirrors the real preview DOM shape); the third needs a disposable instance — see [PUBLISHING.md](PUBLISHING.md) or the script header. CI (`.github/workflows/ci.yml`) runs the syntax check plus both fixture suites on every push.

### Debug

```js
__dshImageAnnotate.annotators[0].state            // tool / strokes / selected / natural / rect …
localStorage.setItem('@dsh-plugin/dsh-image-annotate.debug', '1')   // verbose logs
```

## Install

```sh
# from GitHub (works right now)
dsh plugin --profile <PROFILE> add github:zhishengplus/dsh-image-annotate

# from npm, once published
dsh plugin --profile <PROFILE> add @<scope>/dsh-image-annotate

# local development (link a checkout)
dsh plugin --profile <PROFILE> add link:/path/to/dsh-image-annotate
```

Then make sure it is listed in the profile's `package.json`:

```jsonc
"dsh": { "profile": { "bundles": [ /* …, */ "<the package name you installed>" ] } }
```

**One DSH restart is required the first time** (profile bundles are composed at boot). After that, edits to `lib/client.js` are picked up by client-modules HMR (keyed on mtime) with a page refresh.

Uninstall: remove the folder from the profile's `node_modules` and drop the line from `dsh.profile.bundles`.

## Compatibility

| | |
|---|---|
| Verified against | dsh `0.2.0-rc.2` (the plugin only relies on the preview's DOM contract, so it should survive most upgrades) |
| Node | ≥ 20 (repository scripts only — the plugin itself runs in the browser) |
| Dependencies | **none** (no `@deepseek-ai/*`, no `dsh-loader`, no third-party runtime) |

## Known limitations & next

- The pen lives on the **original-image lightbox** only; images opened from the right-hand file browser use a different document-preview component and have no entry point yet.
- Marks exist only in the newly composed PNG — no project file, and past annotations can't be reopened.
- Natural next steps: **highlighter / mosaic redaction**, a right-sidebar image entry point, and an auto-numbered "annotation list" sent alongside the image.

## License

[MIT](LICENSE) · Not affiliated with or endorsed by DeepSeek.

<div align="center">
<sub>If it ever saves you one "no, <i>this</i> one" reply, a ⭐ is appreciated.</sub>
</div>
