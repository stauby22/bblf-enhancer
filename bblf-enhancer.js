// ==UserScript==
// @name         BBLF Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.16
// @description  Monitor for issues on Big Brother Live Feed streams, reloading or starting video when necessary. Can autoload quad cam, add hotkeys, show video scrubber, and remap fullscreen button to only show video.
// @author       liquid8d
// @match        https://www.paramountplus.com/live-tv/stream/big_brother/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=paramountplus.com
// @grant        GM_log
// @grant        GM_xmlhttpRequest
// @connect      reddit.com
// @connect      www.reddit.com
// @connect      feedbot.liquid8d.dev

// ==/UserScript==
/*
v 1.16 (2026)
 - FIX for the mute flickering across a break: the bed is longer than one 45s learn pass, so
   unlearned passages scored low and released mid-break
   - learning is now CUMULATIVE: each pass is stored as its own segment and matched
     separately, so a few passes across breaks build up coverage of the whole bed
   - learn length is configurable (45s / 90s / 3m)
   - two-tier release: clearly-live audio (below 0.35) releases on the normal grace, while
     ambiguous scores hold for up to 20s rather than unmuting mid-break
 - 'Shift+D' prints a compact, pasteable diagnosis (score percentiles, transitions, profile)
v 1.15.1 (2026)
 - FIX: the fingerprint was dominated by the spectral tilt every natural audio signal shares,
   so unrelated house audio scored ~0.86 against a learned profile - above the entry threshold
   and far above the continuation threshold. The detector could mute on anything and could
   never release. Band vectors are now linear-detrended before normalising (house audio drops
   to ~0.13 in simulation, break music stays ~0.99)
 - profile storage is versioned by fingerprint; profiles from the old feature are discarded
 - entry now also has to beat a self-calibrating baseline of what the feed normally scores
 - SAFETY NET: a duck is released if it goes 45s without a full-confidence frame, so a mute
   can never latch permanently regardless of tuning
v 1.15 (2026)
 - audio engine rebuilt: source -> splitter -> [detector taps] -> trim -> level -> duck ->
   fader matrix -> merger -> boost. stages park at unity when off; graph is never rewired
 - automatic break (WBRB) muting, audio-only: 32-band normalized log-spectrum fingerprints
   matched against a learned loop with a circular sequence search, per-side state machines,
   fade-valley hold so the mute doesn't lift mid-break
 - learn mode ('k' during a break, 45s) stores the profile in localStorage
 - capture/replay harness: last 10 min of band vectors ring-buffered, 'C' dumps them,
   window.bblfReplay(capture, {entry: 0.8}) re-runs the policy offline
 - speech leveling (gated upward compression) and channel balance auto-trim, both frozen
   while a side is ducked, both hard-capped
 - continuous feed fader replaces 3-position pan; q/w/e are now jump-to-position
 - detector HUD, new Settings rows, hotkeys: k learn, j toggle, K clear, C dump
v 1.14.1 (2026)
 - hard-code BB28 evictions so far (Jason, Ashley, Lyric, Rome) in evictedHouseguests
v 1.14 (2026)
 - PiP fix for Chrome: strip P+'s disablepictureinpicture attribute before
   requesting, and surface async rejections in the seek toast
 - typical outage schedule on the House tab (below the cast grid), with
   today's row highlighted
v 1.13.2 (2026)
 - thread discovery prefers titles containing 'Feed Discussion' - the 'Feeds vs
   Episode' thread shares the flair and was hijacking the Feed tab during episodes
v 1.13.1 (2026)
 - mute button in the transport bar + 'm' hotkey
v 1.13 (2026)
 - Settings tab: reddit refresh rate (15-60s), stream quality, theater mode,
   guide hiding, transport bar, audio controls, feed status - all persisted in
   localStorage so they survive script updates; Reset button restores defaults
 - reddit 429 backoff: rate-limit responses pause polling for 2 minutes
v 1.12 (2026)
 - feed status in the transport bar via FeedBot (feedbot.liquid8d.dev):
   colored dot + 'up · 2h 14m' / 'fish · 3m' / 'down · 12m', polled every 60s
 - tooltip shows recent state changes and, when feeds aren't up, the
   typical outage schedule
v 1.11 (2026)
 - audio controls (L/C/R pan + gain boost) moved from the top bar into the transport bar
 - P+ LIVE badge hidden by text match (no stable class); logs the class it finds
 - sticky nickname aliases: Devens -> Rick, Lala -> Latrice
v 1.10.1 (2026)
 - theaterMode now on by default and expanded: page scroll locked (no more footer),
   slide-in P+ header nav hidden, hover gradient bars hidden, P+ LIVE badge hidden
 - transport bar spacing loosened (gaps, padding, pill)
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
        { key: 'p', action: function() { playerPip() } },
        { key: 'm', action: function() { playerToggleMute() } },
        { key: 'k', action: function() { wbrbStartLearn() } },
        { key: 'j', action: function() { wbrbToggle() } },
        { key: 'K', action: function() { wbrbClearProfile() } },
        { key: 'C', action: function() { wbrbDumpCapture() } },
        { key: 'D', action: function() { wbrbDiagnose() } }
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
    // theater mode: lock page scrolling and hide P+ chrome (slide-in header nav, footer,
    // metadata, hover gradient bars, their LIVE badge) - our own bars replace all of it
    const theaterMode = true
    // audio controls (pan + gain boost) in the transport bar
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
    // live threads also carry this in the title ("Afternoon Feed Discussion - ...");
    // other posts share the flair (e.g. "Feeds vs Episode"), so the title decides
    const redditTitleFilter = 'Feed Discussion'
    // how often to poll for new comments while the panel is open (secs * ms)
    const redditCommentInterval = 45 * 1000
    // how often to re-check which discussion thread is current (secs * ms)
    const redditThreadInterval = 10 * 60 * 1000
    // how many comments to fetch per poll
    const redditCommentLimit = 75
    // panel width in px
    const panelWidth = 360
    // --- player transport controls ---
    // rewind/forward within the buffer, go-live, picture-in-picture
    const enablePlayerControls = true
    // arrow key skip (secs) and ',' '.' skip (secs)
    const seekSmall = 30
    const seekLarge = 300
    // stay this far behind the live edge when going live, avoids stalls (BBViewer used 2)
    const liveEdgeMargin = 2
    // --- feed status (FeedBot) ---
    // show BB feed up/down status from feedbot.liquid8d.dev in the transport bar
    const enableFeedStatus = true
    const feedbotSeason = 'bb28'
    // how often to poll feedbot (secs * ms)
    const feedbotInterval = 60 * 1000
    // typical outage schedule (estimates, via FeedBot) - shown on the House tab, today highlighted
    const OUTAGE_SCHEDULE = [
        { day: 1, name: 'Monday', events: 'Veto Ceremony — around 11am for 1.5 hours' },
        { day: 4, name: 'Thursday', events: '"Tech rehearsals" (HOH lockdown) around 11am; feeds usually return briefly, then down around 2pm' },
        { day: 5, name: 'Friday', events: 'Nominations — around 3pm for 1.5 hours' },
        { day: 6, name: 'Saturday', events: 'Veto Picks 9am (45 min) · Veto Comp 12pm (3 hours, 6 for individual comps)' }
    ]
    // show the transport bar (apple-music style) over the video
    const showTransportBar = true
    // --- cast wall (House tab) ---
    // portraits live in the repo (assets/cast/bb28); update folder + list each season
    const castImageBase = 'https://raw.githubusercontent.com/stauby22/bblf-enhancer/main/assets/cast/bb28/'
    const HOUSEGUESTS = ['Angela', 'Ashley', 'Barrett', 'Chuk', 'Dee', 'Drew', 'Haley', 'Jason', 'Kamu', 'Latrice', 'Lyric', 'Mallory', 'Melody', 'Rick', 'Rome', 'Taylor', 'Yash']
    // manual evictions - always grayed out, merged with the ones auto-remembered from stickies
    const evictedHouseguests = ['Jason', 'Ashley', 'Lyric', 'Rome','Chuk']
    // localStorage key where auto-detected evictions accumulate (clear it or bump per season)
    const evictedStoreKey = 'bblf_evicted_bb28'
    // sticky nickname -> cast name (the mod sticky uses nicknames for some houseguests)
    const NAME_ALIASES = { 'devens': 'Rick', 'lala': 'Latrice' }
    // manual override for the house state; null = use the parsed reddit sticky. shape matches the parser output:
    // { day: 7, hoh: [{name:'Dee'}], noms: [{name:'Ashley'}, {name:'Mallory', struck:true}],
    //   vetoPlayers: [{name:'Barrett'}], pov: {name:'Mallory', note:'used on herself'},
    //   haveNots: [{name:'Chuk'}], evicted: [{name:'Ashley', note:'14-0'}], bbb: {name:'Yash'},
    //   extras: [{label:'HOH Music', value:'Chris Stapleton'}] }
    const manualHouseState = null
    // autostart video when page is loaded
    const forcePlay = true
    // delay before reloading the page on an error (secs * ms)
    const reloadDelay = 1 * 1000
    // frequency to check player status (secs * ms)
    const monitorInterval = 3 * 1000
    // max attempts to retry on failures before giving up
    const retryMaxAttempts = 10
    // reset the 'retry' attempts in the script, if it is no longer working
    const resetScript = false

    // --- audio engine ---
    // Automatic break ("we'll be right back") muting. Detection is audio-only: the video
    // frames are DRM-black to canvas, so there is no pixel evidence available to us.
    const enableAutoMute = true
    // gain a ducked side is pulled to (0 = silent; 0.05 leaves a faint hint of the break)
    const wbrbDuckGain = 0.0
    // duck fade time constant, seconds - an instantaneous gain change clicks audibly
    const wbrbDuckRamp = 0.12
    // analysis cadence (ms). learn mode records at this rate; changing it invalidates a profile
    const wbrbFrameMs = 250
    // frames in the match window. we have no visual corroboration, so this is longer than the
    // 5-frame window a visually-assisted detector can afford. shorter = faster but jumpier
    const wbrbWindowFrames = 12
    // consecutive frames over the entry threshold before ducking. lower = quicker mute, more
    // false positives; a false mute costs silence over live feeds, which is the cheaper error
    const wbrbEntryConfirmations = 3
    // cosine similarity that starts a duck. raise it if normal house audio ever trips the mute
    const wbrbEntryThreshold = 0.74
    // similarity that sustains a duck. MUST stay below entry or the duck chatters at the boundary
    const wbrbContinueThreshold = 0.66
    // how long continuation must fail before releasing (ms). too low and a break flickers
    const wbrbReleaseGraceMs = 3500
    // break music has deliberate quiet passages. if the level drops this far below the recent
    // matched level, treat it as a fade valley and hold instead of starting the release timer -
    // otherwise the mute lifts mid-break and the tail of the music hits at full volume
    const wbrbFadeValleyDropDb = 6
    // a valley can't hold the duck forever; past this the release timer runs regardless (ms)
    const wbrbFadeValleyMaxMs = 7000
    // L/R correlation above this means both sides carry identical audio (one feed on all panes).
    // telemetry only - an untested signal should not be able to mute live audio
    const wbrbDuplicateCorrelation = 0.93
    // seconds of break music one learn pass records. the bed is usually longer than this, so
    // learning is CUMULATIVE - each pass is stored as its own segment and matched separately
    const wbrbLearnSeconds = 45
    // stop the stored profile growing without bound (frames across all segments)
    const wbrbMaxProfileFrames = 2400
    // Below this the audio is clearly not the break bed (live house audio sits ~0.1-0.3), so
    // release on the normal grace. Scores BETWEEN this and the continuation threshold are
    // ambiguous - usually a passage of the same bed that was never learned - so hold instead
    // of unmuting mid-break. This is what stops the mute flickering across a long bed.
    const wbrbClearlyLiveThreshold = 0.35
    const wbrbAmbiguousHoldMs = 20000
    // fingerprint range/resolution
    const wbrbMinHz = 80
    const wbrbMaxHz = 8000
    const wbrbBandCount = 32
    // learned profile storage (bump per season - the break bed changes)
    // v2 = linear-detrend fingerprint. the key is versioned because a profile recorded with a
    // different feature is meaningless in the new vector space - old ones are discarded, not reused
    const wbrbProfileKey = 'bblf_wbrb_profile_bb28_v2'
    const wbrbFeatureVersion = 'detrend-v2'
    // entry also has to beat what this feed normally scores, so a feed whose ordinary audio
    // happens to score high can never sit permanently muted
    const wbrbEntryMarginOverBaseline = 0.15
    // SAFETY NET: a duck may not be held longer than this without at least one frame at full
    // entry confidence. real break music is a loop and re-confirms constantly, so a genuine
    // multi-hour outage keeps renewing this; a duck stuck on live audio releases on its own
    const wbrbMaxHoldWithoutStrongMs = 45000
    // capture ring buffer length for the replay harness (minutes)
    const wbrbCaptureMinutes = 10

    // channel balance auto-trim: pull a lopsided pair together. BOUNDED on purpose - without a
    // cap, a genuinely one-sided moment (house asleep on one cam) gets "corrected" into
    // amplified room tone
    const enableBalanceTrim = false
    const balanceMaxTrimDb = 6
    // rolling window the per-side average is measured over (ms)
    const balanceWindowMs = 10000
    // when the quiet side becomes the loud one, adapt this many times faster so a stale trim
    // reverses promptly instead of fighting the new imbalance
    const balanceReversalSpeedup = 4

    // speech leveling: upward compression with a gate, so 2am whispering comes up but silence
    // doesn't get pumped
    const enableLeveling = false
    const levelTargetDb = -24
    const levelMaxBoostDb = 12
    const levelMaxCutDb = 6
    // above this input level the gate is fully open
    const levelGateDb = -52
    // below this, no boost at all. between floor and gate the boost fades in, so genuine
    // whispering still gets help while true silence does not
    const levelWhisperFloorDb = -58
    const levelSmoothing = 0.08

    // HARD CAP on any automatically applied gain (dB). Do not raise this. Unbounded automatic
    // boost on a live feed is a hearing-safety issue, not a tuning preference
    const autoGainMaxDb = 12
    // continuous feed fader: -1 = left cam in both ears, 0 = stereo, +1 = right cam in both
    const faderRamp = 0.08

    // --- settings (Settings tab) ---
    // the consts above are defaults; anything changed in the panel's Settings tab is
    // stored in localStorage ('bblf_settings') and survives script updates
    const SETTINGS_DEFAULTS = {
        redditInterval: redditCommentInterval / 1000,
        preferredQuality: preferredQuality,
        theaterMode: theaterMode,
        hideGuideOverlay: hideGuideOverlay,
        showTransportBar: showTransportBar,
        showAudioControls: showAudioControls,
        enableFeedStatus: enableFeedStatus,
        autoMute: enableAutoMute,
        leveling: enableLeveling,
        balanceTrim: enableBalanceTrim,
        detectorHud: false,
        learnSeconds: wbrbLearnSeconds
    }

    // DO NOT MODIFY AFTER HERE

    // current camera (only modified to verify quad cam switch)
    var camNum = getCamera()
    // current attempts, will fail after retryMaxAttemps reached
    var attempts = 0
    // whether the P+ player controls have been removed
    var controlsRemoved = false
    // whether quality fix has been added
    var qualityFixed = false
	// count attempts at quality fix
	var qualityAttempts = 0

    // audio control variables
    const audioCtx = new (window.AudioContext)();
    let domNodes = [];
    let audioNodes = [];
    let dir = 'none';
    let gainBoost = 1;
    let currentPan = 'none';
    let fsDefused = false;
    // continuous fader position: -1 = left cam both ears, 0 = stereo, +1 = right cam both ears
    let faderPosition = 0;

    // panel / reddit state
    let panelOpen = localStorage.getItem('bblf_panel_open') === '1';
    let redditThread = null;
    let redditSeen = {};
    let redditTimer = null;
    let redditLastDiscover = 0;
    let redditPillCount = 0;
    let panelTab = 'feed';
    let houseState = null;
    let houseStickyBody = null;
    let toastTimer = null;
    let userPaused = false;
    let redditCooldownUntil = 0;
    var settingsStore = {}
    try { settingsStore = JSON.parse(localStorage.getItem('bblf_settings') || '{}') } catch (e) {}

    if (localStorage.getItem('bblf_video_monitor_attempts')) attempts = (resetScript) ? 0 : parseInt(localStorage.getItem('bblf_video_monitor_attempts'))


	function startup() {
        log('starting bblf enhancer')
		log('starting on camera ' + camNum)

		ensureStyles()

		if (autoQuadCam && camNum != 5) {
			log('switching to quad cam')
			switchCam(5)
		}

        // enable hotkeys
        if (enableHotkeys) {
            document.onkeydown = function(e) {
                const t = e.target
                if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
                if (e.ctrlKey || e.metaKey || e.altKey) return
                for (var i = 0; i < hotkeys.length; i++) {
                    const hotkey = hotkeys[i].key.toString()
                    if (e.key === hotkey || e.code === hotkey) {
                        e.preventDefault()
                        hotkeys[i].action()
                    }
                }
            }
            log('hotkeys enabled')
        }

        // start watching video
        setInterval(() => {
            checkVideo();
        }, monitorInterval);

        // feed status from feedbot
        if (enableFeedStatus) {
            refreshFeedStatus()
            setInterval(refreshFeedStatus, feedbotInterval)
        }
    }

	function getCamera() {
		for (var i = 0; i < LIVETV_CAMS.length; i++) {
			if (window.location.href == LIVETV_CAMS[i]) return i + 1
		}
	}

    function updateQualities() {
		const video = document.querySelector('video')
		if (!video || !video.player) return
		const player = video.player
		const playback = player.getAdapter('playback')
		if (!playback) return
		if (useLegacyQualityFix) { updateQualitiesLegacy(video, player, playback); return }
		// ported from BBViewer extension inject.js: raise limits, refresh, then pin the quality category
		if (playback.maxHeight != 1080 || playback.maxBitrate != 8128372) {
			log('applying quality fix (raising limits)...')
			playback.maxHeight = 1080
			playback.maxBitrate = 8128372
			playback.refreshQualities()
		}
		const wantQuality = getSetting('preferredQuality')
		if (wantQuality == 'AUTO') {
			if (!player.autoQualitySwitching) {
				player.autoQualitySwitching = true
				playback.refreshQualities()
			}
		} else if (player.qualityCategory != wantQuality) {
			log('setting quality category to ' + wantQuality)
			player.autoQualitySwitching = false
			player.qualityCategory = wantQuality
		}
    }

    function updateQualitiesLegacy(video, player, playback) {
		if (player && playback && (player.bitrate != playback.qualities[legacyQualityIndex].bitrate || !qualityFixed)) {
			if (qualityAttempts < qualityFixAttempts) {
				log('applying quality fix (legacy)...')
				qualityAttempts += 1
				playback.maxBitrate = 8128372
				playback.maxHeight = 1080
				video.player.maxBitrate = 8128372
				video.player.autoQualitySwitching = false
				playback.qualities = video.player.qualities
				setTimeout(() => {
					video.player.bitrate = playback.qualities[legacyQualityIndex].bitrate
					audioCtx.resume();
					qualityFixed = true
				}, 3000)
			} else {
				log('quality fix attempts maxed, quality fix not working for some reason.')
			}
		}
    }

    function checkVideo() {
        if (extendedWatch) {
            const countdownButton = document.querySelector('.stream-countdown-button')
            if (countdownButton) {
                log('found stream-countdown-button, clicking')
                countdownButton.click()
            }
            // watch for still watching element and restart
            const stillWatchingEl = document.querySelector('.timeout-panel-button-container')
            if (stillWatchingEl) {
                log('found timeout button, clicking')
                stillWatchingEl.click()
            }
        }

        if (attempts >= retryMaxAttempts) {
            warn('gave up, max attempts reached. Increase "maxAttempts" or set "resetScript" to true, then manually reload the page.')
            return
        }

        // check for smart tag error
        var errorEl = document.querySelector('.smart-tag-error-panel-content')
        if (errorEl) {
            warn('smart tag error found')
            if (reloadOnError) {
                // reload the page
                attempts += 1
                localStorage.setItem('bblf_video_monitor_attempts', attempts)
                setTimeout(function() { window.location.reload() }, reloadDelay)
            }
        } else {
            var startPanelEl = document.querySelector('.start-panel.show')
            if (startPanelEl) {
                warn('start panel is showing, trying to click to start video (manual user intervention may be required)')
                var clickEl = document.querySelector('.start-panel-click-overlay')
                if (clickEl) clickEl.click()
            } else {
                var videoEl = document.querySelector('.aa-player-skin .player-wrapper video')
                if (videoEl) {
					addNode(videoEl)
					if (videoEl.paused) {
                        if (forcePlay && !userPaused) {
                            // attempt to unpause video
                            info('video is available and paused, trying to force play (manual user intervention may be required)')
                            const el = document.getElementById('mcplayer')
                            if (el) el.click()
                            attempts += 1
                            localStorage.setItem('bblf_video_monitor_attempts', attempts)
                        } else {
                            // video is ok, but user doesn't want to forcePlay it
                            info('video is available and paused, "forcePlay" is not enabled')
                        }
                    } else {
						log('video is ready and playing.')
						if (audioCtx.state === 'suspended') audioCtx.resume()
						ensureStyles()
						if (enablePanel) ensurePanel()
						if (getSetting('theaterMode')) hidePlusLiveBadge()
						audioEngineInit()
						if (enablePlayerControls) updateTransportBar()
						if (enableFullscreenHotkey && !fsDefused) defuseSmartTagFullscreen()
						if (qualityFix) updateQualities()
						if (removeControls && !controlsRemoved) {
							log('removing P+ controls')
							controlsRemoved = true
							// remove the player elements
							const playerEls = ['.controls-backplane', '.controls-manager', '.top-menu-backplane']
							for (var i = 0; i < playerEls.length; i++) {
								var el = document.querySelector(playerEls[i])
								el.parentNode.removeChild(el)
							}
							// enable built-in video controls allowing scrubbing
						}
						if (controlsRemoved) videoEl.controls = true
                    }
                    attempts = 0
                    localStorage.setItem('bblf_video_monitor_attempts', 0)
                } else {
                    // missing video element, something else is wrong here
                    warn('unable to find an error or the video element, you might need to manually reload the page')
                }
            }
        }
    }

    function switchCam(num) {
        const url = LIVETV_CAMS[num - 1]
        window.open(url, '_self')
    }

    function addNode(node) {
        if (!domNodes.includes(node)) {
            domNodes.push(node);
            log('DOM node added to list');
            hookUpWebAudio(node);
			adjustChannel('none');
            log('hooked up web audio node');
        }
    }

    // Signal chain, built once and never rewired (a settings toggle parks a stage at unity
    // gain instead of touching connections):
    //
    //   source -> splitter -+-> [detector analysers L/R]   <- taps, pre-everything
    //                       +-> trim -> level -> duck -> fader matrix -> merger -> boost -> out
    //
    // The detector taps hang off the splitter, NOT off the duck output. A post-duck tap goes
    // deaf the instant it succeeds: mute, hear silence, conclude the break ended, unmute, hear
    // the break, mute again - a three-second oscillation. Two extra connections avoid it, and
    // tapping pre-trim/pre-level also keeps detection independent of our own gain changes.
    // Do not "simplify" the tap location.
    function hookUpWebAudio(node) {
        const a = {}
        a.source = audioCtx.createMediaElementSource(node)
        a.splitter = audioCtx.createChannelSplitter(2)
        a.merger = audioCtx.createChannelMerger(2)
        a.source.connect(a.splitter, 0, 0)

        // detector taps
        a.detectL = audioCtx.createAnalyser()
        a.detectR = audioCtx.createAnalyser()
        ;[a.detectL, a.detectR].forEach(function(an) {
            an.fftSize = 2048
            an.smoothingTimeConstant = 0.55
            an.minDecibels = -110
            an.maxDecibels = -10
        })
        a.splitter.connect(a.detectL, 0)
        a.splitter.connect(a.detectR, 1)
        a.freqL = new Float32Array(a.detectL.frequencyBinCount)
        a.freqR = new Float32Array(a.detectR.frequencyBinCount)
        a.timeL = new Float32Array(a.detectL.fftSize)
        a.timeR = new Float32Array(a.detectR.fftSize)

        // per-source-channel stages
        a.trimLeft = audioCtx.createGain()
        a.trimRight = audioCtx.createGain()
        a.levelLeft = audioCtx.createGain()
        a.levelRight = audioCtx.createGain()
        // duck sits on the ORIGINAL source channel, before the fader. Ducking after the fader
        // would leak break audio through whichever output gain is fed by the other channel
        a.duckLeft = audioCtx.createGain()
        a.duckRight = audioCtx.createGain()
        ;[a.trimLeft, a.trimRight, a.levelLeft, a.levelRight, a.duckLeft, a.duckRight]
            .forEach(function(g) { g.gain.value = 1 })
        a.splitter.connect(a.trimLeft, 0)
        a.splitter.connect(a.trimRight, 1)
        a.trimLeft.connect(a.levelLeft)
        a.trimRight.connect(a.levelRight)
        a.levelLeft.connect(a.duckLeft)
        a.levelRight.connect(a.duckRight)

        // fader matrix: each source channel feeds both ears through its own gain
        a.faderLL = audioCtx.createGain()
        a.faderLR = audioCtx.createGain()
        a.faderRL = audioCtx.createGain()
        a.faderRR = audioCtx.createGain()
        a.duckLeft.connect(a.faderLL)
        a.duckLeft.connect(a.faderLR)
        a.duckRight.connect(a.faderRL)
        a.duckRight.connect(a.faderRR)
        a.faderLL.connect(a.merger, 0, 0)
        a.faderRL.connect(a.merger, 0, 0)
        a.faderLR.connect(a.merger, 0, 1)
        a.faderRR.connect(a.merger, 0, 1)

        a.boost = audioCtx.createGain()
        a.boost.gain.value = gainBoost
        a.merger.connect(a.boost, 0, 0)
        a.boost.connect(audioCtx.destination)

        audioNodes.push(a)
        applyFaderGains()
    }

    // fader gains for a position. at -1 the left source feeds both ears (the old 'left' pan),
    // at +1 the right source does, at 0 it is untouched stereo
    function faderGains(p) {
        const t = Math.abs(p)
        if (p <= 0) return { ll: 1, lr: t, rl: 0, rr: 1 - t }
        return { ll: 1 - t, lr: 0, rl: t, rr: 1 }
    }

    function applyFaderGains() {
        const g = faderGains(faderPosition)
        const now = audioCtx.currentTime
        audioNodes.forEach(function(a) {
            if (!a.faderLL) return
            a.faderLL.gain.setTargetAtTime(g.ll, now, faderRamp)
            a.faderLR.gain.setTargetAtTime(g.lr, now, faderRamp)
            a.faderRL.gain.setTargetAtTime(g.rl, now, faderRamp)
            a.faderRR.gain.setTargetAtTime(g.rr, now, faderRamp)
        })
    }

    function setFaderPosition(p) {
        faderPosition = Math.max(-1, Math.min(1, p))
        currentPan = (faderPosition <= -0.995) ? 'left'
            : (faderPosition >= 0.995) ? 'right'
            : (Math.abs(faderPosition) < 0.005) ? 'none' : 'mix'
        applyFaderGains()
        updatePanUI()
        log('fader ' + faderPosition.toFixed(2) + ' (' + currentPan + ')')
    }

    // kept so the q/w/e hotkeys and the L/C/R buttons stay jump-to-position shortcuts
    function adjustChannel(dir) {
        setFaderPosition(dir === 'left' ? -1 : (dir === 'right' ? 1 : 0))
    }

    function ensureStyles() {
        if (document.getElementById('bblf-styles')) return
        var css = ''
        // .live-schedule .channels-container is the (BB28) hover channel guide list; hiding all of
        // .live-schedule also killed the player top bar (menu/cast/captions), so only hide the list.
        // .skin-sidebar-plugin was the older guide from the Stylebot CSS
        if (getSetting('hideGuideOverlay')) css += '.live-schedule .channels-container, div.skin-sidebar-plugin { display: none !important; }\n'
        if (getSetting('theaterMode')) {
            css += [
                '.header__nav', 'header nav', '#user-profiles-menu-trigger', '#kids-access-button', 'footer',
                '.video__metadata', 'div.top-menu-hint', '.top-menu-backplane', '.controls-backplane',
                '.aa-player-skin [class*="live-badge"]', '.aa-player-skin [class*="live-indicator"]'
            ].join(', ') + ' { display: none !important; }\n'
            // lock the page so scrolling can't reveal the footer
            css += 'html, body { overflow: hidden !important; }\n'
        }
        if (enablePanel || showAudioControls) css += [
            '#bblf-panel { position:absolute; top:0; right:0; bottom:0; width:' + panelWidth + 'px; z-index:2147483646;',
            '  display:none; flex-direction:column; background:rgba(28,28,30,0.72);',
            '  backdrop-filter:blur(30px) saturate(180%); -webkit-backdrop-filter:blur(30px) saturate(180%);',
            '  border-left:0.5px solid rgba(255,255,255,0.12); color:#fff;',
            '  font-family:-apple-system,BlinkMacSystemFont,\'SF Pro Text\',sans-serif; font-size:13px; -webkit-font-smoothing:antialiased; }',
            '#bblf-panel ::-webkit-scrollbar { width:0; height:0; }',
            '#bblf-seg { position:relative; display:flex; background:rgba(118,118,128,0.24); border-radius:9px; padding:2px; height:32px; }',
            '#bblf-seg-thumb { position:absolute; top:2px; bottom:2px; left:2px; width:calc((100% - 4px) / 3); background:rgba(110,110,118,0.92);',
            '  border-radius:7px; box-shadow:0 1px 3px rgba(0,0,0,0.35); transition:transform 0.34s cubic-bezier(0.34,1.56,0.64,1); }',
            '.bblf-seg-btn { position:relative; z-index:1; flex:1; border:none; background:none; color:#fff; font-size:13px; font-weight:600; font-family:inherit; cursor:pointer; }',
            '.bblf-iconbtn { width:28px; height:28px; border-radius:50%; border:none; background:rgba(118,118,128,0.24); color:rgba(255,255,255,0.75);',
            '  font-size:14px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-family:inherit; }',
            '.bblf-iconbtn:hover { background:rgba(118,118,128,0.4); color:#fff; }',
            '.bblf-comment { padding:12px 16px; border-bottom:0.5px solid rgba(255,255,255,0.07); }',
            '.bblf-c-meta { display:flex; align-items:center; gap:7px; margin-bottom:5px; }',
            '.bblf-c-user { font-size:13px; font-weight:600; color:#30d158; }',
            '.bblf-c-time { font-size:12px; color:rgba(235,235,245,0.4); }',
            '.bblf-c-score { margin-left:auto; font-size:12px; color:rgba(235,235,245,0.5); letter-spacing:0.2px; }',
            '.bblf-c-body { font-size:13.5px; line-height:1.42; color:rgba(255,255,255,0.86); white-space:pre-wrap; word-wrap:break-word; }',
            '#bblf-reddit-pill { position:absolute; top:92px; left:50%; transform:translateX(-50%); display:none; align-items:center; gap:5px;',
            '  padding:6px 14px; border:0.5px solid rgba(255,255,255,0.14); border-radius:16px; background:rgba(48,209,88,0.9); color:#00350f;',
            '  font-size:12.5px; font-weight:600; font-family:inherit; cursor:pointer; box-shadow:0 4px 14px rgba(0,0,0,0.4); z-index:1; }',
            '#bblf-reddit-pill:hover { background:rgba(48,209,88,1); }',
            '.bblf-chip { position:absolute; bottom:-7px; left:50%; transform:translateX(-50%); padding:1.5px 7px; border-radius:6px;',
            '  font-size:9.5px; font-weight:700; letter-spacing:0.4px; white-space:nowrap; box-shadow:0 1px 2px rgba(0,0,0,0.45); }',
            '.bblf-card { display:flex; flex-direction:column; align-items:center; gap:10px; }',
            '.bblf-card-name { font-size:12.5px; font-weight:500; text-align:center; color:rgba(255,255,255,0.92); }',
            '#bblf-transport input[type=range] { accent-color:#30d158; }',
            '.bblf-set-row { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 16px; border-bottom:0.5px solid rgba(255,255,255,0.07); }',
            '.bblf-set-label { font-size:13px; color:rgba(255,255,255,0.9); }',
            '.bblf-set-sub { font-size:11px; color:rgba(235,235,245,0.45); margin-top:2px; }',
            '.bblf-switch { width:44px; height:26px; border-radius:13px; background:rgba(118,118,128,0.32); border:none; position:relative; cursor:pointer; transition:background 0.2s; flex-shrink:0; padding:0; }',
            '.bblf-switch.on { background:#30d158; }',
            '.bblf-knob { position:absolute; top:2px; left:2px; width:22px; height:22px; border-radius:50%; background:#fff; transition:left 0.2s; box-shadow:0 1px 3px rgba(0,0,0,0.3); }',
            '.bblf-switch.on .bblf-knob { left:20px; }',
            '.bblf-chips { display:flex; gap:4px; }',
            '.bblf-chip-btn { border:none; background:rgba(118,118,128,0.24); color:rgba(255,255,255,0.8); font:600 11px -apple-system,BlinkMacSystemFont,sans-serif; padding:5px 9px; border-radius:8px; cursor:pointer; }',
            '.bblf-chip-btn.on { background:#30d158; color:#00350f; }',
            '#bblf-seek-toast { position:absolute; bottom:140px; left:50%; transform:translateX(-50%); z-index:2147483647;',
            '  display:none; padding:6px 14px; border-radius:16px; background:rgba(28,28,30,0.72);',
            '  backdrop-filter:blur(30px) saturate(180%); -webkit-backdrop-filter:blur(30px) saturate(180%);',
            '  border:0.5px solid rgba(255,255,255,0.14); color:#fff; pointer-events:none; opacity:0;',
            '  font:600 12.5px -apple-system,BlinkMacSystemFont,sans-serif; transition:opacity 0.25s; box-shadow:0 4px 14px rgba(0,0,0,0.4); }',
            '#bblf-transport { position:absolute; bottom:80px; left:50%; transform:translateX(-50%); z-index:2147483646;',
            '  display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:16px; background:rgba(28,28,30,0.72);',
            '  backdrop-filter:blur(30px) saturate(180%); -webkit-backdrop-filter:blur(30px) saturate(180%);',
            '  border:0.5px solid rgba(255,255,255,0.12); box-shadow:0 4px 14px rgba(0,0,0,0.4); }',
            '.bblf-tbtn { background:none; border:none; color:rgba(255,255,255,0.75); cursor:pointer; padding:6px 10px;',
            '  border-radius:8px; line-height:1; font:600 15px -apple-system,BlinkMacSystemFont,sans-serif; }',
            '.bblf-tbtn:hover { color:#fff; background:rgba(118,118,128,0.24); }',
            '#bblf-t-play { min-width:32px; text-align:center; }',
            '.bblf-tsep { width:0.5px; height:18px; background:rgba(255,255,255,0.16); margin:0 10px; }',
            '#bblf-live-pill { display:flex; align-items:center; gap:6px; border:0.5px solid transparent; cursor:pointer; padding:5px 12px;',
            '  margin-left:8px; border-radius:12px; background:transparent; color:rgba(255,255,255,0.85);',
            '  font:700 11px -apple-system,BlinkMacSystemFont,sans-serif; letter-spacing:0.5px; }',
            '#bblf-live-pill.bblf-behind { background:rgba(255,69,58,0.18); border-color:rgba(255,69,58,0.5); color:#fff; }',
            '#bblf-live-pill:hover { background:rgba(118,118,128,0.3); }',
            '.bblf-live-dot { width:7px; height:7px; border-radius:50%; background:#ff453a; box-shadow:0 0 8px #ff453a; display:inline-block; }'
        ].join('\n') + '\n'
        if (!css) return
        const style = document.createElement('style')
        style.id = 'bblf-styles'
        style.textContent = css
        document.head.appendChild(style)
        log('styles injected')
    }

    function toggleFullscreen() {
        if (document.fullscreenElement) {
            document.exitFullscreen()
        } else {
            const el = document.querySelector('.aa-player-skin .player-wrapper') || document.querySelector('video')
            if (el) el.requestFullscreen()
        }
    }

    function defuseSmartTagFullscreen() {
        // stop the P+ player's own fullscreen handler from also acting on 'f' (ported from BBViewer extension inject.js)
        try {
            const w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window
            if (w.SmartTag && w.SmartTag.capabilities && w.SmartTag.capabilities.utils && w.SmartTag.capabilities.utils.FullScreen) {
                w.SmartTag.capabilities.utils.FullScreen = null
                fsDefused = true
                log('disabled P+ SmartTag fullscreen handler')
            }
        } catch (e) {
            warn('could not disable P+ fullscreen handler: ' + e)
        }
    }

    function setGainBoost(val) {
        gainBoost = Math.min(maxGainBoost, Math.max(1, Math.round(val * 100) / 100))
        audioNodes.forEach((audioNode) => { if (audioNode.boost) audioNode.boost.gain.value = gainBoost })
        const slider = document.getElementById('bblf-gain-slider')
        if (slider) slider.value = gainBoost
        const label = document.getElementById('bblf-gain-label')
        if (label) label.textContent = gainBoost.toFixed(2) + 'x'
        log('gain boost: ' + gainBoost)
    }

    // --- audio engine: detection, leveling, trim, harness ---
    //
    // Split into POLICY (pure, decides) and AUTHORITY (owns the sound). A policy can sustain a
    // duck that already exists but never creates one - only fresh verified evidence acquires it.
    // The detector is out of the signal path entirely: a detector bug can misjudge a break, but
    // it cannot break audio.

    let wbrbTimer = null
    let wbrbProfile = null
    let wbrbLearning = false
    let wbrbLearnFrames = []
    let wbrbCorrelation = 0
    let wbrbCapture = []
    let wbrbEvents = []
    const wbrbSide = { left: wbrbNewSideState(), right: wbrbNewSideState() }

    function wbrbNewSideState() {
        return {
            recent: [], score: -1, confirmations: 0, active: false,
            failingSince: 0, matchedLevelDb: -100, valleySince: 0, levelDb: -100,
            levelGainDb: 0, avgDb: -100, baseline: -1, lastStrongAt: 0, ambiguousSince: 0
        }
    }

    // --- dsp (pure) ---

    // mean-centre and scale to unit magnitude, making the feature a pure spectral SHAPE - a loud
    // break and a quiet one produce the same vector, so matching is volume-independent
    function wbrbNormalize(values) {
        const n = values.length
        if (!n) return []
        var mean = 0
        for (var i = 0; i < n; i++) mean += values[i]
        mean /= n
        const out = new Array(n)
        var magSq = 0
        for (var j = 0; j < n; j++) {
            const v = values[j] - mean
            out[j] = v
            magSq += v * v
        }
        const mag = Math.sqrt(magSq)
        if (mag < 1e-8) return out.fill(0)
        for (var k = 0; k < n; k++) out[k] /= mag
        return out
    }

    // collapse an FFT magnitude spectrum (dB) into log-spaced bands, summing in the POWER domain -
    // averaging decibels understates the loudest bins in a band
    function wbrbSpectrumToBands(freqDb, sampleRate, fftSize) {
        const nyquist = sampleRate / 2
        const maxHz = Math.min(wbrbMaxHz, nyquist)
        const binsPerHz = fftSize / sampleRate
        const ratio = maxHz / wbrbMinHz
        const bands = new Array(wbrbBandCount)
        for (var b = 0; b < wbrbBandCount; b++) {
            const startHz = wbrbMinHz * Math.pow(ratio, b / wbrbBandCount)
            const endHz = wbrbMinHz * Math.pow(ratio, (b + 1) / wbrbBandCount)
            const startBin = Math.max(0, Math.min(freqDb.length - 1, Math.floor(startHz * binsPerHz)))
            const endBin = Math.max(startBin + 1, Math.min(freqDb.length, Math.ceil(endHz * binsPerHz)))
            var power = 0, count = 0
            for (var bin = startBin; bin < endBin; bin++) {
                const db = Number.isFinite(freqDb[bin]) ? freqDb[bin] : -120
                power += Math.pow(10, db / 10)
                count++
            }
            const meanPower = count > 0 ? power / count : 1e-12
            bands[b] = 10 * Math.log10(Math.max(meanPower, 1e-12))
        }
        return wbrbDetrendNormalize(bands)
    }

    // Remove the straight-line trend across band index, THEN mean-centre and unit-scale.
    //
    // This is the difference between a working detector and a broken one. Every natural audio
    // signal - break music, conversation, room tone - shares a broad downward spectral tilt.
    // Mean-centring alone leaves that tilt dominating the vector, so unrelated audio scored
    // ~0.86 against a learned profile: above the entry threshold and far above the continuation
    // threshold, which meant the detector could mute on anything and then never release.
    // Detrending strips the shared component and leaves what actually distinguishes the music.
    // (Differencing adjacent bands works about as well; detrending keeps more of the shape and
    // amplifies noise less.)
    function wbrbDetrendNormalize(values) {
        const n = values.length
        if (n < 3) return wbrbNormalize(values)
        var sx = 0, sy = 0, sxy = 0, sxx = 0
        for (var i = 0; i < n; i++) {
            sx += i; sy += values[i]; sxy += i * values[i]; sxx += i * i
        }
        const denom = n * sxx - sx * sx
        const slope = (Math.abs(denom) < 1e-9) ? 0 : (n * sxy - sx * sy) / denom
        const intercept = (sy - slope * sx) / n
        const flat = new Array(n)
        for (var j = 0; j < n; j++) flat[j] = values[j] - (slope * j + intercept)
        return wbrbNormalize(flat)
    }

    function wbrbCosine(a, b) {
        if (!a || !b || a.length !== b.length) return -1
        var dot = 0
        for (var i = 0; i < a.length; i++) dot += a[i] * b[i]
        return Math.max(-1, Math.min(1, dot))
    }

    // slide the recent window around the learned loop at every start offset, keep the best mean
    // similarity. circular because a break joins the music partway through - it is a loop, not
    // a track with a beginning
    // A profile holds one segment per learn pass. Segments are matched separately rather than
    // concatenated, so a window can never span the seam between two unrelated recordings.
    function wbrbProfileSegments(profile) {
        if (!profile) return []
        if (Array.isArray(profile.segments)) return profile.segments
        if (Array.isArray(profile.frames)) return [profile.frames]
        return []
    }

    function wbrbProfileFrameCount(profile) {
        return wbrbProfileSegments(profile).reduce(function(n, seg) { return n + seg.length }, 0)
    }

    function wbrbMatchProfile(profile, recent) {
        var best = -1
        wbrbProfileSegments(profile).forEach(function(seg) {
            const s = wbrbSequenceMatch(seg, recent)
            if (s > best) best = s
        })
        return best
    }

    function wbrbSequenceMatch(learned, recent) {
        if (!learned || !learned.length || !recent.length) return -1
        const n = learned.length
        var best = -1
        for (var start = 0; start < n; start++) {
            var total = 0
            for (var i = 0; i < recent.length; i++) total += wbrbCosine(learned[(start + i) % n], recent[i])
            const score = total / recent.length
            if (score > best) best = score
        }
        return best
    }

    function wbrbRmsDb(samples) {
        var sum = 0
        for (var i = 0; i < samples.length; i++) sum += samples[i] * samples[i]
        return 20 * Math.log10(Math.max(Math.sqrt(sum / samples.length), 1e-7))
    }

    // pearson correlation with a small lag search - two feeds carrying the same source can be a
    // few ms apart
    function wbrbLaggedCorrelation(left, right, maxLag, step) {
        maxLag = maxLag || 480
        step = step || 8
        var best = 0
        for (var lag = -maxLag; lag <= maxLag; lag += step) {
            const s = Math.max(0, -lag)
            const e = Math.min(left.length, right.length - lag)
            if (e - s < 256) continue
            var sumL = 0, sumR = 0
            for (var i = s; i < e; i++) { sumL += left[i]; sumR += right[i + lag] }
            const n = e - s
            const mL = sumL / n, mR = sumR / n
            var num = 0, dL = 0, dR = 0
            for (var j = s; j < e; j++) {
                const a = left[j] - mL, b = right[j + lag] - mR
                num += a * b; dL += a * a; dR += b * b
            }
            const den = Math.sqrt(dL * dR)
            if (den > 1e-9) best = Math.max(best, Math.abs(num / den))
        }
        return best
    }

    // --- policy (pure: no audio access, reused verbatim by the replay harness) ---

    // returns 'enter' | 'release' | null, mutating only the passed state object
    function wbrbPolicyStep(st, score, levelDb, now, cfg) {
        st.score = score
        st.levelDb = levelDb
        if (score >= cfg.entry) st.lastStrongAt = now
        if (!st.active) {
            // Baseline of what this feed normally scores. Falls fast and rises slowly, so it
            // tracks ordinary audio rather than being dragged up by a passing match.
            if (st.baseline < 0) st.baseline = score
            else st.baseline += (score < st.baseline ? 0.05 : 0.005) * (score - st.baseline)
            const beatsBaseline = score >= st.baseline + cfg.entryMargin
            if (score >= cfg.entry && beatsBaseline) {
                st.confirmations++
                if (st.confirmations >= cfg.confirmations) {
                    st.active = true
                    st.failingSince = 0
                    st.valleySince = 0
                    st.matchedLevelDb = levelDb
                    st.lastStrongAt = now
                    return 'enter'
                }
            } else {
                st.confirmations = 0
            }
            return null
        }
        // SAFETY NET first: however confident the continuation logic feels, a duck that has not
        // seen full entry-level evidence for this long is released. Never let a mute latch.
        if (now - st.lastStrongAt >= cfg.maxHoldWithoutStrongMs) {
            st.active = false
            st.confirmations = 0
            st.failingSince = 0
            st.valleySince = 0
            return 'release'
        }
        if (score >= cfg.continue_) {
            st.failingSince = 0
            st.valleySince = 0
            st.ambiguousSince = 0
            // track the level of confidently-matched music so a valley is measurable against it
            st.matchedLevelDb = st.matchedLevelDb * 0.88 + levelDb * 0.12
            return null
        }
        // Ambiguous zone: too low to confirm, too high to be live house audio. Almost always a
        // passage of the same bed that was not part of any learn pass. Hold - releasing here is
        // what made the mute flicker on and off across a long break bed.
        if (score >= cfg.clearlyLive) {
            if (!st.ambiguousSince) st.ambiguousSince = now
            if (now - st.ambiguousSince < cfg.ambiguousHoldMs) {
                st.failingSince = 0
                return null
            }
        } else {
            st.ambiguousSince = 0
        }
        const inValley = (st.matchedLevelDb - levelDb) >= cfg.valleyDropDb
        if (inValley) {
            if (!st.valleySince) st.valleySince = now
            if (now - st.valleySince < cfg.valleyMaxMs) {
                st.failingSince = 0
                return null
            }
            // valley cap exceeded. credit the time already spent in the valley toward the
            // grace, so a stuck valley tops out at valleyMaxMs instead of valleyMaxMs + graceMs
            // (7s of silence over live feeds, not 10.5s)
            if (!st.failingSince) st.failingSince = st.valleySince
        } else if (!st.failingSince) {
            st.failingSince = now
        }
        if (now - st.failingSince >= cfg.graceMs) {
            st.active = false
            st.confirmations = 0
            st.failingSince = 0
            st.valleySince = 0
            return 'release'
        }
        return null
    }

    function wbrbConfig() {
        return {
            entry: wbrbEntryThreshold,
            continue_: wbrbContinueThreshold,
            confirmations: wbrbEntryConfirmations,
            graceMs: wbrbReleaseGraceMs,
            valleyDropDb: wbrbFadeValleyDropDb,
            valleyMaxMs: wbrbFadeValleyMaxMs,
            entryMargin: wbrbEntryMarginOverBaseline,
            maxHoldWithoutStrongMs: wbrbMaxHoldWithoutStrongMs,
            clearlyLive: wbrbClearlyLiveThreshold,
            ambiguousHoldMs: wbrbAmbiguousHoldMs
        }
    }

    // --- gain stages (pure math, applied by the authority below) ---

    // upward compression toward a target with a gated floor. returns dB of gain to apply
    function levelingGainDb(inputDb) {
        var want = levelTargetDb - inputDb
        want = Math.max(-levelMaxCutDb, Math.min(levelMaxBoostDb, want))
        // fade the boost out between the whisper floor and the gate so whispers get help but
        // true silence is never pumped
        if (inputDb <= levelWhisperFloorDb) return 0
        if (inputDb < levelGateDb && want > 0) {
            const openness = (inputDb - levelWhisperFloorDb) / (levelGateDb - levelWhisperFloorDb)
            want *= Math.max(0, Math.min(1, openness))
        }
        return Math.max(-autoGainMaxDb, Math.min(autoGainMaxDb, want))
    }

    function dbToGain(db) {
        return Math.pow(10, Math.max(-autoGainMaxDb, Math.min(autoGainMaxDb, db)) / 20)
    }

    // --- authority: owns the duck, leveling and trim gains ---

    function wbrbSetDuck(side, ducked) {
        const target = ducked ? wbrbDuckGain : 1
        const now = audioCtx.currentTime
        audioNodes.forEach(function(a) {
            const g = (side === 'left') ? a.duckLeft : a.duckRight
            if (g) g.gain.setTargetAtTime(target, now, wbrbDuckRamp)
        })
    }

    function applyStageGains() {
        const now = audioCtx.currentTime
        const levelOn = getSetting('leveling')
        const trimOn = getSetting('balanceTrim')
        audioNodes.forEach(function(a) {
            if (!a.levelLeft) return
            a.levelLeft.gain.setTargetAtTime(levelOn ? dbToGain(wbrbSide.left.levelGainDb) : 1, now, 0.25)
            a.levelRight.gain.setTargetAtTime(levelOn ? dbToGain(wbrbSide.right.levelGainDb) : 1, now, 0.25)
            a.trimLeft.gain.setTargetAtTime(trimOn ? dbToGain(balanceTrimDb.left) : 1, now, 0.5)
            a.trimRight.gain.setTargetAtTime(trimOn ? dbToGain(balanceTrimDb.right) : 1, now, 0.5)
        })
    }

    var balanceTrimDb = { left: 0, right: 0 }

    function updateLevelingAndTrim() {
        const L = wbrbSide.left, R = wbrbSide.right
        const alpha = wbrbFrameMs / balanceWindowMs

        ;['left', 'right'].forEach(function(key) {
            const st = wbrbSide[key]
            // FREEZE while ducked. Otherwise the ducked side reads as near-silence, leveling
            // boosts toward max, and the accumulated boost lands on live audio the moment the
            // duck releases - the unmute blasts the user, which is the exact failure this
            // whole feature exists to prevent
            if (st.active) return
            st.avgDb = (st.avgDb <= -99) ? st.levelDb : st.avgDb * (1 - alpha) + st.levelDb * alpha
            const want = levelingGainDb(st.levelDb)
            st.levelGainDb = st.levelGainDb * (1 - levelSmoothing) + want * levelSmoothing
        })

        // balance trim also freezes while either side is ducked - a ducked channel reads quiet
        // and the trim would "fix" the imbalance it just created
        if (!L.active && !R.active) {
            var diff = L.avgDb - R.avgDb
            if (!Number.isFinite(diff)) diff = 0
            diff = Math.max(-balanceMaxTrimDb, Math.min(balanceMaxTrimDb, diff))
            const wantL = -diff / 2, wantR = diff / 2
            // adapt faster when the correction reverses sign, so a stale trim doesn't fight a
            // genuinely flipped imbalance
            const reversing = (wantL * balanceTrimDb.left) < 0
            const k = Math.min(1, alpha * (reversing ? balanceReversalSpeedup : 1))
            balanceTrimDb.left = balanceTrimDb.left * (1 - k) + wantL * k
            balanceTrimDb.right = balanceTrimDb.right * (1 - k) + wantR * k
        }
        applyStageGains()
    }

    // --- detector loop ---

    function wbrbTick() {
        if (!audioNodes.length) return
        const a = audioNodes[0]
        if (!a.detectL || !a.detectR) return
        const now = Date.now()
        const sr = audioCtx.sampleRate

        const sides = [
            { key: 'left', an: a.detectL, freq: a.freqL, time: a.timeL },
            { key: 'right', an: a.detectR, freq: a.freqR, time: a.timeR }
        ]
        const bandsByKey = {}
        sides.forEach(function(s) {
            s.an.getFloatFrequencyData(s.freq)
            s.an.getFloatTimeDomainData(s.time)
            const st = wbrbSide[s.key]
            st.levelDb = wbrbRmsDb(s.time)
            bandsByKey[s.key] = wbrbSpectrumToBands(s.freq, sr, s.an.fftSize)
            if (!wbrbLearning) {
                st.recent.push(bandsByKey[s.key])
                if (st.recent.length > wbrbWindowFrames) st.recent.shift()
            }
        })
        wbrbCorrelation = wbrbLaggedCorrelation(a.timeL, a.timeR)

        if (wbrbLearning) {
            // record the louder side - that is the one carrying the break bed
            const key = wbrbSide.left.levelDb >= wbrbSide.right.levelDb ? 'left' : 'right'
            wbrbLearnFrames.push(bandsByKey[key])
            if (wbrbLearnFrames.length >= Math.round((getSetting('learnSeconds') * 1000) / wbrbFrameMs)) wbrbStopLearn(true)
            wbrbUpdateHud()
            return
        }

        const cfg = wbrbConfig()
        const armed = getSetting('autoMute') && !!wbrbProfile
        ;['left', 'right'].forEach(function(key) {
            const st = wbrbSide[key]
            if (st.recent.length < wbrbWindowFrames) return
            const score = wbrbProfile ? wbrbMatchProfile(wbrbProfile, st.recent) : -1
            if (!armed) {
                st.score = score
                // a disarmed detector must never hold a duck
                if (st.active) { st.active = false; wbrbSetDuck(key, false) }
                return
            }
            const verdict = wbrbPolicyStep(st, score, st.levelDb, now, cfg)
            if (verdict) {
                wbrbEvents.push({ t: now, side: key, event: verdict, score: Math.round(score * 1000) / 1000 })
                while (wbrbEvents.length > 200) wbrbEvents.shift()
            }
            if (verdict === 'enter') {
                wbrbSetDuck(key, true)
                log('wbrb: ' + key + ' ducked (score ' + score.toFixed(3) + ')')
                showSeekToast('break detected — ' + key + ' muted')
            } else if (verdict === 'release') {
                wbrbSetDuck(key, false)
                log('wbrb: ' + key + ' released')
                showSeekToast('feeds back — ' + key)
            }
        })

        updateLevelingAndTrim()
        wbrbRecordCapture(now, bandsByKey)
        wbrbUpdateHud()
    }

    // --- replay harness ---
    //
    // Live breaks happen a few times a day on no schedule. Tuning against them directly gives
    // about four iterations per day. Capture lets a threshold change be tested in one second
    // against every break ever recorded, and doubles as regression coverage.

    function wbrbRecordCapture(now, bandsByKey) {
        const cap = Math.round((wbrbCaptureMinutes * 60 * 1000) / wbrbFrameMs)
        const r3 = function(v) { return Math.round(v * 1000) / 1000 }
        wbrbCapture.push({
            t: now,
            dbL: Math.round(wbrbSide.left.levelDb * 10) / 10,
            dbR: Math.round(wbrbSide.right.levelDb * 10) / 10,
            sL: r3(wbrbSide.left.score),
            sR: r3(wbrbSide.right.score),
            bL: bandsByKey.left.map(r3),
            bR: bandsByKey.right.map(r3)
        })
        while (wbrbCapture.length > cap) wbrbCapture.shift()
    }

    function wbrbDumpCapture() {
        const payload = {
            createdAt: Date.now(),
            frameMs: wbrbFrameMs,
            bandCount: wbrbBandCount,
            profileFrames: wbrbProfile ? wbrbProfile.frames.length : 0,
            frames: wbrbCapture
        }
        const json = JSON.stringify(payload)
        window.bblfLastCapture = payload
        try {
            navigator.clipboard.writeText(json)
            showSeekToast('capture copied (' + wbrbCapture.length + ' frames)')
        } catch (e) {
            showSeekToast('capture at window.bblfLastCapture')
        }
        log('capture: ' + wbrbCapture.length + ' frames, also at window.bblfLastCapture')
        return payload
    }

    // Compact, pasteable summary of what the detector has been seeing. This is the thing to
    // share when the detector misbehaves - it is small enough to paste, unlike a raw capture.
    function wbrbDiagnose() {
        const pct = function(arr, p) {
            if (!arr.length) return NaN
            const s = arr.slice().sort(function(a, b) { return a - b })
            return s[Math.min(s.length - 1, Math.floor(s.length * p))]
        }
        const lines = []
        const segs = wbrbProfileSegments(wbrbProfile)
        lines.push('BBLF detector diagnosis')
        lines.push('profile: ' + (wbrbProfile
            ? segs.length + ' pass(es), ' + wbrbProfileFrameCount(wbrbProfile) + ' frames (' +
              Math.round(wbrbProfileFrameCount(wbrbProfile) * wbrbFrameMs / 1000) + 's), feature ' +
              (wbrbProfile.feature || '?') + ', segment lengths ' + segs.map(function(s) { return s.length }).join('/')
            : 'NONE'))
        lines.push('settings: entry ' + wbrbEntryThreshold + ' continue ' + wbrbContinueThreshold +
            ' clearlyLive ' + wbrbClearlyLiveThreshold + ' window ' + wbrbWindowFrames +
            ' learn ' + getSetting('learnSeconds') + 's autoMute ' + getSetting('autoMute'))
        lines.push('capture: ' + wbrbCapture.length + ' frames (' +
            Math.round(wbrbCapture.length * wbrbFrameMs / 1000) + 's)')
        ;['L', 'R'].forEach(function(tag) {
            const k = tag === 'L' ? 'sL' : 'sR'
            const dk = tag === 'L' ? 'dbL' : 'dbR'
            const scores = wbrbCapture.map(function(f) { return f[k] }).filter(function(v) { return v > -1 })
            const levels = wbrbCapture.map(function(f) { return f[dk] })
            if (!scores.length) { lines.push(tag + ': no scored frames yet'); return }
            lines.push(tag + ' score  p10 ' + pct(scores, 0.1).toFixed(2) +
                '  p50 ' + pct(scores, 0.5).toFixed(2) +
                '  p90 ' + pct(scores, 0.9).toFixed(2) +
                '  max ' + pct(scores, 0.999).toFixed(2) +
                '   |  level p50 ' + pct(levels, 0.5).toFixed(0) + 'dB')
            const above = function(th) { return (scores.filter(function(s) { return s >= th }).length / scores.length * 100).toFixed(0) + '%' }
            lines.push(tag + '   above continue ' + above(wbrbContinueThreshold) +
                ', above entry ' + above(wbrbEntryThreshold) +
                ', below clearlyLive ' + (scores.filter(function(s) { return s < wbrbClearlyLiveThreshold }).length / scores.length * 100).toFixed(0) + '%')
        })
        if (wbrbEvents.length) {
            const t0 = wbrbEvents[0].t
            lines.push('transitions (' + wbrbEvents.length + '):')
            wbrbEvents.slice(-24).forEach(function(e) {
                lines.push('  +' + ((e.t - t0) / 1000).toFixed(1) + 's  ' + e.side + '  ' + e.event + '  score ' + e.score)
            })
        } else {
            lines.push('transitions: none recorded')
        }
        const text = lines.join('\n')
        console.log(text)
        try { navigator.clipboard.writeText(text); showSeekToast('diagnosis copied to clipboard') }
        catch (e) { showSeekToast('diagnosis printed to console') }
        return text
    }

    // replay a capture through the same policy used live. overrides let a threshold be tested
    // without touching the running detector: bblfReplay(window.bblfLastCapture, {entry: 0.8})
    function wbrbReplay(data, overrides) {
        if (!data || !data.frames || !data.frames.length) { console.warn('replay: no frames'); return null }
        if (!wbrbProfile) { console.warn('replay: no learned profile to match against'); return null }
        const cfg = Object.assign(wbrbConfig(), overrides || {})
        const results = { transitions: [], frames: data.frames.length, cfg: cfg }
        const state = { left: wbrbNewSideState(), right: wbrbNewSideState() }
        const win = { left: [], right: [] }
        const t0 = data.frames[0].t
        data.frames.forEach(function(f) {
            ;[['left', 'bL', 'dbL'], ['right', 'bR', 'dbR']].forEach(function(spec) {
                const key = spec[0]
                win[key].push(f[spec[1]])
                if (win[key].length > wbrbWindowFrames) win[key].shift()
                if (win[key].length < wbrbWindowFrames) return
                const score = wbrbSequenceMatch(wbrbProfile.frames, win[key])
                const v = wbrbPolicyStep(state[key], score, f[spec[2]], f.t, cfg)
                if (v) {
                    const rec = { at: ((f.t - t0) / 1000).toFixed(1) + 's', side: key, event: v, score: Math.round(score * 1000) / 1000 }
                    results.transitions.push(rec)
                    console.log('replay ' + rec.at + '  ' + key + '  ' + v + '  score ' + rec.score)
                }
            })
        })
        console.log('replay: ' + results.transitions.length + ' transitions over ' + results.frames + ' frames')
        return results
    }

    // --- learn mode ---

    function wbrbLoadProfile() {
        try {
            const raw = localStorage.getItem(wbrbProfileKey)
            if (!raw) return null
            const p = JSON.parse(raw)
            if (!p) return null
            if (!Array.isArray(p.segments) && !Array.isArray(p.frames)) return null
            if (!wbrbProfileFrameCount(p)) return null
            // a profile recorded with an older fingerprint cannot be compared against the
            // current one - drop it rather than matching in the wrong vector space
            if (p.feature !== wbrbFeatureVersion) {
                warn('wbrb: discarding profile recorded with an older fingerprint - press k during a break to re-learn')
                try { localStorage.removeItem(wbrbProfileKey) } catch (e) {}
                return null
            }
            return p
        } catch (e) { return null }
    }

    function wbrbStartLearn() {
        if (wbrbLearning) { wbrbStopLearn(false); return }
        wbrbLearning = true
        wbrbLearnFrames = []
        // release any duck so we record the real signal, not our own silence
        wbrbSetDuck('left', false)
        wbrbSetDuck('right', false)
        wbrbSide.left = wbrbNewSideState()
        wbrbSide.right = wbrbNewSideState()
        log('wbrb: learning for ' + getSetting('learnSeconds') + 's - let the break music play')
        showSeekToast('learning break music… ' + getSetting('learnSeconds') + 's (adds to profile)')
    }

    function wbrbStopLearn(save) {
        wbrbLearning = false
        if (save && wbrbLearnFrames.length > 20) {
            const rounded = wbrbLearnFrames.map(function(f) { return f.map(function(v) { return Math.round(v * 1000) / 1000 }) })
            // append as a new segment: the bed is usually longer than one learn pass, so a few
            // passes across different breaks build coverage instead of replacing each other
            const segments = wbrbProfileSegments(wbrbProfile).slice()
            segments.push(rounded)
            var total = segments.reduce(function(n, s) { return n + s.length }, 0)
            while (total > wbrbMaxProfileFrames && segments.length > 1) {
                total -= segments.shift().length
            }
            const profile = { segments: segments, createdAt: Date.now(), frameMs: wbrbFrameMs, feature: wbrbFeatureVersion }
            try {
                localStorage.setItem(wbrbProfileKey, JSON.stringify(profile))
                wbrbProfile = profile
                const n = wbrbProfileFrameCount(profile)
                log('wbrb profile saved: ' + segments.length + ' segment(s), ' + n + ' frames')
                showSeekToast('profile: ' + segments.length + ' pass(es), ' +
                    Math.round(n * wbrbFrameMs / 1000) + 's of break music')
            } catch (e) {
                warn('wbrb profile save failed: ' + e)
                showSeekToast('profile save failed')
            }
        } else {
            showSeekToast('learn cancelled')
        }
        wbrbLearnFrames = []
        renderSettings()
    }

    function wbrbClearProfile() {
        try { localStorage.removeItem(wbrbProfileKey) } catch (e) {}
        wbrbProfile = null
        wbrbSetDuck('left', false)
        wbrbSetDuck('right', false)
        wbrbSide.left = wbrbNewSideState()
        wbrbSide.right = wbrbNewSideState()
        showSeekToast('break profile cleared')
        renderSettings()
    }

    function wbrbToggle() {
        const on = !getSetting('autoMute')
        setSetting('autoMute', on)
        showSeekToast('auto-mute ' + (on ? 'on' : 'off'))
        renderSettings()
    }

    // --- debug hud ---

    function wbrbUpdateHud() {
        const want = getSetting('detectorHud')
        var hud = document.getElementById('bblf-wbrb-hud')
        if (!want) {
            if (hud) hud.parentNode.removeChild(hud)
            return
        }
        if (!hud) {
            const skin = document.querySelector('.aa-player-skin')
            if (!skin) return
            hud = document.createElement('div')
            hud.id = 'bblf-wbrb-hud'
            hud.style.cssText = 'position:absolute;top:12px;left:12px;z-index:2147483646;' +
                'padding:7px 11px;border-radius:10px;background:rgba(28,28,30,0.72);' +
                'backdrop-filter:blur(30px) saturate(180%);-webkit-backdrop-filter:blur(30px) saturate(180%);' +
                'border:0.5px solid rgba(255,255,255,0.12);color:rgba(235,235,245,0.75);' +
                'font:500 11px ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;pointer-events:none;'
            skin.appendChild(hud)
        }
        if (wbrbLearning) {
            hud.style.color = '#ffd60a'
            hud.textContent = 'LEARNING  ' + wbrbLearnFrames.length + ' / ' +
                Math.round((getSetting('learnSeconds') * 1000) / wbrbFrameMs)
            return
        }
        const L = wbrbSide.left, R = wbrbSide.right
        const fmt = function(v) { return (v >= 0 ? ' ' : '') + v.toFixed(3) }
        const mark = function(st) { return st.active ? 'DUCK' : (st.confirmations ? '·' + st.confirmations + '  ' : '    ') }
        hud.style.color = (L.active || R.active) ? '#ff453a' : 'rgba(235,235,245,0.75)'
        hud.textContent =
            'L ' + fmt(L.score) + ' ' + L.levelDb.toFixed(0).padStart(4) + 'dB ' + mark(L) +
                ' lv' + L.levelGainDb.toFixed(1) + ' tr' + balanceTrimDb.left.toFixed(1) + '\n' +
            'R ' + fmt(R.score) + ' ' + R.levelDb.toFixed(0).padStart(4) + 'dB ' + mark(R) +
                ' lv' + R.levelGainDb.toFixed(1) + ' tr' + balanceTrimDb.right.toFixed(1) + '\n' +
            'base ' + (L.baseline < 0 ? '—' : L.baseline.toFixed(2)) + '/' +
                (R.baseline < 0 ? '—' : R.baseline.toFixed(2)) +
            '  corr ' + wbrbCorrelation.toFixed(3) + (wbrbCorrelation >= wbrbDuplicateCorrelation ? ' DUP' : '') +
            (wbrbProfile ? '' : '\nno profile — press k during a break')
    }

    function audioEngineInit() {
        if (wbrbTimer) return
        wbrbProfile = wbrbLoadProfile()
        wbrbTimer = setInterval(wbrbTick, wbrbFrameMs)
        // exposed for offline tuning from the console
        window.bblfReplay = wbrbReplay
        window.bblfDumpCapture = wbrbDumpCapture
        window.bblfDiagnose = wbrbDiagnose
        log('audio engine started' + (wbrbProfile
            ? ' (break profile: ' + wbrbProfile.frames.length + ' frames)'
            : ' - no break profile, press k during a break to learn one'))
    }

    // --- settings ---

    function getSetting(key) {
        return (key in settingsStore) ? settingsStore[key] : SETTINGS_DEFAULTS[key]
    }

    function setSetting(key, value) {
        settingsStore[key] = value
        try { localStorage.setItem('bblf_settings', JSON.stringify(settingsStore)) } catch (e) {}
        applySetting(key)
        log('setting ' + key + ' = ' + value)
    }

    function applySetting(key) {
        if (key === 'redditInterval') {
            if (redditTimer) {
                redditStop()
                redditStart()
            }
        } else if (key === 'theaterMode' || key === 'hideGuideOverlay') {
            const style = document.getElementById('bblf-styles')
            if (style) style.parentNode.removeChild(style)
            if (!getSetting('theaterMode')) {
                document.querySelectorAll('[data-bblf-hidden]').forEach(function(el) {
                    el.style.display = ''
                    delete el.dataset.bblfHidden
                })
            }
            ensureStyles()
        } else if (key === 'autoMute') {
            if (!getSetting('autoMute')) {
                // a disabled detector must not leave a duck holding
                wbrbSetDuck('left', false)
                wbrbSetDuck('right', false)
                wbrbSide.left = wbrbNewSideState()
                wbrbSide.right = wbrbNewSideState()
            }
        } else if (key === 'leveling' || key === 'balanceTrim') {
            if (key === 'balanceTrim' && !getSetting('balanceTrim')) balanceTrimDb = { left: 0, right: 0 }
            applyStageGains()
        } else if (key === 'detectorHud') {
            wbrbUpdateHud()
        } else if (key === 'showTransportBar' || key === 'showAudioControls' || key === 'enableFeedStatus') {
            // drop the bar; the watchdog rebuilds it (if enabled) within 3s
            const bar = document.getElementById('bblf-transport')
            if (bar) bar.parentNode.removeChild(bar)
            if (key === 'enableFeedStatus' && getSetting('enableFeedStatus')) refreshFeedStatus()
        }
    }

    function renderSettings() {
        const tab = document.getElementById('bblf-tab-settings')
        if (!tab) return
        tab.innerHTML = ''
        const mkRow = function(label, sub, control) {
            const row = document.createElement('div')
            row.className = 'bblf-set-row'
            const left = document.createElement('div')
            const l = document.createElement('div')
            l.className = 'bblf-set-label'
            l.textContent = label
            left.appendChild(l)
            if (sub) {
                const s = document.createElement('div')
                s.className = 'bblf-set-sub'
                s.textContent = sub
                left.appendChild(s)
            }
            row.appendChild(left)
            row.appendChild(control)
            tab.appendChild(row)
        }
        const mkSwitch = function(key) {
            const b = document.createElement('button')
            b.className = 'bblf-switch' + (getSetting(key) ? ' on' : '')
            const k = document.createElement('span')
            k.className = 'bblf-knob'
            b.appendChild(k)
            b.onclick = function() {
                setSetting(key, !getSetting(key))
                renderSettings()
            }
            return b
        }
        const mkChips = function(key, options, fmt) {
            const wrap = document.createElement('div')
            wrap.className = 'bblf-chips'
            options.forEach(function(v) {
                const c = document.createElement('button')
                c.className = 'bblf-chip-btn' + (getSetting(key) === v ? ' on' : '')
                c.textContent = fmt ? fmt(v) : String(v)
                c.onclick = function() {
                    setSetting(key, v)
                    renderSettings()
                }
                wrap.appendChild(c)
            })
            return wrap
        }
        mkRow('Reddit refresh', 'how often the Feed tab polls', mkChips('redditInterval', [15, 30, 45, 60], function(v) { return v + 's' }))
        mkRow('Stream quality', null, mkChips('preferredQuality', ['AUTO', '720p', '1080p']))
        mkRow('Theater mode', 'hide P+ chrome, lock scrolling', mkSwitch('theaterMode'))
        mkRow('Hide channel guide', 'the hover guide over the video', mkSwitch('hideGuideOverlay'))
        mkRow('Transport bar', null, mkSwitch('showTransportBar'))
        mkRow('Audio controls in bar', 'pan + gain boost', mkSwitch('showAudioControls'))
        mkRow('Feed status', 'FeedBot up/down in the bar', mkSwitch('enableFeedStatus'))
        mkRow('Auto-mute breaks', wbrbProfile
            ? 'profile: ' + wbrbProfileSegments(wbrbProfile).length + ' pass(es), ' +
              Math.round(wbrbProfileFrameCount(wbrbProfile) * wbrbFrameMs / 1000) + 's of music'
            : 'needs a profile — press k during a break', mkSwitch('autoMute'))
        mkRow('Learn length', 'each pass adds to the profile',
            mkChips('learnSeconds', [45, 90, 180], function(v) { return v >= 60 ? (v / 60) + 'm' : v + 's' }))
        const profileBtns = document.createElement('div')
        profileBtns.className = 'bblf-chips'
        const learnBtn = document.createElement('button')
        learnBtn.className = 'bblf-chip-btn'
        learnBtn.textContent = wbrbLearning ? 'Stop' : 'Learn'
        learnBtn.onclick = function() { wbrbStartLearn(); renderSettings() }
        profileBtns.appendChild(learnBtn)
        if (wbrbProfile) {
            const clearBtn = document.createElement('button')
            clearBtn.className = 'bblf-chip-btn'
            clearBtn.textContent = 'Clear'
            clearBtn.onclick = function() { wbrbClearProfile() }
            profileBtns.appendChild(clearBtn)
        }
        mkRow('Break music profile', wbrbProfile
            ? 'learn again during another break to cover more of the bed'
            : 'press Learn during a break', profileBtns)
        mkRow('Speech leveling', 'bring whispers up, gate silence', mkSwitch('leveling'))
        mkRow('Balance auto-trim', 'even out lopsided channels', mkSwitch('balanceTrim'))
        mkRow('Detector HUD', 'match scores over the video', mkSwitch('detectorHud'))
        const foot = document.createElement('div')
        foot.style.cssText = 'padding:14px 16px;font-size:11px;color:rgba(235,235,245,0.45);display:flex;align-items:center;gap:10px;'
        const note = document.createElement('span')
        note.textContent = 'Settings persist across script updates.'
        const reset = document.createElement('button')
        reset.className = 'bblf-chip-btn'
        reset.textContent = 'Reset'
        reset.onclick = function() {
            settingsStore = {}
            try { localStorage.removeItem('bblf_settings') } catch (e) {}
            Object.keys(SETTINGS_DEFAULTS).forEach(applySetting)
            renderSettings()
        }
        foot.appendChild(note)
        foot.appendChild(reset)
        tab.appendChild(foot)
    }

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

    function playerToggleMute() {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        video.muted = !video.muted
        showSeekToast(video.muted ? 'muted' : 'unmuted')
        updateTransportBar()
    }

    function playerPip() {
        if (!enablePlayerControls) return
        const video = getVideoEl()
        if (!video) return
        try {
            if (document.pictureInPictureElement) {
                document.exitPictureInPicture()
                return
            }
            // P+ sets disablepictureinpicture on the video; Chrome honors it and rejects the request
            if (video.hasAttribute('disablepictureinpicture')) video.removeAttribute('disablepictureinpicture')
            video.disablePictureInPicture = false
            if (document.pictureInPictureEnabled === false) {
                showSeekToast('PiP blocked by browser settings')
                return
            }
            video.requestPictureInPicture().catch(function(e) {
                warn('pip failed: ' + e)
                showSeekToast('PiP failed: ' + ((e && e.name) ? e.name : e))
            })
        } catch (e) {
            warn('pip failed: ' + e)
            showSeekToast('PiP failed: ' + ((e && e.name) ? e.name : e))
        }
    }

    function formatSecs(s) {
        s = Math.max(0, Math.round(s))
        const m = Math.floor(s / 60)
        return m > 0 ? m + ':' + String(s % 60).padStart(2, '0') : s + 's'
    }

    // P+'s LIVE badge has no stable class we know; find it by its text and hide it.
    // logs the class it finds so a proper CSS rule can be added later
    function hidePlusLiveBadge() {
        const skin = document.querySelector('.aa-player-skin')
        if (!skin) return
        const all = skin.querySelectorAll('div, span, button, p')
        for (var i = 0; i < all.length; i++) {
            const el = all[i]
            if (el.childElementCount > 0) continue
            if (el.dataset.bblfHidden) continue
            if (el.closest('[id^="bblf-"]')) continue
            if (el.textContent.trim() !== 'LIVE') continue
            var target = el
            while (target.parentElement && target.parentElement !== skin &&
                   target.parentElement.textContent.trim() === 'LIVE' &&
                   !target.parentElement.querySelector('video')) {
                target = target.parentElement
            }
            target.dataset.bblfHidden = '1'
            target.style.setProperty('display', 'none', 'important')
            log('hid P+ live badge: ' + (target.className || target.tagName))
        }
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
        if (!bar && getSetting('showTransportBar')) {
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
            if (getSetting('enableFeedStatus')) {
                const feeds = document.createElement('div')
                feeds.id = 'bblf-feeds'
                feeds.title = 'BB feed status via FeedBot'
                feeds.style.cssText = 'display:flex;align-items:center;gap:6px;padding:0 4px;' +
                    'font:600 11px -apple-system,BlinkMacSystemFont,sans-serif;color:rgba(235,235,245,0.7);letter-spacing:0.3px;'
                const fdot = document.createElement('span')
                fdot.className = 'bblf-live-dot'
                fdot.id = 'bblf-feeds-dot'
                fdot.style.background = '#8e8e93'
                fdot.style.boxShadow = 'none'
                const flabel = document.createElement('span')
                flabel.id = 'bblf-feeds-label'
                flabel.textContent = '…'
                feeds.appendChild(fdot)
                feeds.appendChild(flabel)
                bar.appendChild(feeds)
                const sep0 = document.createElement('div')
                sep0.className = 'bblf-tsep'
                bar.appendChild(sep0)
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
            if (getSetting('showAudioControls')) {
                ;[{ pan: 'left', label: 'L' }, { pan: 'none', label: 'C' }, { pan: 'right', label: 'R' }].forEach(function(p) {
                    const b = mk(p.label, p.pan === 'left' ? 'audio left  (q)' : (p.pan === 'none' ? 'audio center  (w)' : 'audio right  (e)'),
                        function() { adjustChannel(p.pan) })
                    b.dataset.pan = p.pan
                    b.style.font = '600 12px -apple-system,BlinkMacSystemFont,sans-serif'
                    bar.appendChild(b)
                })
                const fader = document.createElement('input')
                fader.id = 'bblf-fader'
                fader.type = 'range'
                fader.min = -1
                fader.max = 1
                fader.step = 0.05
                fader.value = faderPosition
                fader.title = 'feed fader: left cam ←→ right cam  (q / w / e)'
                fader.style.cssText = 'width:64px;margin:0 4px;'
                fader.oninput = function() { setFaderPosition(parseFloat(this.value)) }
                bar.appendChild(fader)
                const slider = document.createElement('input')
                slider.id = 'bblf-gain-slider'
                slider.type = 'range'
                slider.min = 1
                slider.max = maxGainBoost
                slider.step = 0.05
                slider.value = gainBoost
                slider.title = 'gain boost  ( [ / ] )'
                slider.style.cssText = 'width:70px;margin:0 4px;'
                slider.oninput = function() { setGainBoost(parseFloat(this.value)) }
                bar.appendChild(slider)
                const gainLabel = document.createElement('span')
                gainLabel.id = 'bblf-gain-label'
                gainLabel.textContent = gainBoost.toFixed(2) + 'x'
                gainLabel.style.cssText = 'font:600 11px -apple-system,BlinkMacSystemFont,sans-serif;color:rgba(235,235,245,0.6);min-width:34px;'
                bar.appendChild(gainLabel)
                const sep2 = document.createElement('div')
                sep2.className = 'bblf-tsep'
                bar.appendChild(sep2)
            }
            bar.appendChild(mk('⧉', 'picture in picture  (p)', function() { playerPip() }))
            bar.appendChild(mk('☰', 'panel  (r)', function() { togglePanel() }))
            bar.appendChild(mk('⤢', 'fullscreen  (f)', function() { toggleFullscreen() }))
            bar.appendChild(mk('🔊', 'mute  (m)', function() { playerToggleMute() }, 'bblf-t-mute'))
            skin.appendChild(bar)
            updatePanUI()
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
        const muteBtn = document.getElementById('bblf-t-mute')
        if (muteBtn) muteBtn.textContent = video.muted ? '🔇' : '🔊'
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

    // --- feed status (FeedBot: feedbot.liquid8d.dev / @feed-bot.bsky.social) ---

    async function refreshFeedStatus() {
        if (!getSetting('enableFeedStatus')) return
        try {
            const d = await gmFetchJson('https://feedbot.liquid8d.dev/assets/' + feedbotSeason + '/latest.json')
            var events = []
            try {
                const h = await gmFetchJson('https://feedbot.liquid8d.dev/api/images?season=' + feedbotSeason + '&state_changes=true&limit=4')
                events = h.events || []
            } catch (e) { /* history is optional */ }
            renderFeedStatus(d, events)
        } catch (e) {
            const label = document.getElementById('bblf-feeds-label')
            if (label) label.textContent = '—'
        }
    }

    function renderFeedStatus(d, events) {
        const dot = document.getElementById('bblf-feeds-dot')
        const label = document.getElementById('bblf-feeds-label')
        const wrap = document.getElementById('bblf-feeds')
        if (!dot || !label || !wrap) return
        const colors = { up: '#30d158', fish: '#ff9f0a', pets: '#ff9f0a', down: '#ff453a' }
        const color = colors[d.status] || '#8e8e93'
        dot.style.background = color
        dot.style.boxShadow = (d.status === 'up') ? '0 0 8px ' + color : 'none'
        const dur = formatDuration(Math.max(0, Math.floor(Date.now() / 1000) - d.since))
        label.textContent = (d.status === 'up' ? 'up' : d.status) + ' · ' + dur
        var tip = 'BB feeds ' + (d.status === 'up' ? 'live' : d.status) + ' for ' + dur + '  (via FeedBot)'
        if (events && events.length) {
            tip += '\nrecent: ' + events.map(function(ev) {
                return ev.state + ' ' + formatDuration(Math.max(0, Math.floor(Date.now() / 1000) - parseInt(ev.ts))) + ' ago'
            }).join(' · ')
        }
        if (d.status !== 'up') {
            tip += '\ntypical outages: Mon veto ~11am · Thu lockdown 11am/2pm · Fri noms ~3pm · Sat veto comp ~12pm'
        }
        wrap.title = tip
    }

    function formatDuration(s) {
        if (s < 60) return s + 's'
        const m = Math.floor(s / 60)
        if (m < 60) return m + 'm'
        return Math.floor(m / 60) + 'h ' + (m % 60) + 'm'
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
        ;['feed', 'house', 'settings'].forEach(function(t) {
            const b = document.createElement('button')
            b.className = 'bblf-seg-btn'
            b.dataset.tab = t
            b.textContent = (t === 'feed') ? 'Feed' : (t === 'house' ? 'House' : 'Settings')
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

        const settingsTab = document.createElement('div')
        settingsTab.id = 'bblf-tab-settings'
        settingsTab.style.cssText = 'flex:1;min-height:0;display:none;overflow-y:auto;overscroll-behavior:contain;'

        panel.appendChild(segWrap)
        panel.appendChild(feedWrap)
        panel.appendChild(house)
        panel.appendChild(settingsTab)
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
        redditTimer = setInterval(function() { redditRefresh(false) }, getSetting('redditInterval') * 1000)
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
        if (Date.now() < redditCooldownUntil && !force) return
        try {
            setPanelStatus('Updating…')
            if (force || !redditThread || (Date.now() - redditLastDiscover) > redditThreadInterval) {
                await redditDiscover()
                redditLastDiscover = Date.now()
            }
            await redditFetchComments()
            setPanelStatus('Updated ' + new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) + ' · r/' + redditSub)
        } catch (e) {
            const msg = (e && e.message) ? e.message : String(e)
            if (msg.indexOf('429') !== -1) {
                redditCooldownUntil = Date.now() + 120 * 1000
                setPanelStatus('rate limited - pausing for 2 min', true)
            } else {
                setPanelStatus(msg, true)
            }
        }
    }

    async function redditDiscover() {
        const d = await gmFetchJson('https://www.reddit.com/r/' + redditSub + '/new.json?limit=25')
        const posts = d.data.children.map(function(c) { return c.data })
            .filter(function(p) { return p.link_flair_text === redditFlair })
        if (!posts.length) throw new Error('no "' + redditFlair + '" thread found in r/' + redditSub)
        posts.sort(function(a, b) { return b.created_utc - a.created_utc })
        const titled = posts.filter(function(p) {
            return p.title.toLowerCase().indexOf(redditTitleFilter.toLowerCase()) !== -1
        })
        const t = (titled.length ? titled : posts)[0]
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
        const settings = document.getElementById('bblf-tab-settings')
        if (feed) feed.style.display = (t === 'feed') ? 'flex' : 'none'
        if (house) house.style.display = (t === 'house') ? 'flex' : 'none'
        if (settings) settings.style.display = (t === 'settings') ? 'block' : 'none'
        const thumb = document.getElementById('bblf-seg-thumb')
        if (thumb) thumb.style.transform = (t === 'feed') ? 'translateX(0%)' : (t === 'house' ? 'translateX(100%)' : 'translateX(200%)')
        if (t === 'house') renderHouse()
        if (t === 'settings') renderSettings()
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
                    var name = s.replace(/~~/g, '').replace(/\s*\(.*\)\s*$/, '').trim()
                    name = NAME_ALIASES[name.toLowerCase()] || name
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

        // typical outage schedule, today highlighted
        const schedHead = document.createElement('div')
        schedHead.style.cssText = 'font-weight:700;font-size:13px;color:#fff;margin-top:20px;'
        schedHead.textContent = 'Typical Outages'
        scroll.appendChild(schedHead)
        const schedSub = document.createElement('div')
        schedSub.style.cssText = 'font-size:11px;color:rgba(235,235,245,0.45);margin-bottom:6px;'
        schedSub.textContent = 'estimated · via FeedBot'
        scroll.appendChild(schedSub)
        const today = new Date().getDay()
        OUTAGE_SCHEDULE.forEach(function(o) {
            const isToday = o.day === today
            const row = document.createElement('div')
            row.style.cssText = 'display:flex;gap:8px;padding:6px 0;font-size:12px;line-height:1.4;' +
                'border-bottom:0.5px solid rgba(255,255,255,0.06);' +
                (isToday ? 'color:#fff;' : 'color:rgba(235,235,245,0.6);')
            const dayEl = document.createElement('span')
            dayEl.style.cssText = 'min-width:32px;font-weight:600;flex-shrink:0;' + (isToday ? 'color:#30d158;' : '')
            dayEl.textContent = o.name.slice(0, 3)
            const txt = document.createElement('span')
            txt.textContent = o.events
            row.appendChild(dayEl)
            row.appendChild(txt)
            if (isToday) {
                const chip = document.createElement('span')
                chip.style.cssText = 'margin-left:auto;align-self:flex-start;background:rgba(48,209,88,0.18);color:#30d158;' +
                    'font-size:9.5px;font-weight:700;padding:1.5px 7px;border-radius:6px;letter-spacing:0.4px;flex-shrink:0;'
                chip.textContent = 'TODAY'
                row.appendChild(chip)
            }
            scroll.appendChild(row)
        })

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
        const bar = document.getElementById('bblf-transport')
        if (!bar) return
        const fader = document.getElementById('bblf-fader')
        if (fader && parseFloat(fader.value) !== faderPosition) fader.value = faderPosition
        bar.querySelectorAll('button[data-pan]').forEach(function(btn) {
            const active = btn.dataset.pan === currentPan
            btn.style.color = active ? '#30d158' : ''
            btn.style.background = active ? 'rgba(48,209,88,0.15)' : ''
        })
    }

    function log(msg) { console.log('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function warn(msg) { console.warn('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function error(msg) { console.error('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function info(msg) { console.info('BBLF Enhancer: (' + attempts + ') ' + msg) }
    // start only after every declaration above has initialised - startup() used to run
    // from the middle of this IIFE, which would hit the temporal dead zone the first time it
    // touched anything declared below it
    startup()
})();
