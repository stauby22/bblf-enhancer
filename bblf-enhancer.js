// ==UserScript==
// @name         BBLF Enhancer
// @namespace    http://tampermonkey.net/
// @version      1.5.2
// @description  Monitor for issues on Big Brother Live Feed streams, reloading or starting video when necessary. Can autoload quad cam, add hotkeys, show video scrubber, and remap fullscreen button to only show video.
// @author       liquid8d
// @match        https://www.paramountplus.com/live-tv/stream/big_brother/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=paramountplus.com
// @grant        GM_log

// ==/UserScript==
/*
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
        { key: ']', action: function() { setGainBoost(gainBoost + 0.25) } }
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

    if (localStorage.getItem('bblf_video_monitor_attempts')) attempts = (resetScript) ? 0 : parseInt(localStorage.getItem('bblf_video_monitor_attempts'))

    startup()

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
                    if (e.key === hotkey || e.code === hotkey) hotkeys[i].action()
                }
            }
            log('hotkeys enabled')
        }

        // start watching video
        setInterval(() => {
            checkVideo();
        }, monitorInterval);
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
		if (preferredQuality == 'AUTO') {
			if (!player.autoQualitySwitching) {
				player.autoQualitySwitching = true
				playback.refreshQualities()
			}
		} else if (player.qualityCategory != preferredQuality) {
			log('setting quality category to ' + preferredQuality)
			player.autoQualitySwitching = false
			player.qualityCategory = preferredQuality
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
                        if (forcePlay) {
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
						if (showAudioControls) ensureAudioBar()
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

    function hookUpWebAudio(node) {
        let audioNode = {};
        audioNode.source = audioCtx.createMediaElementSource(node);
		audioNode.merger = audioCtx.createChannelMerger(2);
        audioNode.splitter = audioCtx.createChannelSplitter(2);
        audioNode.source.connect(audioNode.splitter, 0, 0);
        audioNode.gainLeft = audioCtx.createGain();
        audioNode.gainRight = audioCtx.createGain();
		audioNode.source.connect(audioNode.splitter, 0, 0);
		audioNode.boost = audioCtx.createGain();
		audioNode.boost.gain.value = gainBoost;
		audioNode.merger.connect(audioNode.boost, 0, 0);
		audioNode.boost.connect(audioCtx.destination);
		audioNode.gainLeft.gain.value = 1;
		audioNode.gainRight.gain.value = 1;
        //audioNode.splitter.connect(audioNode.gainLeft, 0);
        //audioNode.splitter.connect(audioNode.gainRight, 1);
        //audioNode.gainLeft.connect(audioCtx.destination, 0);
        //audioNode.gainRight.connect(audioCtx.destination, 0);
        audioNodes.push(audioNode);
    }

    function adjustChannel(dir) {
        currentPan = dir
        updatePanUI()
        audioNodes.forEach((audioNode) => {
            if (dir === 'none') {
				audioNode.gainLeft.disconnect();
				audioNode.gainRight.disconnect();
				audioNode.splitter.disconnect();
				audioNode.gainLeft.connect(audioNode.merger, 0, 0);
				audioNode.gainRight.connect(audioNode.merger, 0, 1);
				audioNode.splitter.connect(audioNode.gainLeft, 0);
				audioNode.splitter.connect(audioNode.gainRight, 1);
				audioNode.gainLeft.gain.value = 1;
				audioNode.gainRight.gain.value = 1;
				log('audio balance reset');
            } else if (dir === 'left') {
				audioNode.gainLeft.disconnect();
				audioNode.gainRight.disconnect();
				audioNode.splitter.disconnect();
				audioNode.gainLeft.connect(audioNode.merger, 0, 0);
				audioNode.gainRight.connect(audioNode.merger, 0, 1);
				audioNode.splitter.connect(audioNode.gainLeft, 0);
				audioNode.splitter.connect(audioNode.gainRight, 0);
				audioNode.gainLeft.gain.value = 1;
				audioNode.gainRight.gain.value = 1;
                log('audio balance left');
            } else {
				audioNode.gainLeft.disconnect();
				audioNode.gainRight.disconnect();
				audioNode.splitter.disconnect();
				audioNode.gainLeft.connect(audioNode.merger, 0, 0);
				audioNode.gainRight.connect(audioNode.merger, 0, 1);
				audioNode.splitter.connect(audioNode.gainLeft, 1);
				audioNode.splitter.connect(audioNode.gainRight, 1);
				audioNode.gainLeft.gain.value = 1;
				audioNode.gainRight.gain.value = 1;
                log('audio balance right');
            }
        });
    }

    function ensureStyles() {
        if (document.getElementById('bblf-styles')) return
        var css = ''
        // .live-schedule is the current (BB28) hover channel guide; .skin-sidebar-plugin was the older one from the Stylebot CSS
        if (hideGuideOverlay) css += 'div.live-schedule, div.skin-sidebar-plugin { display: none !important; }\n'
        if (theaterMode) css += [
            '.header__nav', '#user-profiles-menu-trigger', '#kids-access-button', 'footer',
            '.video__metadata', 'div.top-menu-hint', '.top-menu-backplane', '.controls-backplane'
        ].join(', ') + ' { display: none !important; }\n'
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

    function ensureAudioBar() {
        if (document.getElementById('bblf-audio-bar')) return
        // anchor inside the player skin so the bar sits over the video (and shows in fullscreen), not the page header
        const skin = document.querySelector('.aa-player-skin')
        if (!skin) return
        if (getComputedStyle(skin).position === 'static') skin.style.position = 'relative'
        const bar = document.createElement('div')
        bar.id = 'bblf-audio-bar'
        bar.style.cssText = 'position:absolute;top:10px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
            'display:flex;gap:6px;align-items:center;background:rgba(20,20,20,0.75);padding:4px 10px;' +
            'border-radius:6px;font:12px/1.4 sans-serif;color:#eee;'
        const pans = [ { pan: 'left', label: 'L' }, { pan: 'none', label: 'Center' }, { pan: 'right', label: 'R' } ]
        pans.forEach((p) => {
            const btn = document.createElement('button')
            btn.textContent = p.label
            btn.dataset.pan = p.pan
            btn.style.cssText = 'background:transparent;border:1px solid #666;border-radius:4px;color:#eee;padding:2px 8px;cursor:pointer;font:inherit;'
            btn.onclick = function() { adjustChannel(p.pan) }
            bar.appendChild(btn)
        })
        const boostLabel = document.createElement('span')
        boostLabel.textContent = 'Boost'
        boostLabel.style.marginLeft = '8px'
        bar.appendChild(boostLabel)
        const slider = document.createElement('input')
        slider.id = 'bblf-gain-slider'
        slider.type = 'range'
        slider.min = 1
        slider.max = maxGainBoost
        slider.step = 0.05
        slider.value = gainBoost
        slider.style.width = '80px'
        slider.oninput = function() { setGainBoost(parseFloat(this.value)) }
        bar.appendChild(slider)
        const gainLabel = document.createElement('span')
        gainLabel.id = 'bblf-gain-label'
        gainLabel.textContent = gainBoost.toFixed(2) + 'x'
        bar.appendChild(gainLabel)
        skin.appendChild(bar)
        updatePanUI()
        log('audio bar added')
    }

    function updatePanUI() {
        const bar = document.getElementById('bblf-audio-bar')
        if (!bar) return
        bar.querySelectorAll('button[data-pan]').forEach((btn) => {
            const active = btn.dataset.pan === currentPan
            btn.style.background = active ? '#1fce6d' : 'transparent'
            btn.style.color = active ? '#111' : '#eee'
            btn.style.borderColor = active ? '#1fce6d' : '#666'
        })
    }

    function log(msg) { console.log('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function warn(msg) { console.warn('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function error(msg) { console.error('BBLF Enhancer: (' + attempts + ') ' + msg) }
    function info(msg) { console.info('BBLF Enhancer: (' + attempts + ') ' + msg) }
})();