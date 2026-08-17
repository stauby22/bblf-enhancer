// Offline tests for the audio engine's pure functions (DSP, detection policy, gain math).
// These need no browser: they extract the functions from bblf-enhancer.js and exercise them
// directly, so a threshold change can be checked in a second instead of waiting for a live
// break. Run:  node tests/audio-engine.test.js bblf-enhancer.js
//
// The fade-valley cases are regression coverage for a real bug: a stuck valley used to hold
// the mute for valleyMaxMs + graceMs (10.5s) instead of capping at valleyMaxMs (7s).

const src = require('fs').readFileSync(process.argv[2], 'utf8');
const consts = `var wbrbBandCount=32, wbrbMinHz=80, wbrbMaxHz=8000,
 wbrbAnalysisFrames=20, musicMaxLevelSd=6, musicMaxPauseRatio=0.15,
 musicMaxStereoAgreement=0.45, musicEnterFrames=8, musicSustainSdMultiplier=1.8,
 liveMinStereoAgreement=0.55, liveMinLevelSd=8, liveMinPauseRatio=0.20,
 liveReleaseMs=2000, quietReleaseMs=12000, wbrbMaxHoldWithoutStrongMs=60000,
 levelTargetDb=-24, levelMaxBoostDb=12,
 levelMaxCutDb=6, levelGateDb=-52, levelWhisperFloorDb=-58, autoGainMaxDb=12;`;
const grab = (n) => {
  const re = new RegExp('function ' + n + '\\([\\s\\S]*?\\n    \\}');
  const m = src.match(re);
  if (!m) throw new Error('could not extract ' + n);
  return m[0];
};
eval(consts + [
  'wbrbNormalize', 'wbrbDetrendNormalize', 'wbrbCosine', 'wbrbSequenceMatch', 'wbrbSpectrumToBands',
  'wbrbNewSideState', 'wbrbEvidence', 'wbrbPolicyStep', 'wbrbConfig', 'levelingGainDb', 'dbToGain', 'faderGains'
].map(grab).join('\n'));

let pass = 0, fail = 0;
const t = (name, cond, extra) => {
  cond ? pass++ : fail++;
  console.log((cond ? '  ok  ' : '  FAIL') + '  ' + name + (extra ? '  ' + extra : ''));
};

console.log('\n— normalization (volume invariance) —');
const quiet = [1, 2, 3, 4, 5, 4, 3, 2].concat(Array(24).fill(2));
const loud = quiet.map(v => v + 25);
const nq = wbrbNormalize(quiet), nl = wbrbNormalize(loud);
t('unit magnitude', Math.abs(Math.hypot.apply(null, nq) - 1) < 1e-9);
t('mean centred', Math.abs(nq.reduce((a, b) => a + b, 0)) < 1e-9);
t('loud vs quiet identical shape scores 1.0', Math.abs(wbrbCosine(nq, nl) - 1) < 1e-9,
  '(cos=' + wbrbCosine(nq, nl).toFixed(6) + ')');
t('silence yields zero vector, not NaN', wbrbNormalize(Array(32).fill(-120)).every(v => v === 0));

console.log('\n— circular sequence match —');
const loop = Array.from({ length: 8 }, (_, i) =>
  wbrbNormalize(Array.from({ length: 32 }, (_, b) => Math.sin(b / 3 + i))));
const joined = [loop[5], loop[6], loop[7], loop[0], loop[1]];
t('matches when joined partway through', wbrbSequenceMatch(loop, joined) > 0.999,
  '(score=' + wbrbSequenceMatch(loop, joined).toFixed(4) + ')');
const noise = Array.from({ length: 5 }, () =>
  wbrbNormalize(Array.from({ length: 32 }, () => Math.random())));
t('unrelated audio scores low', wbrbSequenceMatch(loop, noise) < 0.6,
  '(score=' + wbrbSequenceMatch(loop, noise).toFixed(4) + ')');

console.log('\n— band mapping —');
const sr = 48000, fft = 2048;
const spec = new Float32Array(fft / 2).fill(-100);
spec[Math.round(1000 * fft / sr)] = -20;
const bands = wbrbSpectrumToBands(spec, sr, fft);
const peak = bands.indexOf(Math.max.apply(null, bands));
const edges = Array.from({ length: 33 }, (_, b) => 80 * Math.pow(Math.min(8000, sr / 2) / 80, b / 32));
t('1kHz spike lands in the band containing 1kHz', edges[peak] <= 1000 && edges[peak + 1] >= 1000,
  '(band ' + peak + ' = ' + edges[peak].toFixed(0) + '-' + edges[peak + 1].toFixed(0) + 'Hz)');

