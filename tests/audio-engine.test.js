// Offline tests for the audio engine's pure functions (DSP, detection policy, gain math).
// These need no browser: they extract the functions from bblf-enhancer.js and exercise them
// directly, so a threshold change can be checked in a second instead of waiting for a live
// break. Run:  node tests/audio-engine.test.js bblf-enhancer.js
//
// The fade-valley cases are regression coverage for a real bug: a stuck valley used to hold
// the mute for valleyMaxMs + graceMs (10.5s) instead of capping at valleyMaxMs (7s).

const src = require('fs').readFileSync(process.argv[2], 'utf8');
const consts = `var wbrbBandCount=32, wbrbMinHz=80, wbrbMaxHz=8000, wbrbEntryThreshold=0.74,
 wbrbContinueThreshold=0.66, wbrbEntryConfirmations=3, wbrbReleaseGraceMs=3500,
 wbrbFadeValleyDropDb=6, wbrbFadeValleyMaxMs=7000, levelTargetDb=-24, levelMaxBoostDb=12,
 levelMaxCutDb=6, levelGateDb=-52, levelWhisperFloorDb=-58, autoGainMaxDb=12;`;
const grab = (n) => {
  const re = new RegExp('function ' + n + '\\([\\s\\S]*?\\n    \\}');
  const m = src.match(re);
  if (!m) throw new Error('could not extract ' + n);
  return m[0];
};
eval(consts + [
  'wbrbNormalize', 'wbrbCosine', 'wbrbSequenceMatch', 'wbrbSpectrumToBands',
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
let st = wbrbNewSideState(), now = 0;
for (let i = 0; i < 2; i++) wbrbPolicyStep(st, 0.80, -20, now += 250, cfg);
t('2 good frames do not mute yet', !st.active);
t('3rd confirmation enters', wbrbPolicyStep(st, 0.80, -20, now += 250, cfg) === 'enter');
st = wbrbNewSideState();
for (let i = 0; i < 10; i++) wbrbPolicyStep(st, 0.70, -20, i * 250, cfg);
t('sub-threshold never enters', !st.active);

console.log('\n— policy: fade valley (the mid-break release bug) —');
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < 3; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
let released = null;
for (let i = 0; i < 16; i++) {
  const v = wbrbPolicyStep(st, 0.40, -30, now += 250, cfg);
  if (v === 'release') released = i * 250;
}
t('valley (>6dB drop) holds the mute past the 3.5s grace', st.active && released === null);
let valleyRel = null;
const valleyStart = now;
for (let i = 0; i < 40; i++) {
  const v = wbrbPolicyStep(st, 0.40, -30, now += 250, cfg);
  if (v === 'release' && valleyRel === null) valleyRel = now;
}
const heldMs = valleyRel - (valleyStart - 16 * 250);
t('valley cannot latch forever — hold caps near 7s', !st.active && heldMs <= 7500,
  '(held ' + heldMs + 'ms)');

console.log('\n— policy: normal release —');
st = wbrbNewSideState(); now = 0;
for (let i = 0; i < 3; i++) wbrbPolicyStep(st, 0.85, -20, now += 250, cfg);
const enterAt = now;
let relAt = null;
for (let i = 0; i < 30; i++) {
  const v = wbrbPolicyStep(st, 0.30, -19, now += 250, cfg);
  if (v === 'release' && relAt === null) relAt = now - enterAt;
}
t('releases ~3.5s after feeds return', relAt >= 3500 && relAt <= 4000, '(at ' + relAt + 'ms)');

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
