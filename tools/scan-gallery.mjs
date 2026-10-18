#!/usr/bin/env node
/* 扫描 assets/img/gallery/ 生成 assets/js/gallery-index.js
 *
 * 规则
 *   assets/img/gallery/<主文件夹>/          三个主文件夹：together / a-su / pugua
 *     直接放在里面的图片   → 一张一张出现在画廊里
 *     里面的一层子文件夹   → 一个「系列」，第一张（按文件名排序）当封面，点开看全部
 *   可选 _meta.json（放在文件夹里）：{ "文件名": { "title": "标题", "note": "说明", "cat": "分类" },
 *                                     "_title": "系列名", "_note": "系列说明" }
 *
 * 用法：node tools/scan-gallery.mjs
 *   edit.bat 启动时会自动跑一次。
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const GAL = path.join(ROOT, 'assets', 'img', 'gallery');
const OUT = path.join(ROOT, 'assets', 'js', 'gallery-index.js');
const EXTS = /\.(jpe?g|png|webp|gif|avif)$/i;

const nat = (a, b) => a.localeCompare(b, 'zh-CN', { numeric: true });
const isImg = (f) => EXTS.test(f);
const listImages = (dir) =>
  fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => isImg(f) && fs.statSync(path.join(dir, f)).isFile()).sort(nat) : [];
const subDirs = (dir) =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort(nat)
    : [];

function readMeta(dir) {
  const p = path.join(dir, '_meta.json');
  if (!fs.existsSync(p)) return {};
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^\uFEFF/, ''));
  } catch (e) {
    console.warn('  ! _meta.json 解析失败：' + p + ' → ' + e.message);
    return {};
  }
}

/* 文件名 → 标题：去掉 NN_ 前缀、扩展名，分隔符换空格 */
function deriveTitle(file) {
  return file
    .replace(/\.[^.]+$/, '')
    .replace(/^\d+[_-]/, '')
    .replace(/[_-]+/g, ' ')
    .trim();
}

if (!fs.existsSync(GAL)) {
  fs.mkdirSync(GAL, { recursive: true });
  console.log('已创建 ' + path.relative(ROOT, GAL));
}

const mains = subDirs(GAL);
const GALLERY = {};
const MAP = {};
let nImg = 0;
let nSeries = 0;

for (const main of mains) {
  const dir = path.join(GAL, main);
  const meta = readMeta(dir);
  const items = [];

  for (const f of listImages(dir)) {
    const rel = 'gallery/' + main + '/' + f;
    const m = meta[f] || {};
    items.push({
      type: 'image',
      file: rel,
      title: m.title || deriveTitle(f),
      note: m.note || '',
      cat: m.cat || ''
    });
    MAP[f] = rel;
    MAP[f.replace(/^\d+[_-]/, '')] = rel; /* 旧引用（无序号前缀）也能解析 */
    nImg++;
  }

  for (const sub of subDirs(dir)) {
    const sdir = path.join(dir, sub);
    const files = listImages(sdir);
    if (!files.length) continue;
    let smeta = readMeta(sdir);
    if (!Object.keys(smeta).length) {
      /* 子文件夹没写 _meta.json 时，继承上级目录按文件名登记过的标题 */
      smeta = {};
      for (const f of files) if (meta[f]) smeta[f] = meta[f];
    }
    items.push({
      type: 'series',
      dir: 'gallery/' + main + '/' + sub,
      cover: 'gallery/' + main + '/' + sub + '/' + files[0],
      files: files.map((f) => 'gallery/' + main + '/' + sub + '/' + f),
      title: smeta._title || sub,
      note: smeta._note || '',
      cat: smeta._cat || sub,
      count: files.length
    });
    for (const f of files) {
      const rel = 'gallery/' + main + '/' + sub + '/' + f;
      const m = smeta[f] || {};
      if (!MAP[f]) MAP[f] = rel;
      MAP[f.replace(/^\d+[_-]/, '')] = MAP[f.replace(/^\d+[_-]/, '')] || rel;
      if (m.title) MAP['__title__' + rel] = m.title;
    }
    nSeries++;
  }

  GALLERY[main] = items;
}

const body = `/* 由 tools/scan-gallery.mjs 生成，请勿手改。
 * 图片放在 assets/img/gallery/<主文件夹>/ ，子文件夹 = 一个系列。
 * 增删图片后运行：node tools/scan-gallery.mjs
 */
window.GALLERY = ${JSON.stringify(GALLERY, null, 2)};
window.GALLERY_MAP = ${JSON.stringify(MAP, null, 2)};
`;

fs.writeFileSync(OUT, body, 'utf8');

console.log('扫描完成：' + mains.length + ' 个主文件夹 / ' + nImg + ' 张单图 / ' + nSeries + ' 个系列');
for (const main of mains) {
  const dir = path.join(GAL, main);
  const meta = readMeta(dir);
  const have = new Set(listImages(dir));
  const gone = Object.keys(meta).filter((k) => k[0] !== '_' && !have.has(k));
  if (gone.length) console.log('  ! ' + main + '/_meta.json 元数据里有、磁盘上没有：' + gone.join(', '));
}
for (const m of mains) console.log('  ' + m + ': ' + GALLERY[m].length + ' 项');
console.log('清单已写入 ' + path.relative(ROOT, OUT));
