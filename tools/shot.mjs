/* ==========================================================================
   shot.mjs — 截单页/单区块的图，方便对照设计
   用法： node tools/shot.mjs <url> <out.png> [selector|scrollY] [width] [height]
   例：   node tools/shot.mjs http://127.0.0.1:8777/index.html out.png "#roster"
   ========================================================================== */
import { writeFileSync } from 'node:fs';

const CDP = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const [url, out, sel, w, h, clickSel, evalExpr, waitArg] = process.argv.slice(2);
const WAIT = Number(waitArg) || 1700;
if (!url || !out) { console.error('need <url> <out.png>'); process.exit(2); }
const W = Number(w) || 1440;
const H = Number(h) || 900;

const version = await (await fetch(`${CDP}/json/version`)).json();
const ws = new WebSocket(version.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let msgId = 0;
const pending = new Map();
const listeners = new Map();
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id != null) {
    const p = pending.get(m.id);
    if (!p) return;
    pending.delete(m.id);
    m.error ? p.reject(new Error(JSON.stringify(m.error))) : p.resolve(m.result);
    return;
  }
  (listeners.get(m.method) || []).forEach((fn) => fn(m.params, m.sessionId));
};
const send = (method, params = {}, sessionId) => {
  const id = ++msgId;
  ws.send(JSON.stringify(sessionId ? { id, method, params, sessionId } : { id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
};
const on = (m, fn) => { if (!listeners.has(m)) listeners.set(m, []); listeners.get(m).push(fn); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
/* 每次截图都当作全新访客：清掉上次存的主题，避免上一轮的 localStorage 影响结果 */
try {
  const u = new URL(url);
  const origin = u.protocol === 'file:' ? 'file://' : u.origin;
  await send('Storage.clearDataForOrigin', { origin, storageTypes: 'local_storage' }, sessionId);
} catch (e) {}
await send('Emulation.setDeviceMetricsOverride',
  { width: W, height: H, deviceScaleFactor: 1, mobile: false }, sessionId);

const loaded = new Promise((res) => {
  const t = setTimeout(res, 9000);
  on('Page.loadEventFired', (p, sid) => { if (sid === sessionId) { clearTimeout(t); res(); } });
});
await send('Page.navigate', { url }, sessionId);
await loaded;
await sleep(WAIT);

if (clickSel && clickSel !== 'none') {
  /* 支持 'a|b' 连续点击，用来拍「先切主题再展开」这类组合状态 */
  for (const one of String(clickSel).split('|')) {
    const r = await send('Runtime.evaluate',
      { expression: `(() => { const el = document.querySelector(${JSON.stringify(one)});
          if (!el) return 'NOT FOUND'; el.click(); return 'clicked'; })()`, returnByValue: true }, sessionId);
    console.log('click', one, '→', r.result.value);
    await sleep(900);
  }
  await sleep(400);
}

if (sel) {
  const expr = /^\d+$/.test(sel)
    ? `window.scrollTo(0, ${sel}); 1`
    : `(() => { const el = document.querySelector(${JSON.stringify(sel)});
         if (!el) return 'NOT FOUND: ' + ${JSON.stringify(sel)};
         const y = el.getBoundingClientRect().top + window.scrollY - 84;
         window.scrollTo(0, Math.max(0, y)); return Math.round(y); })()`;
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true }, sessionId);
  console.log('scroll →', r.result.value);
  await sleep(900);
}

/* '@hover:选择器' —— 把鼠标移到元素中心，触发 :hover 再截图 */
if (clickSel && clickSel.startsWith('@hover:')) {
  const hsel = clickSel.slice(7);
  const box = await send('Runtime.evaluate', {
    expression: `(() => { const el = document.querySelector(${JSON.stringify(hsel)});
      if (!el) return null; const r = el.getBoundingClientRect();
      return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) }; })()`,
    returnByValue: true
  }, sessionId);
  const p = box.result.value;
  if (p) {
    await send('Input.dispatchMouseEvent',
      { type: 'mouseMoved', x: p.x, y: p.y, button: 'none' }, sessionId);
    console.log('hover', hsel, p);
    await sleep(900);
  }
}

const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
writeFileSync(out, Buffer.from(shot.data, 'base64'));
console.log('saved', out);

if (evalExpr) {
  const r = await send('Runtime.evaluate',
    { expression: evalExpr, awaitPromise: true, returnByValue: true }, sessionId);
  console.log('eval →', JSON.stringify(r.result.value ?? r.exceptionDetails?.text));
}
await send('Target.closeTarget', { targetId });
ws.close();
