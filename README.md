# A_SU ARCHIVE

两个人的设定档案站。纯静态，没有任何构建步骤和运行时依赖——双击 `index.html` 就能看。

线上：<https://2428591372asu-cpu.github.io/asu-archive/> ｜ 域名：`asu.pugua.net`

---

## 目录

```
index.html            首页（主视觉轮播 / 双人名录 / 图集 / 关于）
character.html        角色详情页（?id=a-su 或 ?id=pugua）
404.html              404
CNAME / .nojekyll     GitHub Pages 配置

assets/
  css/
    style.css         全站基础样式：设计 token、版式、三种主题的公共部分
    themes/scifi.css  星域主题（深空档案感）的专属样式
  js/
    data.js           全站内容都在这里，改文字只改这个文件
    site.js           渲染与交互：主题、轮播、图集、详情页
    gallery-index.js  图库清单，由脚本生成，不要手改
    plus-field.js     背景「+ / ·」点阵（字符栅格化的底纹）
    themes/
      atmosphere.js   星域氛围层：星空、星座、鼠标/触摸星座轨迹
  img/
    a-su-head.png 等   页面用的头像与线稿裁切
    gallery/          图集，按主文件夹分，一层子文件夹 = 一个系列

tools/
  cms.mjs             可视化编辑器后端（edit.bat 启动）
  editor.html         编辑器界面
  scan-gallery.mjs    扫描图集、生成 gallery-index.js
  verify.mjs          无头浏览器全量校验（页面、主题、图集、特效）
  shot.mjs            截图工具
  legacy/             早期一次性脚本，不参与当前流程

serve.bat             本地静态服务器
rescan.bat            重新扫描图集
edit.bat              启动编辑器（会先自动扫描图集）
```

## 加图

1. 把图片放进 `assets/img/gallery/<together|a-su|pugua>/`
   - 直接放在主文件夹：单图，逐张显示
   - 放进子文件夹：子文件夹算「一个系列」，按文件名排序，第一张当封面
2. 需要自定义标题/说明，在同级放 `_meta.json`：

```json
{
  "_title": "系列名",
  "_note": "系列说明",
  "01_xxx.png": { "title": "图片标题", "note": "说明", "cat": "分类" }
}
```

3. 双击 `rescan.bat`（或 `node tools/scan-gallery.mjs`）重新生成清单。

## 主题

三种主题，右上角切换，状态存 `localStorage`：

| 主题 | 说明 |
| --- | --- |
| `day` | 白天，默认 |
| `night` | 夜晚 |
| `scifi` | 星域，深空蓝黑 + 冷青，带星空与星座轨迹 |

`?theme=scifi` 可以直接打开星域主题。

## 背景点阵

`assets/js/plus-field.js` 把一段文字栅格化成底纹：

- 字形内画 `+`，字形外画 `·`，同一张网格、同行同列
- 文字随场景切换：首页双人图 → `ARCHIVE`，角色立绘与详情页 → `A_SU` / `PUGUA`
- 滚动跨过约 0.62 屏时，整片一次性放大并居中；退回 0.46 屏以内缩回
- 纵向扫描带每 9 秒自上而下一次；跨边界时放一记涟漪；鼠标/手指划过会把点阵推开
- 文字与强度在 `data.js` 的 `labels.plusText` 与脚本里的 `palette()` 调

永远位于最底层（`z-index: 0`），被内容挡住就挡住。

## 校验

```bash
python -m http.server 8777 --bind 127.0.0.1
node tools/verify.mjs http://127.0.0.1:8777 shots
```

`verify.mjs` 会用无头浏览器检查：两种页面、三种主题、图集数量与标题、图片可加载、
主题切换、背景点阵与氛围层是否存在。输出 `ALL PASS` 才算通过。

## 约定

- 内容是数据，不是页面：改文字/配置只动 `assets/js/data.js`
- `assets/js/gallery-index.js` 由脚本生成，手改会被下次扫描覆盖
- 提交信息写大白话，不加 `feat:` 之类前缀
