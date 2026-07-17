// ==UserScript==
// @name         BBLF Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.10
// @description  Monitor for issues on Big Brother Live Feed streams, reloading or starting video when necessary. Can autoload quad cam, add hotkeys, show video scrubber, and remap fullscreen button to only show video.
// @author       liquid8d
// @match        https://www.paramountplus.com/live-tv/stream/big_brother/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=paramountplus.com
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @connect      reddit.com
// @connect      www.reddit.com

// ==/UserScript==
/*
v 1.10 (2026)
 - transport bar (apple-music style): «‹ pause ›» skips, LIVE pill with behind-time,
   PiP / panel / fullscreen buttons; pauses now stick (forcePlay respects manual pause)
 - reverted the DVR/seekable experiment: P+ only advertises an ~18s manifest window,
   and adopting it was capping rewind. buffer-only seeking restored (BBViewer was right)
 - rewind floor is now the oldest buffered data, even if the buffer fragments
v 1.9.1 (2026)
 - seek into the stream's DVR window (video.seekable) when it reaches further back
   than the session buffer - rewind can now go beyond the last reload if P+ keeps one
 - preferSeekableRange config to force buffer-only seeking if the DVR path misbehaves
v 1.9 (2026)
 - transport controls (buffer-seek logic from the BBViewer extension, 2s live-edge margin):
   ArrowLeft/Right skip 30s, ',' '.' skip 5min, 'l' go live, 'p' picture-in-picture
 - seek toast shows the jump + how far behind live you are
 - 'behind live' chip (bottom left) whenever you're off the live edge - click to snap back
 - hotkeys now preventDefault (arrows no longer scroll the page)
v 1.8.1 (2026)
 - parse the post-eviction sticky format: bullet-less lines, >!spoiler!< values,
   Evicted (with vote count) and BBB keys
 - evictions persist in localStorage so the wall remembers them on future days
 - BBB chip (blue), Evicted line in the summary strip
 - unescape HTML entities in comment bodies (&gt; etc.)
v 1.8 (2026)
 - iOS-style skin from the design mock: translucent material panel, segmented control
   with sliding thumb, system colors (#30d158/#ff453a/#ffd60a), crown + chip badges,
   hidden scrollbars, restyled audio bar to match
v 1.7 (2026)
 - House tab (cast wall): portrait grid with HOH/NOM/SAVED/POV/HN badges
 - house state auto-parsed from the mod sticky in the feed discussion thread
 - manualHouseState config override + evictedHouseguests list
 - Feed/House tab bar in the panel
v 1.6.1 (2026)
 - open panel pushes the video left (letterboxed, not stretched) so quad view is never covered
v 1.6 (2026)
 - sidebar panel ('r' to toggle) with a live r/BigBrother Feed Discussion reader
   - auto-finds the current "Feed Discussion" thread (morning/afternoon/evening/late night)
   - polls new comments every 45s, newest first, keeps your scroll position, "N new" pill
   - needs GM_xmlhttpRequest + @connect reddit.com (bypasses CORS, uses your reddit login)
v 1.5.3 (2026)
 - only hide the channel list (.channels-container), not all of .live-schedule, so the player top bar survives
v 1.5.2 (2026)
 - guide overlay is div.live-schedule in BB28, not .skin-sidebar-plugin; hide both
v 1.5.1 (2026)
 - hideGuideOverlay: hide the Live TV channel guide that pops up when hovering the left side of the video
   (previously required the companion Stylebot CSS; injected by the script now)
 - theaterMode: optionally inject the rest of the Stylebot CSS (hide header/footer/metadata)
 - audio bar now anchors inside the player instead of the viewport (no header collision, visible in fullscreen)
v 1.5 (2026)
 - quality fix now sets player qualityCategory + refreshQualities (ported from BBViewer extension inject.js)
   - old method still available via useLegacyQualityFix
 - 'f' hotkey to fullscreen only the video (disables the P+ SmartTag fullscreen handler)
 - floating audio bar: L/Center/R pan buttons + gain boost slider
 - '[' / ']' hotkeys to adjust gain boost
v 1.4 (2026)
 - no more live feed page, so removed those fixes
 - match live tv streams (live-tv/stream/big_brother/*)
 - quality fix changes (must specify preferredQuality as stream index)
	- qualityFixAttempts was added to avoid situations where quality fix isn't working
v 1.35 (2025)
 - add quality switch delay to prevent 2103 error
v 1.34 (2025)
 - fix audio pan to split channels properly
 - hookwebaudio only to primary video in case it interferes with thumbs (thumbs have no audio anyways)
v 1.33 (2025)
 - added left/right audio balance hotkeys
v 1.32 (2025)
 - thumbs fix - hotkey cam switch shouldn't get stuck on thumbs
 - player quality is now checked (i.e quality fix will apply when clicking thumbs)
v 1.31 (2025)
 - add qualityFix option for those who were quality limited
v 1.3
 - now need to click start button to use (this forces user interaction with the page to ensure js executes)
 - add removeControls (hides P+ video controls and enables scrubber on video)
v 1.2
 - add extendedWatch
*/

