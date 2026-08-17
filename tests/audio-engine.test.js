// Offline tests for the audio engine's pure functions (DSP, detection policy, gain math).
// These need no browser: they extract the functions from bblf-enhancer.js and exercise them
// directly, so a threshold change can be checked in a second instead of waiting for a live
// break. Run:  node tests/audio-engine.test.js bblf-enhancer.js
//
// The fade-valley cases are regression coverage for a real bug: a stuck valley used to hold
// the mute for valleyMaxMs + graceMs (10.5s) instead of capping at valleyMaxMs (7s).

const src = require('fs').readFileSync(process.argv[2], 'utf8');
const consts = `var wbrbBandCount=32, wbrbEntryMarginOverBaseline=0.15, wbrbMaxHoldWithoutStrongMs=30000, wbrbClearlyLiveThreshold=0.35, wbrbAmbiguousHoldMs=20000, wbrbMinHz=80, wbrbMaxHz=8000, wbrbEntryThreshold=0.78,
 wbrbContinueThreshold=0.66, wbrbEntryConfirmations=5, wbrbReleaseGraceMs=3500,
 wbrbRequirePhaseCoherence=true, wbrbPhaseTolerance=2,
 wbrbFadeValleyDropDb=6, wbrbFadeValleyMaxMs=7000, levelTargetDb=-24, levelMaxBoostDb=12,
 levelMaxCutDb=6, levelGateDb=-52, levelWhisperFloorDb=-58, autoGainMaxDb=12;`;