const cfg = wbrbConfig();
// helpers to build a rolling level window with a given character
const steady = (n, db) => Array.from({ length: n }, () => db + (Math.random() - 0.5) * 1.5);
const talky = (n, db) => Array.from({ length: n }, (_, i) => (i % 5 === 0 ? db - 22 : db + (Math.random() - 0.5) * 14));

console.log('\n— evidence: what music looks like vs what people look like —');
const musicEv = wbrbEvidence(steady(20, -33), 0.16, cfg);
const liveEv = wbrbEvidence(talky(20, -30), 0.78, cfg);
t('steady + wide stereo reads as the break bed', musicEv.music && !musicEv.live,
  '(sd ' + musicEv.sd.toFixed(1) + ' pause ' + musicEv.pause.toFixed(2) + ')');
t('variable + agreeing channels reads as people', liveEv.live && !liveEv.music,
  '(sd ' + liveEv.sd.toFixed(1) + ' pause ' + liveEv.pause.toFixed(2) + ')');
t('steady audio on AGREEING channels is not the bed',
  !wbrbEvidence(steady(20, -33), 0.80, cfg).music, '(one cam, quiet room)');
t('too few frames yields no verdict', !wbrbEvidence(steady(5, -33), 0.16, cfg).valid);

console.log('\n— policy: entry —');
let st = wbrbNewSideState(), now = 0;
for (let i = 0; i < musicEnterFrames - 1; i++) {
  wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
}
t('short bursts of bed-like audio do not mute', !st.active);
t('sustained evidence mutes', wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg) === 'enter');
st = wbrbNewSideState(); now = 0;
let talked = false;
for (let i = 0; i < 200; i++) {
  if (wbrbPolicyStep(st, wbrbEvidence(talky(20, -30), 0.78, cfg), now += 250, cfg) === 'enter') talked = true;
}
t('conversation never mutes, however long it runs', !talked && !st.active);

console.log('\n— policy: release —');
// people coming back releases fast
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
const backAt = now;
let rel = null;
for (let i = 0; i < 60 && rel === null; i++) {
  if (wbrbPolicyStep(st, wbrbEvidence(talky(20, -30), 0.78, cfg), now += 250, cfg) === 'release') rel = now - backAt;
}
t('people returning unmutes within ~2s', rel !== null && rel <= 2500, '(' + (rel / 1000).toFixed(1) + 's)');

// a loop seam - briefly not bed-like, but nobody is talking - must NOT unmute
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
let seamRel = null;
for (let i = 0; i < 24; i++) {   // 6s of ambiguous, wide-stereo audio
  if (wbrbPolicyStep(st, wbrbEvidence(talky(20, -33), 0.20, cfg), now += 250, cfg) === 'release') seamRel = i;
}
t('a loop seam does not unmute mid-break', st.active && seamRel === null);
for (let i = 0; i < 8; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
t('still muted when the bed resumes', st.active);

// sustain hysteresis: a livelier bed keeps the mute that a strict test would drop
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
// sd ~6.4: past the strict entry test, inside the sustain tolerance, and with no pauses
const wobblyLevels = Array.from({ length: 20 }, (_, i) => (i % 5 === 4 ? -17 : -33));
const wobbly = wbrbEvidence(wobblyLevels, 0.16, cfg);
t('a wobblier bed still sustains the mute', wobbly.musicSustain && !wobbly.music,
  '(sd ' + wobbly.sd.toFixed(1) + ', strict test says ' + wobbly.music + ')');

// nothing at all: bed stops, no people - releases on the slow path
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
const quietFrom = now;
let quietRel = null;
// gappy audio that is plainly not a bed, but nobody is clearly talking either
const gappy = Array.from({ length: 20 }, (_, i) => (i % 5 < 2 ? -60 : -30));
for (let i = 0; i < 200 && quietRel === null; i++) {
  if (wbrbPolicyStep(st, wbrbEvidence(gappy, 0.20, cfg), now += 250, cfg) === 'release') quietRel = now - quietFrom;
}
t('bed stopping with nobody talking unmutes on the slow path',
  quietRel !== null && quietRel <= quietReleaseMs + 1500, '(' + (quietRel / 1000).toFixed(1) + 's)');

// audio that stays bed-like forever is bounded by the backstop, not left holding
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
const backstopFrom = now;
let backstopRel = null;
for (let i = 0; i < 600 && backstopRel === null; i++) {
  // sustain-but-not-entry audio: would hold indefinitely without the backstop
  if (wbrbPolicyStep(st, wbrbEvidence(wobblyLevels, 0.16, cfg), now += 250, cfg) === 'release') backstopRel = now - backstopFrom;
}
t('the backstop bounds even sustain-qualifying audio',
  backstopRel !== null && backstopRel <= wbrbMaxHoldWithoutStrongMs + 1000,
  '(' + (backstopRel / 1000).toFixed(0) + 's)');

console.log('\n— policy: silence and clock gaps decide nothing —');
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < musicEnterFrames; i++) wbrbPolicyStep(st, wbrbEvidence(steady(20, -33), 0.16, cfg), now += 250, cfg);
for (let i = 0; i < 100; i++) wbrbPolicyStep(st, { valid: false }, now += 250, cfg);
t('an invalid window never flips the state', st.active);