(function() {
    'use strict';

    const LIVETV_CAMS = [
        'https://www.paramountplus.com/live-tv/stream/big_brother/410a1e4b-a190-4964-9d66-0432ccbe36c2/',
        'https://www.paramountplus.com/live-tv/stream/big_brother/39d39a39-184b-441c-abb6-62ea5e1e5adc/',
        'https://www.paramountplus.com/live-tv/stream/big_brother/81c3ed2c-f639-406e-990d-a121fa14d4b3/',
        'https://www.paramountplus.com/live-tv/stream/big_brother/6679e2a1-f9de-464f-ac1d-9cc9dc31e27d/',
        'https://www.paramountplus.com/live-tv/stream/big_brother/524e313f-9fb2-484a-bb7a-e83b9d51d2f0/'
    ]

    const hotkeys = [
        { key: 1, action: function() { switchCam(1) } },
        { key: 2, action: function() { switchCam(2) } },
        { key: 3, action: function() { switchCam(3) } },
        { key: 4, action: function() { switchCam(4) } },
        { key: 5, action: function() { switchCam(5) } },
        { key: 'q', action: function() { adjustChannel('left') } },
        { key: 'w', action: function() { adjustChannel('none') } },
        { key: 'e', action: function() { adjustChannel('right') } },
        { key: 'f', action: function() { toggleFullscreen() } },
        { key: '[', action: function() { setGainBoost(gainBoost - 0.25) } },
        { key: ']', action: function() { setGainBoost(gainBoost + 0.25) } },
        { key: 'r', action: function() { togglePanel() } },
        { key: 'ArrowLeft', action: function() { playerSkip(-seekSmall) } },
        { key: 'ArrowRight', action: function() { playerSkip(seekSmall) } },
        { key: ',', action: function() { playerSkip(-seekLarge) } },
        { key: '.', action: function() { playerSkip(seekLarge) } },
        { key: 'l', action: function() { playerGoLive() } },
        { key: 'p', action: function() { playerPip() } }
    ]

    // force allow up to 1080p resolution
    const qualityFix = true
    // quality category to force: 'AUTO' or e.g. '540p', '720p', '1080p'
    const preferredQuality = '1080p'
    // use the old (v1.4) quality fix instead, with the stream index below
    const useLegacyQualityFix = false
	// 0 = 270p, 1 = 360p, 2 = 540p
	// 3 = 720p, 4 = 1080p (low bitrate), 5 = 1080p (high bitrate)
    const legacyQualityIndex = 4
	const qualityFixAttempts = 5
    // force switch to quad cam on page load
    const autoQuadCam = false
    // remove P+ video controls and show built-in video controls allowing scrubbing
    const removeControls = false
    // hide chat and video thumbs on fullscreen
    const fullscreenVideoOnly = false
    // reload the page when an error is encountered
    const reloadOnError = true
    // keep watching if still watching is shown
    const extendedWatch = true
    // enable hotkeys
    const enableHotkeys = true
    // hide the Live TV channel guide overlay (pops up when hovering the left side of the video)
    // note: with this on, use the 1-5 hotkeys or bookmarks to change cameras
    const hideGuideOverlay = true
    // hide P+ page chrome too (header, footer, video metadata) - same as the Stylebot CSS
    const theaterMode = false
    // show floating audio bar (pan + gain boost) over the video
    const showAudioControls = true
    // max gain boost multiplier (1 = no boost, boosting too high will distort/clip)
    const maxGainBoost = 3
    // enable 'f' hotkey to fullscreen only the video (disables the P+ built-in fullscreen handler)
    const enableFullscreenHotkey = true
    // enable the sidebar panel ('r' to toggle) with the reddit feed discussion reader
    const enablePanel = true
    // subreddit + link flair of the live feed discussion threads
    const redditSub = 'BigBrother'
    const redditFlair = 'Feed Discussion'
    // how often to poll for new comments while the panel is open (secs * ms)
    const redditCommentInterval = 45 * 1000
    // how often to re-check which discussion thread is current (secs * ms)
    const redditThreadInterval = 10 * 60 * 1000
    // how many comments to fetch per poll
    const redditCommentLimit = 75
    // panel width in px
    const panelWidth = 360
    // --- player transport controls (buffer-seek logic ported from the BBViewer extension) ---

    function getVideoEl() {
        return document.querySelector('.aa-player-skin .player-wrapper video') || document.querySelector('video')
    }

    // full buffered span: oldest data we still hold .. newest. P+ live duration/seekable are
    // useless here (the manifest window is ~18s) - the MSE buffer is the real rewind surface.
    function bufferedRange(video) {
        const b = video.buffered
        if (!b || b.length === 0) return null
        return { start: b.start(0), end: b.end(b.length - 1) }
    }

    function playerSkip(secs) {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        const range = bufferedRange(video)
        if (!range) { showSeekToast('nothing buffered yet'); return }
        const liveEdge = Math.floor(range.end) - liveEdgeMargin
        const floor = Math.floor(range.start)
        var target = Math.floor(video.currentTime) + secs
        if (target > liveEdge) target = liveEdge
        if (target < floor) target = floor
        video.currentTime = target
        log('skip ' + secs + 's -> ' + target + ' (buffer ' + floor + '..' + liveEdge + ')')
        const behind = liveEdge - target
        showSeekToast((secs < 0 ? '− ' : '+ ') + formatSecs(Math.abs(secs)) +
            (behind > liveEdgeMargin + 2 ? '  ·  ' + formatSecs(behind) + ' behind' : '  ·  live'))
        updateTransportBar()
    }

    function playerGoLive() {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        userPaused = false
        if (video.paused) video.play()
        const range = bufferedRange(video)
        if (range) video.currentTime = Math.floor(range.end) - liveEdgeMargin
        log('go live')
        showSeekToast('● LIVE')
        updateTransportBar()
    }

    function playerTogglePause() {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        if (video.paused) {
            userPaused = false
            video.play()
        } else {
            userPaused = true
            video.pause()
        }
        updateTransportBar()
    }

    function playerPip() {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        try {
            if (document.pictureInPictureElement) document.exitPictureInPicture()
            else video.requestPictureInPicture()
        } catch (e) {
            warn('pip failed: ' + e)
        }
    }

    function formatSecs(s) {
        s = Math.max(0, Math.round(s))
        const m = Math.floor(s / 60)
        return m > 0 ? m + ':' + String(s % 60).padStart(2, '0') : s + 's'
    }

    function ensureTransportUi() {
        const skin = document.querySelector('.aa-player-skin')
        if (!skin) return null
        if (getComputedStyle(skin).position === 'static') skin.style.position = 'relative'
        var toast = document.getElementById('bblf-seek-toast')
        if (!toast) {
            toast = document.createElement('div')
            toast.id = 'bblf-seek-toast'
            skin.appendChild(toast)
        }
        var bar = document.getElementById('bblf-transport')
        if (!bar && showTransportBar) {
            bar = document.createElement('div')
            bar.id = 'bblf-transport'
            const mk = function(glyph, tip, fn, id) {
                const b = document.createElement('button')
                b.className = 'bblf-tbtn'
                b.textContent = glyph
                b.title = tip
                if (id) b.id = id
                b.onclick = fn
                return b
            }
            bar.appendChild(mk('«', 'back 5 min  (,)', function() { playerSkip(-seekLarge) }))
            bar.appendChild(mk('‹', 'back 30s  (←)', function() { playerSkip(-seekSmall) }))
            bar.appendChild(mk('❚❚', 'pause / play', function() { playerTogglePause() }, 'bblf-t-play'))
            bar.appendChild(mk('›', 'forward 30s  (→)', function() { playerSkip(seekSmall) }))
            bar.appendChild(mk('»', 'forward 5 min  (.)', function() { playerSkip(seekLarge) }))
            const pill = document.createElement('button')
            pill.id = 'bblf-live-pill'
            pill.title = 'jump to live  (l)'
            const dot = document.createElement('span')
            dot.className = 'bblf-live-dot'
            dot.id = 'bblf-live-dot'
            const lbl = document.createElement('span')
            lbl.id = 'bblf-live-label'
            lbl.textContent = 'LIVE'
            pill.appendChild(dot)
            pill.appendChild(lbl)
            pill.onclick = function() { playerGoLive() }
            bar.appendChild(pill)
            const sep = document.createElement('div')
            sep.className = 'bblf-tsep'
            bar.appendChild(sep)
            bar.appendChild(mk('⧉', 'picture in picture  (p)', function() { playerPip() }))
            bar.appendChild(mk('☰', 'panel  (r)', function() { togglePanel() }))
            bar.appendChild(mk('⤢', 'fullscreen  (f)', function() { toggleFullscreen() }))
            skin.appendChild(bar)
        }
        return { toast: toast, bar: bar }
    }

    function showSeekToast(text) {
        const ui = ensureTransportUi()
        if (!ui) return
        ui.toast.textContent = text
        ui.toast.style.display = 'block'
        ui.toast.style.opacity = '1'
        if (toastTimer) clearTimeout(toastTimer)
        toastTimer = setTimeout(function() {
            ui.toast.style.opacity = '0'
            setTimeout(function() { ui.toast.style.display = 'none' }, 250)
        }, 1200)
    }

    function updateTransportBar() {
        if (!enablePlayerControls) return
        const ui = ensureTransportUi()
        if (!ui || !ui.bar) return
        const video = getVideoEl()
        if (!video) return
        const playBtn = document.getElementById('bblf-t-play')
        if (playBtn) playBtn.textContent = video.paused ? '▶' : '❚❚'
        const range = bufferedRange(video)
        const pill = document.getElementById('bblf-live-pill')
        const label = document.getElementById('bblf-live-label')
        const dot = document.getElementById('bblf-live-dot')
        if (!range || !pill || !label) return
        const behind = Math.floor(range.end) - liveEdgeMargin - Math.floor(video.currentTime)
        const atEdge = !video.paused && behind <= liveEdgeMargin + 3
        label.textContent = atEdge ? 'LIVE' : (video.paused ? 'PAUSED' : formatSecs(behind))
        pill.className = atEdge ? '' : 'bblf-behind'
        if (dot) dot.style.opacity = atEdge ? '1' : '0.35'
    }

    // --- sidebar panel + reddit feed discussion reader ---

    function ensurePanel() {
        if (document.getElementById('bblf-panel')) return
        const skin = document.querySelector('.aa-player-skin')
        if (!skin) return
        if (getComputedStyle(skin).position === 'static') skin.style.position = 'relative'

        const panel = document.createElement('div')
        panel.id = 'bblf-panel'

        // iOS-style segmented control
        const segWrap = document.createElement('div')
        segWrap.style.cssText = 'padding:12px 14px 10px;'
        const seg = document.createElement('div')
        seg.id = 'bblf-seg'
        const thumb = document.createElement('div')
        thumb.id = 'bblf-seg-thumb'
        seg.appendChild(thumb)
        ;['feed', 'house'].forEach(function(t) {
            const b = document.createElement('button')
            b.className = 'bblf-seg-btn'
            b.dataset.tab = t
            b.textContent = (t === 'feed') ? 'Feed' : 'House'
            b.onclick = function() { switchTab(t) }
            seg.appendChild(b)
        })
        segWrap.appendChild(seg)

        // feed tab
        const feedWrap = document.createElement('div')
        feedWrap.id = 'bblf-tab-feed'
        feedWrap.style.cssText = 'position:relative;flex:1;min-height:0;display:none;flex-direction:column;'

        const head = document.createElement('div')
        head.style.cssText = 'padding:10px 16px 11px;border-top:0.5px solid rgba(255,255,255,0.08);border-bottom:0.5px solid rgba(255,255,255,0.08);'
        const headRow = document.createElement('div')
        headRow.style.cssText = 'display:flex;align-items:center;gap:10px;'
        const title = document.createElement('div')
        title.id = 'bblf-panel-title'
        title.textContent = 'r/' + redditSub
        title.style.cssText = 'font-size:15px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;flex:1;letter-spacing:-0.2px;'
        const refreshBtn = document.createElement('button')
        refreshBtn.className = 'bblf-iconbtn'
        refreshBtn.textContent = '↻'
        refreshBtn.title = 'refresh now'
        refreshBtn.onclick = function() { redditRefresh(true) }
        const closeBtn = document.createElement('button')
        closeBtn.className = 'bblf-iconbtn'
        closeBtn.textContent = '✕'
        closeBtn.style.fontSize = '13px'
        closeBtn.title = "close (or press 'r')"
        closeBtn.onclick = function() { togglePanel() }
        headRow.appendChild(title)
        headRow.appendChild(refreshBtn)
        headRow.appendChild(closeBtn)
        const status = document.createElement('div')
        status.id = 'bblf-panel-status'
        status.style.cssText = 'font-size:11.5px;color:rgba(235,235,245,0.45);margin-top:6px;'
        status.textContent = 'Loading...'
        head.appendChild(headRow)
        head.appendChild(status)

        const list = document.createElement('div')
        list.id = 'bblf-reddit-list'
        list.style.cssText = 'flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain;'

        const pill = document.createElement('button')
        pill.id = 'bblf-reddit-pill'
        pill.onclick = function() {
            list.scrollTop = 0
            redditPillCount = 0
            pill.style.display = 'none'
        }
        feedWrap.appendChild(head)
        feedWrap.appendChild(list)
        feedWrap.appendChild(pill)

        // house tab
        const house = document.createElement('div')
        house.id = 'bblf-tab-house'
        house.style.cssText = 'flex:1;min-height:0;display:none;flex-direction:column;'

        panel.appendChild(segWrap)
        panel.appendChild(feedWrap)
        panel.appendChild(house)
        skin.appendChild(panel)
        applyPanel()
        switchTab(panelTab)
        log('panel added')
    }

    function togglePanel() {
        if (!enablePanel) return
        panelOpen = !panelOpen
        localStorage.setItem('bblf_panel_open', panelOpen ? '1' : '0')
        applyPanel()
    }

    function applyPanel() {
        const panel = document.getElementById('bblf-panel')
        if (!panel) return
        panel.style.display = panelOpen ? 'flex' : 'none'
        // push the video over instead of covering it (video letterboxes, no stretch)
        var push = document.getElementById('bblf-panel-push')
        if (panelOpen && !push) {
            push = document.createElement('style')
            push.id = 'bblf-panel-push'
            push.textContent = '.aa-player-skin .player-wrapper { width: calc(100% - ' + panelWidth + 'px) !important; }'
            document.head.appendChild(push)
        } else if (!panelOpen && push) {
            push.parentNode.removeChild(push)
        }
        // keep the audio bar centered over the (possibly narrowed) video
        const bar = document.getElementById('bblf-audio-bar')
        if (bar) bar.style.left = panelOpen ? 'calc(50% - ' + (panelWidth / 2) + 'px)' : '50%'
        const toast = document.getElementById('bblf-seek-toast')
        if (toast) toast.style.left = panelOpen ? 'calc(50% - ' + (panelWidth / 2) + 'px)' : '50%'
        const tbar = document.getElementById('bblf-transport')
        if (tbar) tbar.style.left = panelOpen ? 'calc(50% - ' + (panelWidth / 2) + 'px)' : '50%'
        if (panelOpen) redditStart()
        else redditStop()
    }

    function redditStart() {
        if (redditTimer) return
        redditRefresh(false)
        redditTimer = setInterval(function() { redditRefresh(false) }, redditCommentInterval)
    }

    function redditStop() {
        if (redditTimer) {
            clearInterval(redditTimer)
            redditTimer = null
        }
    }

    function gmFetchJson(url) {
        return new Promise(function(resolve, reject) {
            if (typeof GM_xmlhttpRequest === 'undefined') {
                reject(new Error('GM_xmlhttpRequest unavailable - check the @grant lines'))
                return
            }
            GM_xmlhttpRequest({
                method: 'GET',
                url: url,
                headers: { 'Accept': 'application/json' },
                timeout: 15000,
                onload: function(r) {
                    if (r.status >= 200 && r.status < 300) {
                        try { resolve(JSON.parse(r.responseText)) }
                        catch (e) { reject(new Error('reddit sent something that is not json (logged out or blocked?)')) }
                    } else {
                        reject(new Error('reddit http ' + r.status))
                    }
                },
                onerror: function() { reject(new Error('reddit request failed')) },
                ontimeout: function() { reject(new Error('reddit request timed out')) }
            })
        })
    }

    async function redditRefresh(force) {
        try {
            setPanelStatus('Updating…')
            if (force || !redditThread || (Date.now() - redditLastDiscover) > redditThreadInterval) {
                await redditDiscover()
                redditLastDiscover = Date.now()
            }
            await redditFetchComments()
            setPanelStatus('Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · r/' + redditSub)
        } catch (e) {
            setPanelStatus((e && e.message) ? e.message : String(e), true)
        }
    }

    async function redditDiscover() {
        const d = await gmFetchJson('https://www.reddit.com/r/' + redditSub + '/new.json?limit=25')
        const posts = d.data.children.map(function(c) { return c.data })
            .filter(function(p) { return p.link_flair_text === redditFlair })
        if (!posts.length) throw new Error('no "' + redditFlair + '" thread found in r/' + redditSub)
        posts.sort(function(a, b) { return b.created_utc - a.created_utc })
        const t = posts[0]
        if (!redditThread || redditThread.id !== t.id) {
            redditThread = { id: t.id, title: t.title, permalink: t.permalink }
            redditSeen = {}
            redditPillCount = 0
            const list = document.getElementById('bblf-reddit-list')
            if (list) list.innerHTML = ''
            const titleEl = document.getElementById('bblf-panel-title')
            if (titleEl) {
                titleEl.textContent = t.title
                titleEl.title = t.title
            }
            log('reddit thread: ' + t.title)
        }
    }

    async function redditFetchComments() {
        if (!redditThread) return
        const url = 'https://www.reddit.com' + redditThread.permalink.replace(/\/$/, '') +
            '.json?sort=new&limit=' + redditCommentLimit
        const d = await gmFetchJson(url)
        const list = document.getElementById('bblf-reddit-list')
        if (!list) return
        const all = d[1].data.children
            .filter(function(c) { return c.kind === 't1' })
            .map(function(c) { return c.data })
        // the stickied mod comment carries the house state (Day/HOH/Noms/...) - parse, don't display
        const sticky = all.find(function(c) { return c.stickied })
        if (sticky && sticky.body !== houseStickyBody) {
            houseStickyBody = sticky.body
            houseState = parseHouseSticky(sticky.body)
            if (houseState && houseState.evicted.length) rememberEvicted(houseState.evicted)
            log('house sticky ' + (houseState ? 'parsed (day ' + houseState.day + ')' : 'found but not parseable'))
            if (panelTab === 'house') renderHouse()
        }
        var comments = all.filter(function(c) { return !c.stickied })
        comments.sort(function(a, b) { return b.created_utc - a.created_utc })
        const fresh = comments.filter(function(c) { return !redditSeen[c.id] })
        if (!fresh.length) return
        const atTop = list.scrollTop < 40
        const heightBefore = list.scrollHeight
        // prepend oldest-of-the-new first so the newest ends up on top
        for (var i = fresh.length - 1; i >= 0; i--) {
            redditSeen[fresh[i].id] = true
            list.insertBefore(renderComment(fresh[i]), list.firstChild)
        }
        if (atTop) {
            list.scrollTop = 0
        } else {
            // keep the user's place, offer a jump-to-top pill
            list.scrollTop += list.scrollHeight - heightBefore
            redditPillCount += fresh.length
            const pill = document.getElementById('bblf-reddit-pill')
            if (pill) {
                pill.textContent = '↑ ' + redditPillCount + ' new'
                pill.style.display = 'flex'
            }
        }
    }

    function renderComment(c) {
        // textContent everywhere: comment bodies are untrusted and must never become HTML
        const el = document.createElement('div')
        el.className = 'bblf-comment'
        const meta = document.createElement('div')
        meta.className = 'bblf-c-meta'
        const user = document.createElement('span')
        user.className = 'bblf-c-user'
        user.textContent = 'u/' + c.author
        const time = document.createElement('span')
        time.className = 'bblf-c-time'
        time.textContent = timeAgo(c.created_utc)
        const score = document.createElement('span')
        score.className = 'bblf-c-score'
        score.textContent = (typeof c.score === 'number') ? '▲ ' + c.score : ''
        meta.appendChild(user)
        meta.appendChild(time)
        meta.appendChild(score)
        const body = document.createElement('div')
        body.className = 'bblf-c-body'
        body.textContent = unescapeHtml(c.body)
        el.appendChild(meta)
        el.appendChild(body)
        return el
    }

    function timeAgo(utcSecs) {
        const mins = Math.max(0, Math.round((Date.now() / 1000 - utcSecs) / 60))
        if (mins < 1) return 'now'
        if (mins < 60) return mins + 'm'
        const hours = Math.floor(mins / 60)
        if (hours < 24) return hours + 'h ' + (mins % 60) + 'm'
        return Math.floor(hours / 24) + 'd'
    }

    // --- cast wall (House tab) ---

    function switchTab(t) {
        panelTab = t
        const feed = document.getElementById('bblf-tab-feed')
        const house = document.getElementById('bblf-tab-house')
        if (feed) feed.style.display = (t === 'feed') ? 'flex' : 'none'
        if (house) house.style.display = (t === 'house') ? 'flex' : 'none'
        const thumb = document.getElementById('bblf-seg-thumb')
        if (thumb) thumb.style.transform = (t === 'feed') ? 'translateX(0%)' : 'translateX(100%)'
        if (t === 'house') renderHouse()
    }

    // parse the mod sticky. mid-week format:
    //   **Day 7**
    //   * **HOH**: Dee
    //   * **Noms**: Ashley, ~~Mallory~~, Taylor, Yash
    //   * **POV**: Mallory (used on herself)
    // post-eviction format (no bullets, spoiler-tagged values):
    //   **Day 10**
    //   **BBB**: >!Yash!<
    //   **Evicted**: >!Ashley (14-0)!<
    function parseHouseSticky(body) {
        try {
            body = unescapeHtml(body).replace(/>!/g, '').replace(/!</g, '')
            const state = { day: null, hoh: [], noms: [], vetoPlayers: [], pov: null, haveNots: [], evicted: [], bbb: null, extras: [] }
            const dayM = body.match(/\*\*Day\s+(\d+)\*\*/i)
            if (dayM) state.day = parseInt(dayM[1])
            const lines = body.split('\n')
            for (var i = 0; i < lines.length; i++) {
                const m = lines[i].match(/^\s*(?:[*-]\s+)?\*\*(.+?)\*\*\s*:\s*(.+?)\s*$/)
                if (!m) continue
                const key = m[1].trim().toLowerCase()
                const names = m[2].split(',').map(function(s) {
                    s = s.trim()
                    const struck = /~~/.test(s)
                    const note = (s.match(/\((.*)\)\s*$/) || [])[1] || null
                    const name = s.replace(/~~/g, '').replace(/\s*\(.*\)\s*$/, '').trim()
                    return { name: name, struck: struck, note: note }
                }).filter(function(n) { return n.name })
                if (key === 'hoh') state.hoh = names
                else if (key === 'noms' || key === 'nominees' || key === 'nominations') state.noms = names
                else if (key === 'veto players') state.vetoPlayers = names
                else if (key === 'pov' || key === 'veto' || key === 'veto winner') state.pov = names[0] || null
                else if (key === 'have nots' || key === 'have-nots' || key === 'havenots') state.haveNots = names
                else if (key === 'evicted') state.evicted = names
                else if (key === 'bbb' || key === 'block buster' || key === 'blockbuster') state.bbb = names[0] || null
                else state.extras.push({ label: m[1].trim(), value: m[2].trim() })
            }
            // require at least one game field so random bold lists don't count as a parse
            if (!state.hoh.length && !state.noms.length && !state.haveNots.length && !state.pov && !state.evicted.length && !state.bbb) return null
            return state
        } catch (e) {
            return null
        }
    }

    // reddit JSON bodies arrive HTML-entity-escaped
    function unescapeHtml(s) {
        return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&')
    }

    // evictions accumulate in localStorage so the wall remembers them after the sticky moves on
    function rememberEvicted(list) {
        try {
            const cur = JSON.parse(localStorage.getItem(evictedStoreKey) || '[]')
            list.forEach(function(n) {
                const name = String(n.name || n)
                if (name && !cur.some(function(x) { return x.toLowerCase() === name.toLowerCase() })) cur.push(name)
            })
            localStorage.setItem(evictedStoreKey, JSON.stringify(cur))
        } catch (e) {}
    }

    function isEvicted(name) {
        var stored = []
        try { stored = JSON.parse(localStorage.getItem(evictedStoreKey) || '[]') } catch (e) {}
        return evictedHouseguests.concat(stored).some(function(n) { return n.toLowerCase() === name.toLowerCase() })
    }

    function getHouseState() {
        return manualHouseState || houseState
    }

    function renderHouse() {
        const house = document.getElementById('bblf-tab-house')
        if (!house) return
        house.innerHTML = ''
        const state = getHouseState()

        const head = document.createElement('div')
        head.style.cssText = 'padding:12px 16px 13px;border-top:0.5px solid rgba(255,255,255,0.08);border-bottom:0.5px solid rgba(255,255,255,0.08);'
        const dayRow = document.createElement('div')
        dayRow.style.cssText = 'display:flex;align-items:baseline;gap:9px;'
        const day = document.createElement('div')
        day.style.cssText = 'font-size:23px;font-weight:700;color:#fff;letter-spacing:-0.5px;'
        day.textContent = (state && state.day) ? 'Day ' + state.day : 'House'
        const remaining = document.createElement('div')
        remaining.style.cssText = 'font-size:12px;color:rgba(235,235,245,0.42);'
        const evictedCount = HOUSEGUESTS.filter(function(n) { return isEvicted(n) }).length
        remaining.textContent = (HOUSEGUESTS.length - evictedCount) + ' remaining'
        dayRow.appendChild(day)
        dayRow.appendChild(remaining)
        head.appendChild(dayRow)

        const summary = document.createElement('div')
        summary.style.cssText = 'font-size:12px;color:rgba(235,235,245,0.62);margin-top:7px;line-height:1.45;'
        if (state) {
            var first = true
            const addPart = function(label, color, text) {
                if (!first) summary.appendChild(document.createTextNode(' · '))
                const l = document.createElement('span')
                l.style.cssText = 'color:' + color + ';font-weight:600;'
                l.textContent = label
                summary.appendChild(l)
                summary.appendChild(document.createTextNode(' ' + text))
                first = false
            }
            if (state.hoh.length) addPart('HOH', '#ffd60a', state.hoh.map(function(n) { return n.name }).join(', '))
            const liveNoms = state.noms.filter(function(n) { return !n.struck })
            if (liveNoms.length) addPart('Noms', '#ff453a', liveNoms.map(function(n) { return n.name }).join(', '))
            if (state.pov) addPart('POV', '#30d158', state.pov.name + (state.pov.note ? ' (' + state.pov.note + ')' : ''))
            if (state.bbb) addPart('BBB', '#0a84ff', state.bbb.name)
            if (state.evicted.length) addPart('Evicted', '#8e8e93', state.evicted.map(function(n) { return n.name + (n.note ? ' (' + n.note + ')' : '') }).join(', '))
            if (first) summary.textContent = 'no game info parsed yet'
        } else {
            summary.textContent = houseStickyBody
                ? 'sticky found but not parseable - raw text below'
                : 'waiting on the thread sticky (open Feed to fetch)'
        }
        head.appendChild(summary)

        const scroll = document.createElement('div')
        scroll.style.cssText = 'flex:1;min-height:0;overflow-y:auto;padding:20px 16px 26px;overscroll-behavior:contain;'
        const grid = document.createElement('div')
        grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:20px 8px;'
        HOUSEGUESTS.forEach(function(name) { grid.appendChild(renderCastCard(name, state)) })
        scroll.appendChild(grid)

        if (state && state.extras.length) {
            const ex = document.createElement('div')
            ex.style.cssText = 'font-size:11.5px;color:rgba(235,235,245,0.45);margin-top:16px;text-align:center;'
            ex.textContent = state.extras.map(function(e) { return e.label + ': ' + e.value }).join(' · ')
            scroll.appendChild(ex)
        }
        if (!state && houseStickyBody) {
            const raw = document.createElement('div')
            raw.style.cssText = 'white-space:pre-wrap;font-size:12px;color:rgba(255,255,255,0.6);margin-top:14px;'
            raw.textContent = houseStickyBody
            scroll.appendChild(raw)
        }
        house.appendChild(head)
        house.appendChild(scroll)
    }

    function hgStatus(name, state) {
        const s = { crown: false, ring: null, chip: null, dim: false, struck: false }
        const eq = function(n) { return n && n.name && n.name.toLowerCase() === name.toLowerCase() }
        const gray = 'rgba(120,120,128,0.55)'
        if (isEvicted(name)) {
            s.dim = true
            s.chip = { text: 'OUT', bg: 'rgba(90,90,95,0.55)', color: '#fff' }
            return s
        }
        if (!state) return s
        if (state.hoh.some(eq)) { s.crown = true; s.ring = '#ffd60a' }
        const nom = state.noms.find(eq)
        const isPov = state.pov && eq(state.pov)
        if (nom && nom.struck) {
            s.struck = true
            s.ring = s.ring || gray
            s.chip = { text: 'SAVED', bg: gray, color: '#fff' }
        } else if (nom) {
            s.ring = '#ff453a'
            s.chip = { text: 'NOM', bg: '#ff453a', color: '#fff' }
        }
        if (isPov) {
            s.ring = s.ring || '#30d158'
            if (!s.chip) s.chip = { text: 'V · POV', bg: '#30d158', color: '#00350f' }
        }
        if (state.bbb && eq(state.bbb)) {
            s.ring = s.ring || '#0a84ff'
            if (!s.chip) s.chip = { text: 'BBB', bg: '#0a84ff', color: '#fff' }
        }
        if (!s.chip && state.haveNots.some(eq)) s.chip = { text: 'HAVE-NOT', bg: gray, color: '#fff' }
        return s
    }

    function renderCastCard(name, state) {
        const st = hgStatus(name, state)
        const card = document.createElement('div')
        card.className = 'bblf-card'
        if (st.dim) card.style.cssText = 'opacity:0.4;filter:grayscale(1);'

        const wrap = document.createElement('div')
        wrap.style.cssText = 'position:relative;'
        const imgWrap = document.createElement('div')
        imgWrap.style.cssText = 'width:60px;height:60px;border-radius:50%;overflow:hidden;background:#3a3a3c;' +
            'box-shadow:' + (st.ring ? '0 0 0 2.5px ' + st.ring + ', ' : '') + '0 1px 3px rgba(0,0,0,0.4);'
        const img = document.createElement('img')
        img.alt = name
        img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;'
        img.onerror = function() {
            // portrait blocked (CSP) or missing: initials circle instead of a broken image
            const init = document.createElement('div')
            init.textContent = name.charAt(0).toUpperCase()
            init.style.cssText = 'width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:21px;font-weight:600;color:rgba(255,255,255,0.95);'
            if (img.parentNode === imgWrap) imgWrap.replaceChild(init, img)
        }
        img.src = castImageBase + name.toLowerCase() + '.jpg'
        imgWrap.appendChild(img)
        wrap.appendChild(imgWrap)
        if (st.crown) {
            const crown = document.createElement('div')
            crown.textContent = '👑'
            crown.style.cssText = 'position:absolute;top:-10px;right:-1px;font-size:17px;filter:drop-shadow(0 1px 1px rgba(0,0,0,0.5));transform:rotate(14deg);'
            wrap.appendChild(crown)
        }
        if (st.chip) {
            const chip = document.createElement('div')
            chip.className = 'bblf-chip'
            chip.textContent = st.chip.text
            chip.style.background = st.chip.bg
            chip.style.color = st.chip.color
            wrap.appendChild(chip)
        }
        const label = document.createElement('span')
        label.className = 'bblf-card-name'
        label.textContent = name
        if (st.struck) label.style.cssText = 'text-decoration:line-through;color:rgba(255,255,255,0.5);'
        else if (st.dim) label.style.color = 'rgba(255,255,255,0.45)'
        card.appendChild(wrap)
        card.appendChild(label)
        return card
    }

    function setPanelStatus(msg, isError) {
        const status = document.getElementById('bblf-panel-status')
        if (!status) return
        status.textContent = msg
        status.style.color = isError ? '#ff453a' : 'rgba(235,235,245,0.45)'
    }

    function updatePanUI() {
        const bar = document.getElementById('bblf-audio-bar')
        if (!bar) return
        bar.querySelectorAll('button[data-pan]').forEach((btn) => {
            const active = btn.dataset.pan === currentPan
            btn.style.background = active ? '#30d158' : 'transparent'
            btn.style.color = active ? '#00350f' : '#fff'
            btn.style.borderColor = active ? '#30d158' : 'rgba(118,118,128,0.6)'
        })
    }

    function log(msg) { console.log('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function warn(msg) { console.warn('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function error(msg) { console.error('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function info(msg) { console.info('BBLF Enhancer: (' + attempts + ') ' + msg) }
})();