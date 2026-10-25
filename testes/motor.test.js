// Testes do motor do index.html (treinador de ouvido absoluto), sem navegador.
// Uso (na raiz do repositório):  node testes/motor.test.js
// Extrai as funções puras do HTML (YIN, MFCC, DTW, classificação, detecção de voz, estatística)
// e confere contra palavras sintetizadas por formantes (testes/sint.js).
'use strict';
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const js = html.match(/<script>([\s\S]*)<\/script>/)[1];
const pegar = re => { const m = js.match(re); if (!m) throw new Error('não achei no HTML: ' + re); return m[0]; };

const codigo = [
  'let VZ={tpl:[],clips:{}};',
  pegar(/const mediana=[^\n]*\n/),
  pegar(/const percentil=[^\n]*\n/),
  pegar(/const LF=\[0\];/),
  pegar(/function caudaBinomial[^\n]*\n/),
  pegar(/function yin\([\s\S]*?\n\}/),
  pegar(/function temVoz\([\s\S]*?\n\}/),
  js.slice(js.indexOf('function fft('), js.indexOf('/* sons de confirmação')),
  'module.exports={yin,temVoz,mfcc,dtw,classificar,calibrar,caudaBinomial,get VZ(){return VZ;}};'
].join('\n');
const tmp = path.join(__dirname, '.motor-extraido.js');
fs.writeFileSync(tmp, codigo);
const M = require(tmp);
const { sintetizar } = require('./sint.js');

let falhas = 0;
const conferir = (ok, msg) => { console.log((ok ? '  ok   ' : '  FALHA ') + msg); if (!ok) falhas++; };

console.log('YIN (detecção de altura do canto)');
for (const f of [98, 196, 261.63, 440, 659.26]) {
  const sr = 48000, b = new Float32Array(4096);
  for (let i = 0; i < b.length; i++) { const t = i / sr; b[i] = .5 * Math.sin(2 * Math.PI * f * t) + .25 * Math.sin(4 * Math.PI * f * t); }
  const r = M.yin(b, sr), c = r ? 1200 * Math.log2(r.f / f) : 999;
  conferir(Math.abs(c) < 2, `${f} Hz → erro ${c.toFixed(2)} cents`);
}

console.log('Karplus-Strong (afinação das cordas sintetizadas, mesma fórmula do HTML)');
conferir(/L=Math\.max\(2,Math\.floor\(sr\/f\+0\.5\)\)/.test(js) && /f0=sr\/\(L-0\.5\)/.test(js), 'HTML usa a fórmula corrigida (atraso efetivo L−0,5)');
for (const sr of [48000, 44100]) for (const f of [130.81, 440, 987.77]) {
  const L = Math.max(2, Math.floor(sr / f + 0.5)), f0 = sr / (L - 0.5), amort = Math.pow(0.07, 1 / f0);
  const linha = new Float32Array(L), out = new Float32Array(sr); for (let i = 0; i < L; i++) linha[i] = Math.random() * 2 - 1;
  let idx = 0; for (let n = 0; n < sr; n++) { const a = linha[idx], b = linha[(idx + 1) % L]; out[n] = a; linha[idx] = amort * .5 * (a + b); idx = (idx + 1) % L; }
  const rate = f / f0, seg = new Float32Array(4096);
  for (let i = 0; i < 4096; i++) { const x = (i + 2000) * rate, j = Math.floor(x), fr = x - j; seg[i] = out[j] * (1 - fr) + out[j + 1] * fr; }
  const r = M.yin(seg, sr), c = r ? 1200 * Math.log2(r.f / f) : 999;
  conferir(Math.abs(c) < 1, `${sr} Hz, ${f} Hz → erro ${c.toFixed(2)} cents`);
}

console.log('Estatística');
conferir(M.caudaBinomial(12, 48, 1 / 12) < 0.001, '12/48 acertos é significativo contra 1/12');
conferir(M.caudaBinomial(4, 48, 1 / 12) > 0.3, '4/48 acertos é compatível com o acaso');

console.log('Reconhecimento de voz (palavras sintéticas, 13 classes)');
const sr = 48000, VZ = M.VZ, todas = new Set([...Array(13).keys()]);
for (let r = 0; r < 3; r++) for (let c = 0; c < 13; c++) { const f = M.mfcc(sintetizar(c, sr), sr); VZ.tpl.push({ c, n: f.n, f: f.f }); }
M.calibrar();
let certo = 0, errado = 0, rej = 0, N = 0;
for (let k = 0; k < 10; k++) for (let c = 0; c < 13; c++) {
  const r = M.classificar(M.mfcc(sintetizar(c, sr), sr), todas); N++;
  if (!r.claro) rej++; else if (r.c === c) certo++; else errado++;
}
conferir(errado / N < 0.03, `trocas: ${errado}/${N} (meta < 3%)`);
conferir(rej / N < 0.2, `"não entendi": ${rej}/${N} (meta < 20%)`);
conferir(certo / N > 0.8, `acertos: ${certo}/${N}`);

console.log('Detecção de voz (palavra x ruído)');
let voz = 0; for (let c = 0; c < 13; c++) if (M.temVoz(sintetizar(c, sr), sr)) voz++;
conferir(voz === 13, `palavras aceitas como voz: ${voz}/13`);
for (const tipo of ['branco', 'atrito', 'batidas']) {
  let fp = 0;
  for (let k = 0; k < 10; k++) {
    const n = Math.floor(sr * .6), x = new Float32Array(n); let br = 0;
    for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; br = .995 * br + w * .05;
      x[i] = tipo === 'branco' ? w * .3 : tipo === 'atrito' ? br * (.5 + .5 * Math.sin(i / sr * 2 * Math.PI * 7)) : (i % 7200 < 200 ? w * .8 : w * .01); }
    if (M.temVoz(x, sr)) fp++;
  }
  conferir(fp === 0, `ruído ${tipo} aceito como voz: ${fp}/10`);
}

fs.unlinkSync(tmp);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTudo certo.');
process.exit(falhas ? 1 : 0);
