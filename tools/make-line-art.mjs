/* ==========================================================================
   make-line-art.mjs — 把一张 PNG 提取成「黑白线稿」（Sobel 边缘）
   用法： node tools/make-line-art.mjs <输入.png> <输出.png> [阈值] [线条颜色r,g,b]
   做法： 借 CDP 打开一个空白页，用 canvas 做边缘检测，再把 PNG 存回磁盘。
   ========================================================================== */
import { writeFileSync } from 'node:fs';
import { resolve, basename, extname } from 'node:path';
import { readFileSync } from 'node:fs';

const [inPath, outPath, thrArg, colorArg] = process.argv.slice(2);
if (!inPath || !outPath) {
  console.error('用法: node tools/make-line-art.mjs <in.png> <out.png> [阈值=28] [r,g,b=20,28,40]');
  process.exit(2);
}
const THR = Number(thrArg) || 28;
const COLOR = (colorArg || '20,28,40').split(',').map(Number);

const IN = resolve(inPath);
const OUT = resolve(outPath);

/* 图片以 data URI 直接塞进页面，避免 file:// 的跨域取图限制 */
const b64 = readFileSync(IN).toString('base64');
const mime = extname(IN).toLowerCase() === '.jpg' || extname(IN).toLowerCase() === '.jpeg'
  ? 'image/jpeg' : 'image/png';
const dataUrl = `data:${mime};base64,${b64}`;

const CDP = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const version = await (await fetch(`${CDP}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id != null && pending.has(m.id)) {
    const p = pending.get(m.id);
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
  }
};
const send = (method, params = {}, sessionId) => {
  const id = ++msgId;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Runtime.enable', {}, sessionId);

const expr = `(async () => {
  const THR = ${THR}, COLOR = ${JSON.stringify(COLOR)};
  const img = new Image();
  img.src = ${JSON.stringify(dataUrl)};
  await img.decode();
  const W = img.naturalWidth, H = img.naturalHeight;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0);
  const src = ctx.getImageData(0, 0, W, H).data;

  /* 透明处按白处理，这样角色轮廓也会被勾出来 */
  const lum = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const a = src[i * 4 + 3] / 255;
    const l = 0.299 * src[i * 4] + 0.587 * src[i * 4 + 1] + 0.114 * src[i * 4 + 2];
    lum[i] = l * a + 255 * (1 - a);
  }

  const out = ctx.createImageData(W, H);
  const d = out.data;
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = y * W + x;
      const gx = -lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1]
               + lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1];
      const gy = -lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1]
               + lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1];
      let m = Math.sqrt(gx * gx + gy * gy) * 0.8;
      if (m > 255) m = 255;
      const o = i * 4;
      d[o] = COLOR[0]; d[o + 1] = COLOR[1]; d[o + 2] = COLOR[2];
      d[o + 3] = m > THR ? Math.min(255, (m - THR) * 2.4 + 40) : 0;
    }
  }
  ctx.putImageData(out, 0, 0);
  return { w: W, h: H, url: c.toDataURL('image/png') };
})()`;

const r = await send('Runtime.evaluate',
  { expression: expr, awaitPromise: true, returnByValue: true }, sessionId);
if (r.exceptionDetails) {
  console.error('失败:', r.exceptionDetails.text, r.exceptionDetails.exception?.description);
  process.exit(1);
}
const { w, h, url } = r.result.value;
writeFileSync(OUT, Buffer.from(url.split(',')[1], 'base64'));
console.log(`线稿已生成：${OUT}  ${w}x${h}  ${Math.round(readFileSync(OUT).length / 1024)} KB`);

await send('Target.closeTarget', { targetId });
ws.close();
