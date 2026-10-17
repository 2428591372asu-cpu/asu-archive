/* ==========================================================================
   verify-demo.mjs — 验证单文件版（file:// 直开）
   用法： node tools/verify-demo.mjs [file:///.../A_SU_ARCHIVE_demo.html] [shots]
   ========================================================================== */
import { writeFileSync, mkdirSync } from 'node:fs';

const CDP = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const FILE = process.argv[2] || 'file:///D:/Asu/works/DSHwork/A_SU_ARCHIVE_demo.html';
const OUTDIR = process.argv[3] || 'shots';
mkdirSync(OUTDIR, { recursive: true });

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

const events = { console: [], exceptions: [], logs: [], failed: [] };
let sid = null;
on('Runtime.consoleAPICalled', (p, s) => {
  if (s !== sid) return;
  events.console.push({ type: p.type, text: (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ') });
});
on('Runtime.exceptionThrown', (p, s) => {
  if (s !== sid) return;
  events.exceptions.push(`${p.exceptionDetails.text} ${p.exceptionDetails.exception?.description || ''}`.trim());
});
on('Log.entryAdded', (p, s) => {
  if (s !== sid || !['error', 'warning'].includes(p.entry.level)) return;
  events.logs.push(`${p.entry.level} ${p.entry.text}`.trim());
});
on('Network.loadingFailed', (p, s) => {
  if (s !== sid || p.canceled) return;
  events.failed.push(`${p.type || ''} ${p.errorText || ''}`.trim());
});

async function evaluate(expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sid);
  if (r.exceptionDetails) throw new Error(`evaluate: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
  return r.result.value;
}
async function shot(file) {
  const r = await send('Page.captureScreenshot', { format: 'png' }, sid);
  writeFileSync(file, Buffer.from(r.data, 'base64'));
}

const failed = [];
function expect(label, actual, wanted) {
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    failed.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`);
  }
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
sid = (await send('Target.attachToTarget', { targetId, flatten: true })).sessionId;
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Log.enable', {}, sid);
await send('Network.enable', {}, sid);
try {
  await send('Storage.clearDataForOrigin', { origin: 'file://', storageTypes: 'local_storage' }, sid);
} catch (e) {}
await send('Emulation.setDeviceMetricsOverride',
  { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sid);

const loaded = new Promise((res) => {
  const t = setTimeout(res, 12000);
  on('Page.loadEventFired', (p, s) => { if (s === sid) { clearTimeout(t); res(); } });
});
await send('Page.navigate', { url: FILE }, sid);
await loaded;
await sleep(1900);

const report = {};
report.boot = await evaluate(`({
  title: document.title,
  standalone: document.body.dataset.standalone === '1',
  bootGone: !document.querySelector('#boot'),
  bg: getComputedStyle(document.body).backgroundColor,
  homeOn: document.querySelector('#view-home').classList.contains('is-on'),
  charOn: document.querySelector('#view-char').classList.contains('is-on'),
  duoItems: document.querySelectorAll('.duo__item').length,
  detailHeight: Math.round(document.querySelector('#duoDetail').getBoundingClientRect().height),
  heroImgOk: (() => { const i = document.querySelector('#heroImg'); return !!i && i.naturalWidth > 0; })(),
  fileProtocol: location.protocol
})`);

await shot(`${OUTDIR}/demo-home.png`);

/* 第一下：展开详情 */
await evaluate(`document.querySelectorAll('.duo__item')[0].click(); 1`);
await sleep(950);
report.expanded = await evaluate(`(() => {
  const d = document.querySelector('#duoDetail');
  return { h: Math.round(d.getBoundingClientRect().height), side: d.dataset.side,
    latin: d.querySelector('.duo__latin')?.textContent,
    artOk: (() => { const i = d.querySelector('.duo__art img'); return !!i && i.naturalWidth > 0; })() };
})()`);
await shot(`${OUTDIR}/demo-expanded.png`);

/* 第二下：切到详情视图 */
await evaluate(`document.querySelectorAll('.duo__item')[0].click(); 1`);
await sleep(1100);
report.charView = await evaluate(`(() => {
  const v = document.querySelector('#view-char');
  const main = document.querySelector('.portrait__main') || document.querySelector('.plate__img');
  const ghost = document.querySelector('.portrait__ghost');
  return { hash: location.hash,
    charOn: v.classList.contains('is-on'),
    homeOff: !document.querySelector('#view-home').classList.contains('is-on'),
    latin: document.querySelector('.dh__latin')?.textContent || null,
    theme: document.body.dataset.theme || null,
    plateOk: !!main && main.naturalWidth > 0,
    ghostOk: !!ghost && ghost.naturalWidth > 0,
    bg: getComputedStyle(document.body).backgroundColor,
    offsetStroke: (() => { const t = document.querySelector('.dh__latin.t-off');
      return t ? getComputedStyle(t, '::before').webkitTextStrokeWidth : null; })(),
    title: document.title };
})()`);

/* 滚一遍让懒加载图片全部触发 */
await evaluate(`(async () => { const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 500)); return h; })()`);
report.charImgs = await evaluate(`(() => {
  const all = [...document.querySelectorAll('#view-char img')];
  return { total: all.length,
    broken: all.filter(i => i.getAttribute('src') && i.complete && i.naturalWidth === 0).map(i => i.dataset.file || '(inline)') };
})()`);
await sleep(300);
await shot(`${OUTDIR}/demo-char.png`);

/* 返回索引（点详情页里的「返回索引」按钮，走同页路由） */
await evaluate(`document.querySelector('#view-char a[href="index.html#index"]')?.click(); 1`);
await sleep(700);
report.backHome = await evaluate(`({
  hash: location.hash,
  homeOn: document.querySelector('#view-home').classList.contains('is-on'),
  charOff: !document.querySelector('#view-char').classList.contains('is-on'),
  theme: document.body.dataset.theme || 'night',
  bg: getComputedStyle(document.body).backgroundColor,
  title: document.title
})`);

/* 括号里的交叉链接：从 A_su 页点到蒲瓜 */
await evaluate(`document.querySelectorAll('.duo__item')[1].click(); 1`);
await sleep(900);
await evaluate(`document.querySelectorAll('.duo__item')[1].click(); 1`);
await sleep(1100);
report.crossChar = await evaluate(`({
  hash: location.hash,
  latin: document.querySelector('.dh__latin')?.textContent || null,
  emptyPlate: !!document.querySelector('.plate__empty')
})`);
await shot(`${OUTDIR}/demo-char-pugua.png`);

/* 主题开关：切夜晚 → 回首页仍保持夜晚 */
await evaluate(`document.querySelector('#themeToggle').click(); 1`);
await sleep(750);
report.toggle = await evaluate(`({ theme: document.body.dataset.theme,
  bg: getComputedStyle(document.body).backgroundColor,
  label: document.querySelector('.theme-toggle__label').textContent })`);
await evaluate(`window.__ARCHIVE_ROUTE__('index.html#index'); 1`);
await sleep(650);
report.toggleHome = await evaluate(`({ theme: document.body.dataset.theme,
  homeOn: document.querySelector('#view-home').classList.contains('is-on'),
  bg: getComputedStyle(document.body).backgroundColor })`);
await shot(`${OUTDIR}/demo-night-home.png`);

report.events = events;
report.failedChecks = failed;

/* ---- 断言 ---- */
expect('file 协议', report.boot.fileProtocol, 'file:');
expect('standalone 标记', report.boot.standalone, true);
expect('载入屏已移除', report.boot.bootGone, true);
expect('底色加载（默认白天）', report.boot.bg, 'rgb(243, 245, 247)');
expect('首页视图默认显示', report.boot.homeOn, true);
expect('详情视图默认隐藏', report.boot.charOn, false);
expect('索引条目数', report.boot.duoItems, 2);
expect('详情初始收起', report.boot.detailHeight, 0);
expect('主视觉图已解码', report.boot.heroImgOk, true);

expect('展开高度>150', report.expanded.h > 150, true);
expect('展开方向', report.expanded.side, 'left');
expect('展开是 A_su', report.expanded.latin, 'A_SU');
expect('展开插画已解码', report.expanded.artOk, true);

expect('路由 hash', report.charView.hash, '#/c/a-su');
expect('切到详情视图', report.charView.charOn, true);
expect('首页视图隐藏', report.charView.homeOff, true);
expect('详情标题', report.charView.latin, 'A_SU');
expect('立绘已解码', report.charView.plateOk, true);
expect('详情页不残留缺图', report.charImgs.broken, []);

expect('返回首页 hash', report.backHome.hash, '#index');
expect('返回后首页显示', report.backHome.homeOn, true);
expect('返回后详情隐藏', report.backHome.charOff, true);

expect('第二个角色 hash', report.crossChar.hash, '#/c/pugua');
expect('第二个角色标题', report.crossChar.latin, 'PUGUA');
expect('蒲瓜立绘位已是裁切头像', report.crossChar.emptyPlate, false);
expect('详情视图默认白天', report.charView.theme, 'day');
expect('回首页保持主题', report.backHome.theme, 'day');
expect('开关切到夜晚', report.toggle.theme, 'night');
expect('开关标签', report.toggle.label, 'NIGHT');
expect('夜晚底色', report.toggle.bg, 'rgb(8, 9, 11)');
expect('回首页仍保持夜晚', report.toggleHome.theme, 'night');
expect('回首页夜晚底色', report.toggleHome.bg, 'rgb(8, 9, 11)');

for (const c of events.console.filter((c) => c.type === 'error')) failed.push('console error: ' + JSON.stringify(c));
if (events.exceptions.length) failed.push('exceptions: ' + JSON.stringify(events.exceptions));
if (events.logs.length) failed.push('log: ' + JSON.stringify(events.logs));
if (events.failed.length) failed.push('network: ' + JSON.stringify(events.failed));

writeFileSync(`${OUTDIR}/demo-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\n===== DEMO ASSERTIONS =====');
if (failed.length) { failed.forEach((f) => console.log('FAIL  ' + f)); process.exitCode = 1; }
else console.log('ALL PASS');

await send('Target.closeTarget', { targetId });
ws.close();