console.log('\n— leveling gate —');
t('true silence gets no boost', levelingGainDb(-70) === 0);
t('whisper (-50dB) gets boost', levelingGainDb(-50) > 0, '(+' + levelingGainDb(-50).toFixed(1) + 'dB)');
t('boost fades in across the floor', levelingGainDb(-56) < levelingGainDb(-50));
t('normal speech pulled toward target', Math.abs(levelingGainDb(-30) - 6) < 0.01,
  '(+' + levelingGainDb(-30).toFixed(1) + 'dB)');
t('loud audio cut, bounded', levelingGainDb(-5) === -levelMaxCutDb);
t('boost never exceeds hard cap',
  [-60, -55, -50, -40, -30, -20, -10, 0].every(d => Math.abs(levelingGainDb(d)) <= autoGainMaxDb));
t('dbToGain clamps beyond cap', Math.abs(dbToGain(99) - Math.pow(10, autoGainMaxDb / 20)) < 1e-9);

console.log('\n— fader matrix —');
const c = faderGains(0), l = faderGains(-1), r = faderGains(1), m = faderGains(-0.7);
t('centre = clean stereo', c.ll === 1 && c.rr === 1 && c.lr === 0 && c.rl === 0);
t('full left = left source in both ears', l.ll === 1 && l.lr === 1 && l.rl === 0 && l.rr === 0);
t('full right = right source in both ears', r.rr === 1 && r.rl === 1 && r.ll === 0 && r.lr === 0);
t('70% toward left blends both', Math.abs(m.lr - 0.7) < 1e-9 && Math.abs(m.rr - 0.3) < 1e-9);

console.log('\n— REAL CAPTURE regression (BB28, 2026-08-17) —');
// The detector is replayed against a genuine recording: live house conversation, then a long
// break. This is the test that actually matters - muting conversation is the failure that
// made this rewrite necessary.
try {
  const fx = JSON.parse(require('fs').readFileSync(__dirname + '/fixtures/capture-bb28-break.json', 'utf8'));
  const state = { left: wbrbNewSideState(), right: wbrbNewSideState() };
  let lrWin = [], lastTick = 0;
  let mutedLive = 0, liveN = 0, mutedMusic = 0, musicN = 0, flips = 0;
  fx.frames.forEach((f) => {
    const now = f.t, secs = (f.t - fx.t0) / 1000;
    lrWin.push(f.lr);
    while (lrWin.length > wbrbAnalysisFrames) lrWin.shift();
    const lr = lrWin.reduce((a, b) => a + b, 0) / lrWin.length;
    const gap = lastTick && (now - lastTick) > fx.frameMs * 3;
    lastTick = now;
    [['left', 'dbL'], ['right', 'dbR']].forEach(([key, dk]) => {
      const s2 = state[key];
      if (gap || f[dk] < -100) { if (gap) { s2.levels = []; lrWin = []; } return; }
      s2.levels.push(f[dk]);
      while (s2.levels.length > wbrbAnalysisFrames) s2.levels.shift();
      if (wbrbPolicyStep(s2, wbrbEvidence(s2.levels, lr, cfg), now, cfg)) flips++;
    });
    if (f.dbL < -100) return;
    if (secs < fx.labels.liveBefore) { liveN++; if (state.left.active) mutedLive++; }
    else if (secs > fx.labels.musicAfter) { musicN++; if (state.left.active) mutedMusic++; }
  });
  const livePct = mutedLive / liveN * 100, musicPct = mutedMusic / musicN * 100;
  t('live house conversation is never muted', livePct <= 1, '(' + livePct.toFixed(1) + '% muted)');
  t('the break bed is muted almost throughout', musicPct >= 85, '(' + musicPct.toFixed(1) + '% muted)');
  t('the mute does not flicker', flips <= 8, '(' + flips + ' transitions across 30 min)');
} catch (e) {
  t('real-capture fixture loads', false, String(e.message));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
