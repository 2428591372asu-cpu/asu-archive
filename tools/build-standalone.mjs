/* ==========================================================================
   build-standalone.mjs — 把整个站点打包成一个 HTML（双击即可看）
   用法： node tools/build-standalone.mjs [输出路径]
   做法： CSS / JS / 图片（base64）全部内联；index 与 character 两个页面
         合成同一个文档里的两个视图，用 hash 路由切换。
   ========================================================================== */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, resolve, extname, dirname } from 'node:path';

const HERE = import.meta.dirname;
const PROJECT = resolve(HERE, '..');
const OUT = process.argv[2]
  ? resolve(process.argv[2])
  : resolve(PROJECT, '..', 'A_SU_ARCHIVE_demo.html');

const read = (p) => readFileSync(p, 'utf8');

const indexHtml = read(join(PROJECT, 'index.html'));
const charHtml = read(join(PROJECT, 'character.html'));
const css = read(join(PROJECT, 'assets/css/style.css'));
const dataJs = read(join(PROJECT, 'assets/js/data.js'));
const siteJs = read(join(PROJECT, 'assets/js/site.js'));
const favicon = read(join(PROJECT, 'assets/favicon.svg'));

/* ---------- 图片转 base64 ---------- */
const imgDir = join(PROJECT, 'assets/img');
const imgFiles = readdirSync(imgDir).filter((f) => /\.(jpe?g|png|webp)$/i.test(f));
const mimeOf = (f) => (extname(f).toLowerCase() === '.png' ? 'image/png'
  : extname(f).toLowerCase() === '.webp' ? 'image/webp' : 'image/jpeg');
const imgMap = {};
let imgBytes = 0;
for (const f of imgFiles) {
  const buf = readFileSync(join(imgDir, f));
  imgBytes += buf.length;
  imgMap[f] = `data:${mimeOf(f)};base64,${buf.toString('base64')}`;
}

/* ---------- 拆页面：共用头尾，两个视图 ---------- */
const mainRe = /<main class="shell">([\s\S]*?)<\/main>/;
const footRe = /<footer class="foot wrap">[\s\S]*?<\/footer>/;

const homeMain = indexHtml.match(mainRe)[1].replace(footRe, '').trim();
const charMain = charHtml.match(mainRe)[1].replace(footRe, '').trim();
const footer = indexHtml.match(footRe)[0].replace(
  '<span>BUILD · ',
  '<span>SINGLE FILE · 单文件版</span>\n      <span>BUILD · '
);
/* 头部从 <header class="topbar"> 开始切（过场块已经被去掉，不能再拿它当锚点） */
const headStart = indexHtml.indexOf('<header class="topbar"');
const bootAndHeader = indexHtml
  .slice(headStart >= 0 ? headStart : indexHtml.indexOf('<body'),
         indexHtml.indexOf('<main class="shell">'))
  .trim();

const title = (indexHtml.match(/<title>([\s\S]*?)<\/title>/) || [, 'A_SU ARCHIVE'])[1];
const desc = (indexHtml.match(/<meta name="description" content="([^"]*)"/) || [, ''])[1];

/* ---------- 视图路由（不含反引号，方便内嵌） ---------- */
const ROUTER = `
(function () {
  var home = document.getElementById('view-home');
  var charV = document.getElementById('view-char');
  var HOME_TITLE = document.title;
  if (!home || !charV) return;

  function show(v) {
    var isChar = v === 'char';
    home.classList.toggle('is-on', !isChar);
    charV.classList.toggle('is-on', isChar);
    /* 回首页：强调色退回灰色；主题是用户选的，不动 */
    if (!isChar) {
      delete document.body.dataset.char;
      delete document.body.dataset.surface;
    }
  }
  function scrollFrag(frag) {
    var el = frag && document.getElementById(frag);
    if (el) el.scrollIntoView({ block: 'start' });
  }
  function openChar(id) {
    window.__CHAR_ID__ = id;
    show('char');
    window.ARCHIVE_APP.renderChar();
    if (window.ARCHIVE_APP.initReveal) window.ARCHIVE_APP.initReveal();
    window.scrollTo(0, 0);
  }
  function route() {
    var h = location.hash || '';
    var m = h.match(/^#\\/c\\/(.+)$/);
    if (m) { openChar(decodeURIComponent(m[1])); return; }
    var frag = h.replace(/^#\\/?/, '');
    if (!frag) { show('home'); document.title = HOME_TITLE; window.scrollTo(0, 0); return; }
    var el = document.getElementById(frag);
    show(el && charV.contains(el) ? 'char' : 'home');
    if (!(el && charV.contains(el))) document.title = HOME_TITLE;
    setTimeout(function () { scrollFrag(frag); }, 20);
  }
  window.__ARCHIVE_ROUTE__ = function (href) {
    var s = String(href);
    var c = s.match(/character\\.html\\?id=([^&]+)/);
    if (c) { location.hash = '#/c/' + c[1]; return; }
    var i = s.match(/index\\.html(?:#(.*))?$/);
    if (i) { location.hash = '#' + (i[1] || ''); return; }
    location.hash = '#/';
  };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (!/character\\.html|index\\.html/.test(href)) return;
    e.preventDefault();
    window.__ARCHIVE_ROUTE__(href);
  }, true);
  window.addEventListener('hashchange', route);
  route();
})();
`;

/* ---------- 组装 ---------- */
const html = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="theme-color" content="#0a0a0b">
<title>${title}</title>
<meta name="description" content="${desc}">
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}">
<style>
${css}
/* ---------- 单文件版：两个视图互斥显示 ---------- */
.view{ display:none; }
.view.is-on{ display:block; }
</style>
</head>
<body data-page="index" data-standalone="1">
${bootAndHeader}

<main class="shell">
<div class="view is-on" id="view-home">
${homeMain}
</div>

<div class="view" id="view-char">
${charMain}
</div>

${footer}
</main>

<noscript>
  <p style="padding:120px 24px;text-align:center;color:#a6a6ad">
    这个页面需要 JavaScript 才能从内嵌数据里渲染图集，请开启后刷新。
  </p>
</noscript>

<script>window.__IMG__ = ${JSON.stringify(imgMap)};</script>
<script>
${dataJs}
</script>
<script>
${siteJs}
</script>
<script>${ROUTER}</script>
</body>
</html>
`;

writeFileSync(OUT, html, 'utf8');

const kb = (n) => (n / 1024).toFixed(0) + ' KB';
console.log('单文件已生成：', OUT);
console.log('  图片 ' + imgFiles.length + ' 张 / 原始 ' + kb(imgBytes));
console.log('  输出总大小 ' + kb(Buffer.byteLength(html, 'utf8')));
