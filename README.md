# BBLF Enhancer

A Tampermonkey userscript that turns the **Big Brother US live feeds on Paramount+** into a proper viewing cockpit: transport controls, a Reddit live-thread reader, a cast wall that tracks the state of the house, and feed up/down status — all in a native, macOS-style UI overlaid on the player.

> **Fork of [liquid8d/browser-scripts](https://github.com/liquid8d/browser-scripts)** — the original BBLF Enhancer is by [liquid8d](https://github.com/liquid8d), who also built the [BBViewer extension](https://chromewebstore.google.com/detail/bbviewer/lofnjlciokhgalebinnlfhkicepmmceh) and [FeedBot](https://feedbot.liquid8d.dev/). This fork keeps the original's watchdog core and layers a lot on top. Several player techniques (quality category fix, fullscreen defuse, buffer seeking) were ported from BBViewer.

## Features

**From the original script**
- Watchdog loop: auto-reload on stream errors, "still watching" click-through, force play
- 1080p quality unlock (Paramount+ caps browser streams lower by default)
- Camera hotkeys, audio channel pan (feeds put different rooms on left/right channels)

**Added in this fork**
- **Transport bar** (Apple Music-style): skip ±30s / ±5min within the buffer, pause that *sticks*, jump-to-live pill showing how far behind you are, picture-in-picture, mute, fullscreen
- **Feed status via [FeedBot](https://feedbot.liquid8d.dev/)**: live dot + "up · 2h 14m" / "fish · 3m" / "down · 12m", with recent state changes and the typical outage schedule in the tooltip
- **Sidebar panel** (`r` to toggle; pushes the video over, never covers quad view):
  - **Feed** — live reader for the current r/BigBrother *Feed Discussion* thread: auto-discovers the morning/afternoon/evening/late-night thread by flair, polls comments (rate configurable), preserves your scroll position, "N new" pill
  - **House** — cast wall with portraits and badges (👑 HOH, NOM, V·POV, SAVED, HAVE-NOT, BBB, OUT), auto-parsed from the mod sticky in the discussion thread; evictions are remembered in localStorage for the rest of the season
  - **Settings** — refresh rate, quality, theater mode, and UI toggles, persisted in localStorage so they survive script updates
- **Theater mode**: locks page scrolling and hides Paramount's chrome (slide-in header, footer, hover gradients, their LIVE badge)
- Audio gain boost (up to 3×) alongside the pan controls
- iOS-style design throughout: translucent materials, segmented controls, system colors

## Install

1. Install [Tampermonkey](https://www.tampermonkey.net/) (and enable **Allow User Scripts** in the extension's settings if your browser requires it)
2. Install the script from the raw URL (Tampermonkey dashboard → Utilities → Import from URL):
   `https://raw.githubusercontent.com/stauby22/bblf-enhancer/main/bblf-enhancer.js`
3. Open a Big Brother live feed camera on Paramount+ (requires a subscription with live feeds) and click the start overlay once — everything else is automatic

`bblf-enhancer.css` is the legacy Stylebot stylesheet from the upstream repo; this fork injects its own CSS and doesn't need it.

## Hotkeys

| Key | Action |
|---|---|
| `1`–`4` | Cameras 1–4 |
| `5` | Quad cam |
| `←` / `→` | Skip ±30s |
| `,` / `.` | Skip ±5 min |
| `l` | Jump to live |
| `p` | Picture-in-picture |
| `f` | Fullscreen (video only) |
| `m` | Mute |
| `q` / `w` / `e` | Audio pan left / center / right |
| `[` / `]` | Gain boost down / up |
| `r` | Toggle sidebar panel |

## New season setup

Once a year, in the config block at the top of the script:

- Update `LIVETV_CAMS` with the season's five camera URLs
- Drop portraits into `assets/cast/bbXX/` (lowercase first names, `.jpg`) and update `castImageBase` + `HOUSEGUESTS`
- Add any sticky nicknames to `NAME_ALIASES` (e.g. `'devens': 'Rick'`)
- Bump `evictedStoreKey` and `feedbotSeason`

## Caveats

- This hooks Paramount+'s **internal, undocumented** player and DOM. It breaks when they change their site; expect to patch each season (the changelog in the script header is a history of exactly that).
- Rewind depth = what your session has buffered. Paramount's server-side DVR window is only ~18 seconds, so nobody can seek before your page load — not this script, not the extension.
- The Reddit reader uses your logged-in reddit.com session (via `GM_xmlhttpRequest`); logged-out requests may be blocked by Reddit.
- Unofficial fan project for personal use. Not affiliated with CBS, Paramount, or Reddit. Houseguest portraits are CBS promotional photography (credit embedded in the image files).

## Credits

- **[liquid8d](https://github.com/liquid8d)** — the original BBLF Enhancer userscript, the BBViewer extension whose techniques this fork ports, and the FeedBot service this fork consumes. Three of the four good ideas here are his.
- Sidebar design mocked in [Claude](https://claude.ai), built with Claude Code.