const grab = (n) => {
  const re = new RegExp('function ' + n + '\\([\\s\\S]*?\\n    \\}');
  const m = src.match(re);
  if (!m) throw new Error('could not extract ' + n);
  return m[0];
};
eval(consts + [
  'wbrbNormalize', 'wbrbDetrendNormalize', 'wbrbMatchLocked', 'wbrbProfileSegments', 'wbrbCosine', 'wbrbSequenceMatch', 'wbrbSpectrumToBands',
  'wbrbNewSideState', 'wbrbPolicyStep', 'wbrbConfig', 'levelingGainDb', 'dbToGain', 'faderGains'
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

console.log('\n— policy: entry —');
const cfg = wbrbConfig();
// prime the baseline with ordinary low-scoring audio, as happens in real use
const prime = (state, from) => { let n = from; for (let i = 0; i < 30; i++) wbrbPolicyStep(state, 0.15, -25, n += 250, cfg); return n; };
let st = wbrbNewSideState(), now = 0;
now = prime(st, now);
for (let i = 0; i < 4; i++) wbrbPolicyStep(st, 0.80, -20, now += 250, cfg);
t('4 good frames do not mute yet', !st.active);
t('5th confirmation enters', wbrbPolicyStep(st, 0.80, -20, now += 250, cfg) === 'enter');
st = wbrbNewSideState();
let n2 = prime(st, 0);
for (let i = 0; i < 10; i++) wbrbPolicyStep(st, 0.70, -20, n2 += 250, cfg);
t('sub-threshold never enters', !st.active);

console.log('\n— policy: fade valley (the mid-break release bug) —');
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
let released = null;
for (let i = 0; i < 16; i++) {
  const v = wbrbPolicyStep(st, 0.20, -30, now += 250, cfg);
  if (v === 'release') released = i * 250;
}
t('valley (>6dB drop) holds the mute past the 3.5s grace', st.active && released === null);
let valleyRel = null;
const valleyStart = now;
for (let i = 0; i < 40; i++) {
  const v = wbrbPolicyStep(st, 0.20, -30, now += 250, cfg);
  if (v === 'release' && valleyRel === null) valleyRel = now;
}
const heldMs = valleyRel === null ? Infinity : valleyRel - (valleyStart - 16 * 250);
t('valley cannot latch forever — hold caps near 7s', !st.active && heldMs <= 7500,
  '(held ' + heldMs + 'ms)');

console.log('\n— policy: normal release —');
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
const enterAt = now;
let relAt = null;
for (let i = 0; i < 30; i++) {
  const v = wbrbPolicyStep(st, 0.30, -19, now += 250, cfg);
  if (v === 'release' && relAt === null) relAt = now - enterAt;
}
t('releases ~3.5s after feeds return', relAt >= 3500 && relAt <= 4000, '(at ' + relAt + 'ms)');

console.log('\n— fingerprint: shared spectral tilt must not create false matches —');
// v1.15.0 shipped a mean-centred fingerprint. Every natural audio signal carries a broad
// downward tilt, so unrelated audio scored ~0.86 - the detector muted on anything and could
// never release. These guard the fix.
const tilt = (b) => -0.9 * b;
const musicRaw = (ph) => Array.from({length:32}, (_, b) => tilt(b) + 6*Math.sin(b*0.9 + ph*0.7) + 4*Math.cos(b*0.35 - ph*0.4));
const houseRaw = (x) => Array.from({length:32}, (_, b) => tilt(b) + 5*Math.exp(-Math.pow((b - (8 + 4*Math.sin(x*0.05)))/2.5, 2)));
const oldFeat = wbrbNormalize, newFeat = wbrbDetrendNormalize;
const oldScore = wbrbCosine(oldFeat(musicRaw(3)), oldFeat(houseRaw(40)));
const newScore = wbrbCosine(newFeat(musicRaw(3)), newFeat(houseRaw(40)));
t('the old feature really did confuse them (regression witness)', oldScore > 0.7,
  '(mean-centred cos=' + oldScore.toFixed(3) + ')');
t('detrended: unrelated audio scores below the continuation threshold', newScore < 0.66,
  '(detrended cos=' + newScore.toFixed(3) + ')');
t('detrended: the same music still self-matches', wbrbCosine(newFeat(musicRaw(5)), newFeat(musicRaw(5))) > 0.99);
t('a pure tilt difference alone is neutralised',
  Math.abs(wbrbCosine(newFeat(Array.from({length:32},(_,b)=>-0.9*b)), newFeat(Array.from({length:32},(_,b)=>-0.4*b)))) < 0.5);

console.log('\n— policy: a duck can never latch permanently —');
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
t('ducked', st.active);
let watchdogRel = null;
const heldFrom = now;
// score stays just above continuation but never reaches full confidence again, and the level
// never drops - the exact shape of the reported stuck-mute
for (let i = 0; i < 400 && watchdogRel === null; i++) {
  const v = wbrbPolicyStep(st, 0.70, -20, now += 250, cfg);
  if (v === 'release') watchdogRel = now - heldFrom;
}
t('watchdog releases without full-confidence evidence', watchdogRel !== null && watchdogRel <= 31000,
  '(released after ' + (watchdogRel / 1000).toFixed(1) + 's)');

console.log('\n— policy: baseline gate —');
st = wbrbNewSideState(); now = 0;
// a feed whose ordinary audio scores high must not end up permanently muted
for (let i = 0; i < 200; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
t('sustained high scores alone do not mute once they are the norm', !st.active,
  '(baseline settled at ' + st.baseline.toFixed(2) + ')');

console.log('\n— policy: long break bed (the flicker) —');
// An unlearned passage of the same bed scores in the ambiguous band. It must not unmute.
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
let flicker = null;
for (let i = 0; i < 40; i++) {           // 10s of ambiguous (0.50), level steady
  const v = wbrbPolicyStep(st, 0.50, -20, now += 250, cfg);
  if (v === 'release' && flicker === null) flicker = i;
}
t('ambiguous passage does not unmute mid-break', st.active && flicker === null);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);  // learned part returns
t('still ducked when the learned passage comes back around', st.active);

console.log('\n— policy: feeds actually returning still releases promptly —');
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
const liveFrom = now;
let liveRel = null;
for (let i = 0; i < 40; i++) {           // house audio: clearly below clearlyLive
  const v = wbrbPolicyStep(st, 0.15, -22, now += 250, cfg);
  if (v === 'release' && liveRel === null) liveRel = now - liveFrom;
}
t('clearly-live audio releases on the normal grace', liveRel !== null && liveRel <= 4000,
  '(released after ' + (liveRel / 1000).toFixed(1) + 's)');

console.log('\n— policy: ambiguity cannot hold forever —');
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
const ambFrom = now;
let ambRel = null;
for (let i = 0; i < 400 && ambRel === null; i++) {
  const v = wbrbPolicyStep(st, 0.50, -20, now += 250, cfg);
  if (v === 'release') ambRel = now - ambFrom;
}
t('sustained ambiguity releases within the watchdog window', ambRel !== null && ambRel <= 31000,
  '(released after ' + (ambRel / 1000).toFixed(1) + 's)');

console.log('\n— phase coherence (rejecting best-of-N coincidences) —');
// A real loop advances one frame per tick. A chance match lands on an unrelated offset each
// time. Incoherent evidence must never mute, however high it scores.
st = wbrbNewSideState(); now = 0; now = prime(st, now);
let incoherentEntered = false;
for (let i = 0; i < 40; i++) {
  if (wbrbPolicyStep(st, 0.95, -20, now += 250, cfg, { coherent: false, seg: 0, offset: (i * 37) % 300 }) === 'enter') incoherentEntered = true;
}
t('high but incoherent scores never mute', !incoherentEntered && !st.active);
st = wbrbNewSideState(); now = 0; now = prime(st, now);
let coherentEntered = false;
for (let i = 0; i < 8; i++) {
  if (wbrbPolicyStep(st, 0.85, -20, now += 250, cfg, { coherent: true, seg: 0, offset: 100 + i }) === 'enter') coherentEntered = true;
}
t('coherent advancing match still mutes', coherentEntered && st.active);
t('entry records the lock position', st.lockSeg === 0 && st.lockOffset >= 100);
st = wbrbNewSideState(); now = 0; now = prime(st, now);
for (let i = 0; i < 5; i++) wbrbPolicyStep(st, 0.95, -20, now += 250, cfg, { coherent: true, seg: 0, offset: i });
let incoherentHeld = null;
for (let i = 0; i < 200 && incoherentHeld === null; i++) {
  // stuck: scores stay high but never phase-coherent again - the watchdog must fire
  const v = wbrbPolicyStep(st, 0.95, -20, now += 250, cfg, { coherent: false, seg: 0, offset: (i * 53) % 300 });
  if (v === 'release') incoherentHeld = i * 250;
}
t('incoherent high scores cannot renew the watchdog', incoherentHeld !== null && incoherentHeld <= 31000,
  '(released after ' + (incoherentHeld / 1000).toFixed(1) + 's)');

console.log('\n— locked matching —');
let segSeed = 12345;
const segRnd = () => { segSeed = (segSeed * 1103515245 + 12345) % 2147483648; return segSeed / 2147483648; };
const seg = Array.from({ length: 50 }, () =>
  wbrbDetrendNormalize(Array.from({ length: 32 }, (_, b) => -0.9 * b + 10 * segRnd())));
const prof = { segments: [seg], feature: 'detrend-v2' };
const win = seg.slice(20, 32);
const locked = wbrbMatchLocked(prof, win, 0, 20);
t('locked search finds the exact continuation', locked.best > 0.99 && locked.offset === 20,
  '(score ' + locked.best.toFixed(3) + ' at offset ' + locked.offset + ')');
const lockedWrong = wbrbMatchLocked(prof, win, 0, 40);
t('locked search does NOT find a far-away offset', lockedWrong.best < 0.6,
  '(score ' + lockedWrong.best.toFixed(3) + ' vs ' + locked.best.toFixed(3) + ' at the right place)');
t('segments helper handles the legacy single-frames shape',
  wbrbProfileSegments({ frames: seg }).length === 1 && wbrbProfileSegments(prof).length === 1);

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
