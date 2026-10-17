/* ==========================================================================
   cms.mjs — 文案可视化编辑器的最小后端（零依赖，只用 Node 标准库）
   --------------------------------------------------------------------------
   做的事：
     1. 把整个站点当静态目录伺服（预览用）
     2. 提供编辑页 /__editor
     3. POST /__save    ← 编辑器把整份内容发回来，这里序列化后写回 data.js
     4. POST /__restore ← 还原上一次的 data.js
   只监听 127.0.0.1，不联网。
   ========================================================================== */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATA = path.join(ROOT, 'assets', 'js', 'data.js');
const BACKUP = path.join(ROOT, 'tools', '.data-backup.js');
const PORT = Number(process.env.CMS_PORT) || 8778;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon'
};

const HEADER = `/* ==========================================================================
   data.js — 全站内容都在这一个文件里
   想加图 / 改名字 / 加第三个角色，只改这里，不用动 HTML。
   --------------------------------------------------------------------------
   images[].file    ← assets/img/ 下的文件名（不要带路径）
   images[].cat     ← 分类，取值见下方 CATEGORIES
   images[].title   ← 画廊里显示的名字
   images[].note    ← 小字说明（可省略）
   fields[].v = null 时，页面会显示「待补充」虚线下划线
   emptySlots       ← 还没有图的分类，会在画廊里留一个虚线空位
   --------------------------------------------------------------------------
   本文件由 tools/editor.html 生成过，格式会自动规整，注释只保留这一段。
   ========================================================================== */

`;

/* ---------------- 序列化：把对象写回 data.js 源码 ---------------- */

const q = (s) => "'" + String(s)
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, '\\n') + "'";

const KEY = /^[A-Za-z_$][\w$]*$/;

function lit(v, ind = 0) {
  const pad = '  '.repeat(ind);
  const padIn = '  '.repeat(ind + 1);

  if (v === null || v === undefined) return 'null';
  if (typeof v === 'string') return q(v);
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const flat = v.every((x) => x === null || typeof x !== 'object');
    if (flat) {
      const one = '[' + v.map((x) => lit(x)).join(', ') + ']';
      if (one.length <= 76) return one;
    }
    return '[\n' + v.map((x) => padIn + lit(x, ind + 1)).join(',\n') + '\n' + pad + ']';
  }
  if (typeof v === 'object') {
    const keys = Object.keys(v);
    if (!keys.length) return '{}';
    return '{\n' +
      keys.map((k) => padIn + (KEY.test(k) ? k : q(k)) + ': ' + lit(v[k], ind + 1)).join(',\n') +
      '\n' + pad + '}';
  }
  return 'null';
}

function serialize(a) {
  // 顶层字段一律保留：新加字段（about / labels / 以后的任何字段）都不会在保存时丢
  const plain = ['site', 'hero', 'about', 'labels'];
  const extra = Object.keys(a).filter(
    (k) => !plain.includes(k) && !['categories', 'characters', 'together'].includes(k)
  );

  const body = [
    'window.ARCHIVE = (function () {',
    "  'use strict';",
    '',
    '  const CATEGORIES = ' + lit(a.categories || [], 1) + ';',
    '',
    '  const characters = ' + lit(a.characters || [], 1) + ';',
    '',
    '  const together = ' + lit(a.together || [], 1) + ';',
    '',
    '  return {'
  ];

  plain.concat(extra).forEach((k) => {
    if (a[k] !== undefined) body.push('    ' + k + ': ' + lit(a[k], 2) + ',');
  });

  body.push(
    '    categories: CATEGORIES,',
    '    characters: characters,',
    '    together: together',
    '  };',
    '})();'
  );

  return HEADER + body.join('\n') + '\n';
}

/* ---------------- HTTP ---------------- */

function send(res, code, body, type) {
  res.writeHead(code, {
    'Content-Type': type || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store'
  });
  res.end(body);
}

function readBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new Error('请求体太大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function serveStatic(res, urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0]);
  const full = path.join(ROOT, clean);
  /* 防目录穿越 */
  if (!full.startsWith(ROOT)) { send(res, 403, 'forbidden'); return; }
  fs.readFile(full, (err, buf) => {
    if (err) { send(res, 404, 'not found'); return; }
    const type = MIME[path.extname(full).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buf);
  });
}

const handler = async (req, res) => {
  const url = req.url || '/';

  if (url === '/__editor' || url === '/__editor/') {
    fs.readFile(path.join(ROOT, 'tools', 'editor.html'), (err, buf) => {
      if (err) { send(res, 500, '找不到 tools/editor.html'); return; }
      res.writeHead(200, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      res.end(buf);
    });
    return;
  }

  if (url === '/__save' && req.method === 'POST') {
    try {
      const raw = await readBody(req);
      const payload = JSON.parse(raw);
      const a = payload && payload.archive;
      if (!a || !a.site || !a.hero || !Array.isArray(a.characters) || !Array.isArray(a.together)) {
        send(res, 400, '内容结构不对'); return;
      }
      const src = serialize(a);
      /* 先备份，再写 */
      if (fs.existsSync(DATA)) fs.copyFileSync(DATA, BACKUP);
      fs.writeFileSync(DATA, src, 'utf8');
      console.log('[保存] data.js 已更新，' + src.length + ' 字节');
      send(res, 200, JSON.stringify({ ok: true, bytes: src.length }), MIME['.json']);
    } catch (e) {
      console.error('[保存失败]', e.message);
      send(res, 500, '保存失败：' + e.message);
    }
    return;
  }

  if (url === '/__restore' && req.method === 'POST') {
    if (!fs.existsSync(BACKUP)) { send(res, 404, '没有备份可还原'); return; }
    fs.copyFileSync(BACKUP, DATA);
    console.log('[还原] data.js 已回滚');
    send(res, 200, JSON.stringify({ ok: true }), MIME['.json']);
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    serveStatic(res, url);
    return;
  }

  send(res, 405, 'method not allowed');
};

/* --------------------------------------------------------------------------
   启动：端口被占就自动换一个；如果占着的是我们自己，直接复用并打开浏览器。
   这样反复双击 edit.bat 不会因为 EADDRINUSE 一闪而过。
   -------------------------------------------------------------------------- */
const BASE_PORT = PORT;
const MAX_TRY = 8;

async function isOurs(port) {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 800);
    const r = await fetch('http://127.0.0.1:' + port + '/__editor', { signal: ac.signal });
    clearTimeout(timer);
    if (!r.ok) return false;
    const t = await r.text();
    return t.includes('/__save');
  } catch (e) {
    return false;
  }
}

function openBrowser(url) {
  console.log('文案编辑器：' + url);
  console.log('预览站点：' + url.replace('/__editor', '/index.html'));
  console.log('（关掉这个窗口即停止）');
  if (process.platform === 'win32') {
    exec('start "" "' + url + '"');
  }
}

async function boot(port, tries) {
  if (await isOurs(port)) {
    console.log('检测到已经在运行了，直接打开浏览器。');
    openBrowser('http://127.0.0.1:' + port + '/__editor');
    return;
  }
  const s = http.createServer(handler);
  s.once('error', (e) => {
    if (e.code === 'EADDRINUSE' && tries > 0) {
      console.log('端口 ' + port + ' 被别的程序占用，换 ' + (port + 1) + ' 再试…');
      boot(port + 1, tries - 1);
    } else {
      console.error('启动失败：' + e.message);
      console.error('换个端口试试：set CMS_PORT=8790 && node tools\\cms.mjs');
      process.exitCode = 1;
    }
  });
  s.listen(port, '127.0.0.1', () => {
    openBrowser('http://127.0.0.1:' + port + '/__editor');
  });
}

boot(BASE_PORT, MAX_TRY);
