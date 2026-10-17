/* ==========================================================================
   verify.mjs — 用 CDP 驱动真实浏览器（Edge headless）验证页面
   用法： node tools/verify.mjs http://127.0.0.1:8777 shots
   需要浏览器已带 --remote-debugging-port=9222 启动
   ========================================================================== */
import { writeFileSync, mkdirSync } from 'node:fs';

const CDP = process.env.CDP_BASE || 'http://127.0.0.1:9222';
const ROOT = (process.argv[2] || 'http://127.0.0.1:8777').replace(/\/$/, '');
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
    m.error ? p.reject(new Error(`${m.method || ''} ${JSON.stringify(m.error)}`)) : p.resolve(m.result);
    return;
  }
  (listeners.get(m.method) || []).forEach((fn) => fn(m.params, m.sessionId));
};
function send(method, params = {}, sessionId) {
  const id = ++msgId;
  const payload = { id, method, params };
  if (sessionId) payload.sessionId = sessionId;
  ws.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}
function on(method, fn) {
  if (!listeners.has(method)) listeners.set(method, []);
  listeners.get(method).push(fn);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let cur = null;
/* 第三方统计（不蒜子等）挂了不算页面问题，单独放过 */
const THIRD_PARTY = /busuanzi|getloli|counterapi|laobi\.icu|visitor-badge/i;
const reqUrls = new Map();
on('Network.requestWillBeSent', (p, sid) => {
  if (cur && sid === cur.sessionId) reqUrls.set(p.requestId, p.request.url || '');
});
on('Runtime.consoleAPICalled', (p, sid) => {
  if (!cur || sid !== cur.sessionId) return;
  cur.console.push({ type: p.type, text: (p.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ') });
});
on('Runtime.exceptionThrown', (p, sid) => {
  if (!cur || sid !== cur.sessionId) return;
  cur.exceptions.push(`${p.exceptionDetails.text} ${p.exceptionDetails.exception?.description || ''}`.trim());
});
on('Log.entryAdded', (p, sid) => {
  if (!cur || sid !== cur.sessionId) return;
  if (THIRD_PARTY.test(p.entry.text || '') || THIRD_PARTY.test(p.entry.url || '')) return;
  if (p.entry.level === 'error' || p.entry.level === 'warning') {
    cur.logs.push(`${p.entry.level} ${p.entry.text} ${p.entry.url || ''}`.trim());
  }
});
on('Network.loadingFailed', (p, sid) => {
  if (!cur || sid !== cur.sessionId || p.canceled) return;
  if (THIRD_PARTY.test(reqUrls.get(p.requestId) || '')) return;
  cur.failed.push(`${p.type || ''} ${p.errorText || ''}`.trim());
});

const failedAssertions = [];
function expect(label, actual, wanted) {
  const ok = JSON.stringify(actual) === JSON.stringify(wanted);
  if (!ok) failedAssertions.push(`${label}: got ${JSON.stringify(actual)}, want ${JSON.stringify(wanted)}`);
  return ok;
}

async function evaluate(sessionId, expression) {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (r.exceptionDetails) throw new Error(`evaluate: ${r.exceptionDetails.text} ${r.exceptionDetails.exception?.description || ''}`);
  return r.result.value;
}

async function screenshot(sessionId, file, full) {
  let params = { format: 'png' };
  if (full) {
    const m = await send('Page.getLayoutMetrics', {}, sessionId);
    const cs = m.cssContentSize || m.contentSize;
    params = {
      format: 'png', captureBeyondViewport: true,
      clip: { x: 0, y: 0, width: Math.min(Math.ceil(cs.width), 1600), height: Math.min(Math.ceil(cs.height), 9000), scale: 1 }
    };
  }
  const r = await send('Page.captureScreenshot', params, sessionId);
  writeFileSync(file, Buffer.from(r.data, 'base64'));
}

const SCROLL_ALL = `(async () => {
  const h = document.documentElement.scrollHeight;
  for (let y = 0; y < h; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 55)); }
  window.scrollTo(0, 0); await new Promise(r => setTimeout(r, 450));
  return h;
})()`;

const BROKEN = `(() => {
  const all = [...document.images];
  /* 没有 src 的（比如还没轮到的轮换层）不算坏图 */
  const withSrc = all.filter(i => i.getAttribute('src'));
  return { total: all.length,
    broken: withSrc.filter(i => i.complete && i.naturalWidth === 0).map(i => i.dataset.file || i.src) };
})()`;

async function runPage(name, url, kind, opts) {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  cur = { sessionId, console: [], exceptions: [], logs: [], failed: [] };
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await send('Log.enable', {}, sessionId);
  await send('Network.enable', {}, sessionId);
  /* 每次当作全新访客，避免上一轮存的主题影响断言 */
  try {
    const u = new URL(url);
    await send('Storage.clearDataForOrigin',
      { origin: u.protocol === 'file:' ? 'file://' : u.origin, storageTypes: 'local_storage' }, sessionId);
  } catch (e) {}
  if (opts && opts.mobile) {
    await send('Emulation.setDeviceMetricsOverride',
      { width: 390, height: 844, deviceScaleFactor: 2, mobile: true }, sessionId);
  } else {
    await send('Emulation.setDeviceMetricsOverride',
      { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false }, sessionId);
  }

  const loaded = new Promise((res) => {
    const t = setTimeout(res, 9000);
    on('Page.loadEventFired', (p, sid) => { if (sid === sessionId) { clearTimeout(t); res(); } });
  });
  await send('Page.navigate', { url }, sessionId);
  await loaded;
  await sleep(1600);

  const docHeight = await evaluate(sessionId, SCROLL_ALL);
  await sleep(400);

  const result = { name, url, docHeight };
  result.checks = await evaluate(sessionId, `({
    title: document.title,
    bootRemoved: !document.querySelector('#boot'),
    broken: (${BROKEN}),
    fontBahnschrift: document.fonts.check('16px "Bahnschrift SemiCondensed"'),
    fontNoto: document.fonts.check('16px "Noto Sans SC"'),
    fontCascadia: document.fonts.check('16px "Cascadia Mono"')
  })`);

  if (kind === 'index') {
    Object.assign(result.checks, await evaluate(sessionId, `({
      duoItems: document.querySelectorAll('.duo__item').length,
      duoNames: [...document.querySelectorAll('.duo__name')].map(e => e.textContent),
      rosterGone: document.querySelector('#roster') === null,
      heroIndexGone: document.querySelector('#heroIndex') === null,
      detailClosed: Math.round(document.querySelector('#duoDetail').getBoundingClientRect().height) === 0,
      shots: document.querySelectorAll('.shot').length,
      stats: [...document.querySelectorAll('.hero__stat b')].map(e => e.textContent),
      specRows: document.querySelectorAll('.spec__row').length,
      heroName: document.querySelector('#heroTitle').innerText.replace(/\\s+/g, '|'),
      heroBg: document.querySelector('#heroImg').src.split('/').pop(),
      slides: document.querySelectorAll('.hero__slide').length,
      slideOn: document.querySelectorAll('.hero__slide.is-on').length,
      arrows: document.querySelectorAll('.hero__arrow').length,
      revealed: document.querySelectorAll('[data-reveal].is-in').length,
      theme: document.body.dataset.theme || null,
      accentDefault: getComputedStyle(document.body).getPropertyValue('--accent').trim()
    })`));

    /* 交互：点开灯箱 */
    await evaluate(sessionId, `document.querySelector('.shot').click(); 1`);
    await sleep(600);
    result.lightbox = await evaluate(sessionId, `(() => {
      const lb = document.querySelector('.lb');
      return { open: !!lb && lb.classList.contains('is-open'),
        file: (document.querySelector('#lbImg').getAttribute('src') || '').split('/').pop(),
        title: document.querySelector('#lbTitle').textContent,
        counter: document.querySelector('#lbCount').textContent + '/' + document.querySelector('#lbTotal').textContent,
        nav: [document.querySelector('#lbPrev').disabled, document.querySelector('#lbNext').disabled] };
    })()`);
    await screenshot(sessionId, `${OUTDIR}/${name}--lightbox.png`, false);
    await evaluate(sessionId, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 1`);
    await sleep(450);
    result.lightboxClosed = await evaluate(sessionId,
      `!(document.querySelector('.lb') || {}).classList?.contains('is-open')`);

    /* 索引交互：第一下展开，展开块在下方长大 */
    await evaluate(sessionId, `document.querySelectorAll('.duo__item')[0].click(); 1`);
    await sleep(950);
    result.duoOpen = await evaluate(sessionId, `(() => {
      const d = document.querySelector('#duoDetail');
      const it = document.querySelectorAll('.duo__item')[0];
      return { h: Math.round(d.getBoundingClientRect().height),
        side: d.dataset.side,
        openClass: d.classList.contains('is-open'),
        expanded: it.getAttribute('aria-expanded'),
        cue: it.querySelector('.duo__cue').textContent,
        latin: d.querySelector('.duo__latin')?.textContent,
        accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(),
        cta: d.querySelector('.duo__cta a')?.getAttribute('href') };
    })()`);
    await screenshot(sessionId, `${OUTDIR}/${name}--expanded.png`, false);

    /* 切换到右侧角色：内容换人、面板高度继续动画 */
    await evaluate(sessionId, `document.querySelectorAll('.duo__item')[1].click(); 1`);
    await sleep(950);
    result.duoSwitch = await evaluate(sessionId, `(() => {
      const d = document.querySelector('#duoDetail');
      const it = document.querySelectorAll('.duo__item')[1];
      return { side: d.dataset.side, latin: d.querySelector('.duo__latin')?.textContent,
        expanded: it.getAttribute('aria-expanded'),
        accent: getComputedStyle(document.body).getPropertyValue('--accent').trim(),
        h: Math.round(d.getBoundingClientRect().height) };
    })()`);
    await screenshot(sessionId, `${OUTDIR}/${name}--expanded-right.png`, false);

    /* ESC 收起 */
    await evaluate(sessionId, `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); 1`);
    await sleep(800);
    result.duoClosed = await evaluate(sessionId,
      `Math.round(document.querySelector('#duoDetail').getBoundingClientRect().height)`);

    /* 主题开关：白天 → 夜晚 → 白天 */
    await evaluate(sessionId, `document.querySelector('#themeToggle').click(); 1`);
    await sleep(750);
    result.toggle = await evaluate(sessionId, `({
      theme: document.body.dataset.theme,
      label: document.querySelector('.theme-toggle__label').textContent,
      pressed: document.querySelector('#themeToggle').getAttribute('aria-pressed'),
      bg: getComputedStyle(document.body).backgroundColor
    })`);
    await screenshot(sessionId, `${OUTDIR}/${name}--night.png`, false);
    await evaluate(sessionId, `document.querySelector('#themeToggle').click(); 1`);
    await sleep(750);
    result.toggleBack = await evaluate(sessionId,
      `({ theme: document.body.dataset.theme })`);
  }

  if (kind === 'duomobile') {
    Object.assign(result.checks, await evaluate(sessionId, `({
      items: document.querySelectorAll('.duo__item').length,
      column: getComputedStyle(document.querySelector('.duo__row')).flexDirection,
      detailClosed: Math.round(document.querySelector('#duoDetail').getBoundingClientRect().height) === 0,
      vw: window.innerWidth
    })`));
    await evaluate(sessionId, `document.querySelectorAll('.duo__item')[1].click(); 1`);
    await sleep(950);
    result.tapOpen = await evaluate(sessionId, `(() => {
      const d = document.querySelector('#duoDetail');
      const it = document.querySelectorAll('.duo__item')[1];
      return { h: Math.round(d.getBoundingClientRect().height),
        side: d.dataset.side, expanded: it.getAttribute('aria-expanded'),
        latin: d.querySelector('.duo__latin')?.textContent,
        infoWidth: Math.round(d.querySelector('.duo__info').getBoundingClientRect().width) };
    })()`);
    await screenshot(sessionId, `${OUTDIR}/${name}--expanded.png`, false);
  }

  if (kind === 'character') {
    Object.assign(result.checks, await evaluate(sessionId, `({
      latin: document.querySelector('.dh__latin').textContent,
      cn: document.querySelector('.dh__cn')?.textContent || null,
      fields: document.querySelectorAll('.field').length,
      tbd: document.querySelectorAll('.tbd').length,
      chips: [...document.querySelectorAll('.chip')].map(c => c.textContent.replace(/\\s+/g, ' ').trim()),
      items: document.querySelectorAll('.gitem').length,
      emptySlots: document.querySelectorAll('.empty-slot').length,
      plateImg: (!!document.querySelector('.portrait__main') || !!document.querySelector('.plate__img')),
      plateEmpty: !!document.querySelector('.plate__empty'),
      theme: document.body.dataset.theme || null,
      charTheme: document.body.dataset.char || null,
      offsetText: (() => {
        const t = document.querySelector('.dh__latin.t-off');
        if (!t) return null;
        const s = getComputedStyle(t, '::before');
        return { data: t.dataset.text, stroke: s.webkitTextStrokeWidth, color: s.color };
      })(),
      xcard: document.querySelector('#xcard')?.getAttribute('href')
    })`));

    /* 交互：切换筛选 → 点开大图 */
    const chipLabel = await evaluate(sessionId, `(() => {
      const c = [...document.querySelectorAll('.chip')].find(x => x.dataset.filter === '头像');
      if (!c) return null; c.click(); return '头像';
    })()`);
    await sleep(500);
    result.filterTest = {
      chip: chipLabel,
      ...(await evaluate(sessionId, `({
        items: document.querySelectorAll('.gitem').length,
        emptySlots: document.querySelectorAll('.empty-slot').length,
        on: [...document.querySelectorAll('.chip.is-on')].map(c => c.dataset.filter)
      })`))
    };
    await evaluate(sessionId, `document.querySelector('.chip[data-filter="ALL"]').click(); 1`);
    await sleep(400);
    await evaluate(sessionId, `document.querySelector('.gitem')?.click(); 1`);
    await sleep(600);
    result.lightbox = await evaluate(sessionId, `(() => {
      const lb = document.querySelector('.lb');
      return { open: !!lb && lb.classList.contains('is-open'),
        file: (document.querySelector('#lbImg').getAttribute('src') || '').split('/').pop(),
        title: document.querySelector('#lbTitle').textContent };
    })()`);
    await screenshot(sessionId, `${OUTDIR}/${name}--lightbox.png`, false);
    await evaluate(sessionId, `document.querySelector('#lbClose').click(); 1`);
    await sleep(300);
  }

  if (kind === 'indexfile') {
    Object.assign(result.checks, await evaluate(sessionId, `({
      duoItems: document.querySelectorAll('.duo__item').length,
      shots: document.querySelectorAll('.shot').length,
      bg: getComputedStyle(document.body).backgroundColor,
      heroImgOk: (() => { const i = document.querySelector('#heroImg'); return !!i && i.complete && i.naturalWidth > 0; })()
    })`));
  }

  await screenshot(sessionId, `${OUTDIR}/${name}.png`, false);
  await screenshot(sessionId, `${OUTDIR}/${name}--full.png`, true);
  result.console = cur.console;
  result.exceptions = cur.exceptions;
  result.logs = cur.logs;
  result.failed = cur.failed;
  await send('Target.closeTarget', { targetId });
  cur = null;
  return result;
}

const pages = [
  ['index', `${ROOT}/index.html`, 'index', null],
  ['a-su', `${ROOT}/character.html?id=a-su`, 'character', null],
  ['pugua', `${ROOT}/character.html?id=pugua`, 'character', null],
  ['file-index', 'file:///' + process.cwd().replace(/\\/g, '/') + '/index.html', 'indexfile', null],
  ['index-mobile', `${ROOT}/index.html`, 'duomobile', { mobile: true }]
];

const report = {};
for (const [name, url, kind, opts] of pages) report[name] = await runPage(name, url, kind, opts);

/* 第二下点击应当进档案：单独开一个 target 测，避免打乱前面的页面 */
async function testNavigate() {
  const { targetId } = await send('Target.createTarget', { url: `${ROOT}/index.html` });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  await sleep(2000);
  await evaluate(sessionId, `document.querySelectorAll('.duo__item')[0].click(); 1`);
  await sleep(900);
  const afterFirst = await evaluate(sessionId, `location.pathname.split('/').pop()`);
  await evaluate(sessionId, `document.querySelectorAll('.duo__item')[0].click(); 1`);
  await sleep(1800);
  const afterSecond = await evaluate(sessionId,
    `location.pathname.split('/').pop() + location.search`);
  await send('Target.closeTarget', { targetId });
  return { afterFirst, afterSecond };
}
report.nav = await testNavigate();

/* ---- 断言 ---- */
const idx = report.index.checks;
expect('index.duoItems', idx.duoItems, 2);
expect('index.duoNames', idx.duoNames, ['A_SU', 'PUGUA']);
expect('index.rosterGone', idx.rosterGone, true);
expect('index.heroIndexGone', idx.heroIndexGone, true);
expect('index.detailClosed', idx.detailClosed, true);
expect('index.shots', idx.shots, 4);
expect('index.specRows', idx.specRows, 7);
expect('index.stats', idx.stats, ['02', '50', '08', '00']);
expect('index.slides', idx.slides, 2);
expect('index.slideOn', idx.slideOn, 1);
expect('index.arrows', idx.arrows, 2);
expect('index.heroBg', idx.heroBg, 'together-picnic.jpg');
expect('index.lightbox.open', report.index.lightbox.open, true);
expect('index.lightbox.counter', report.index.lightbox.counter, '01/04');
expect('index.lightboxClosed', report.index.lightboxClosed, true);
expect('index.duoOpen.side', report.index.duoOpen.side, 'left');
expect('index.duoOpen.openClass', report.index.duoOpen.openClass, true);
expect('index.duoOpen.expanded', report.index.duoOpen.expanded, 'true');
expect('index.duoOpen.latin', report.index.duoOpen.latin, 'A_SU');
expect('index.duoOpen.cta', report.index.duoOpen.cta, 'character.html?id=a-su');
expect('index.duoOpen.height>150', report.index.duoOpen.h > 150, true);
expect('index.duoOpen.cue', report.index.duoOpen.cue, '进入档案 \u2192');
expect('index.duoSwitch.side', report.index.duoSwitch.side, 'right');
expect('index.duoSwitch.latin', report.index.duoSwitch.latin, 'PUGUA');
expect('index.duoSwitch.expanded', report.index.duoSwitch.expanded, 'true');
expect('index.duoClosed.height', report.index.duoClosed, 0);
expect('index.theme', idx.theme, 'day');
expect('index.accentDefault（默认灰）', idx.accentDefault, '#8d97a3');
expect('index.duoOpen.accent（选中变蓝）', report.index.duoOpen.accent, '#2f80bd');
expect('index.duoSwitch.accent（切换变黄绿）', report.index.duoSwitch.accent, '#8ba31f');
expect('index.toggle.theme', report.index.toggle.theme, 'night');
expect('index.toggle.label', report.index.toggle.label, 'NIGHT');
expect('index.toggle.pressed', report.index.toggle.pressed, 'true');
expect('index.toggle.bg（主题黑）', report.index.toggle.bg, 'rgb(8, 9, 11)');
expect('index.toggleBack.theme', report.index.toggleBack.theme, 'day');
expect('nav.afterFirstClick', report.nav.afterFirst, 'index.html');
expect('nav.afterSecondClick', report.nav.afterSecond, 'character.html?id=a-su');

const asu = report['a-su'].checks;
expect('a-su.items', asu.items, 22);
expect('a-su.fields', asu.fields, 9);
expect('a-su.tbd', asu.tbd, 1);
expect('a-su.emptySlots', asu.emptySlots, 0);
expect('a-su.plateImg', asu.plateImg, true);
expect('a-su.theme', asu.theme, 'day');
expect('a-su.charTheme', asu.charTheme, 'a-su');
expect('a-su.crossLink', asu.xcard, 'character.html?id=pugua');
expect('a-su.lightbox.open', report['a-su'].lightbox.open, true);

const pug = report.pugua.checks;
expect('pugua.items', pug.items, 31);
expect('pugua.fields', pug.fields, 10);
expect('pugua.tbd', pug.tbd, 1);
expect('pugua.emptySlots', pug.emptySlots, 0);
expect('pugua.plateImg', pug.plateImg, true);
expect('pugua.filterTest.items', report.pugua.filterTest.items, 5);
expect('pugua.filterTest.emptySlots', report.pugua.filterTest.emptySlots, 0);

const fi = report['file-index'].checks;
expect('file-index.duoItems', fi.duoItems, 2);
expect('file-index.css', fi.bg, 'rgb(243, 245, 247)');   /* 默认白天主题底色 */
expect('file-index.heroImg', fi.heroImgOk, true);

const mob = report['index-mobile'];
expect('mobile.vw', mob.checks.vw, 390);
expect('mobile.column', mob.checks.column, 'column');
expect('mobile.detailClosed', mob.checks.detailClosed, true);
expect('mobile.tapOpen.side', mob.tapOpen.side, 'right');
expect('mobile.tapOpen.latin', mob.tapOpen.latin, 'PUGUA');
expect('mobile.tapOpen.expanded', mob.tapOpen.expanded, 'true');
expect('mobile.tapOpen.height>250', mob.tapOpen.h > 250, true);
expect('mobile.tapOpen.infoFullWidth', mob.tapOpen.infoWidth > 340, true);

for (const [name, r] of Object.entries(report)) {
  if (!r || !r.checks) continue;
  const broken = r.checks.broken.broken;
  if (broken.length) failedAssertions.push(`${name} broken images: ${broken.join(', ')}`);
  if (r.checks.bootRemoved === false) failedAssertions.push(`${name} boot overlay still present`);
  const errs = r.console.filter((c) => c.type === 'error');
  if (errs.length) failedAssertions.push(`${name} console errors: ${JSON.stringify(errs)}`);
  if (r.exceptions.length) failedAssertions.push(`${name} exceptions: ${JSON.stringify(r.exceptions)}`);
  if (r.logs.length) failedAssertions.push(`${name} log errors: ${JSON.stringify(r.logs)}`);
  if (r.failed.length) failedAssertions.push(`${name} network failures: ${JSON.stringify(r.failed)}`);
}

writeFileSync(`${OUTDIR}/report.json`, JSON.stringify({ report, failedAssertions }, null, 2));
console.log(JSON.stringify(report, null, 2));
console.log('\n===== ASSERTIONS =====');
if (failedAssertions.length) {
  failedAssertions.forEach((f) => console.log('FAIL  ' + f));
  process.exitCode = 1;
} else {
  console.log('ALL PASS');
}
await send('Browser.close').catch(() => {});
