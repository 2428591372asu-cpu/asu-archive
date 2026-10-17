# A_SU ARCHIVE · 双人设定档案（本地演示）

一个纯静态的角色档案站：首页放两位角色，点进去是各自的档案表、三视图和整本图集。
版式参考明日方舟官网的深色 / 细线 / 切角风格。

- 角色：**A_su**（FILE-001）、**蒲瓜**（FILE-002）
- 图片：来自 `D:\Asu\A_su的设定图集`，站内用的是缩小压缩版，**原图未做任何修改**
- 技术：HTML + CSS + 原生 JS，**零依赖、无需构建**

---

## 一、怎么打开

三种都行，选一个：

| 方式 | 操作 | 说明 |
| --- | --- | --- |
| 直接双击 | 打开 `index.html` | 最简单，已验证 `file://` 下功能正常 |
| 本地服务器 | 双击 `serve.bat` | 需要装过 Python；会自动打开 `http://127.0.0.1:8777` |
| 命令行 | `python -m http.server 8777` | 在项目目录里执行，然后访问上面的地址 |

> 建议用本地服务器：图片走 HTTP 更接近真实上线时的表现。直接双击也不会缺图，
> 因为数据写在 `data.js` 里，没有用到 `fetch`。

### 打包好的成品（在上一级目录 `D:\Asu\works\DSHwork\`）

| 文件 | 说明 |
| --- | --- |
| `A_SU_ARCHIVE_demo.html` | **单文件版**，约 5.3 MB。CSS / JS / 15 张图全部内联，双击即看，可以单独发给别人；两个页面用 `#/c/<id>` 的 hash 路由切换 |
| `A_SU_ARCHIVE_demo.zip` | **目录版**压缩包，解压后双击 `index.html`（或 `serve.bat`） |

重新生成单文件版（改了源码之后重跑一次）：

```powershell
node tools/build-standalone.mjs
```

它会读 `index.html`、`character.html`、`style.css`、`data.js`、`site.js` 和 `assets/img/*`，
把两个页面合成一个文档、图片转 base64。验证单文件版：

```powershell
node tools/verify-demo.mjs "file:///D:/Asu/works/DSHwork/A_SU_ARCHIVE_demo.html" shots
```

---

## 二、目录结构

```
asu-archive/
├─ index.html            首页（hero + 唯一索引 + 双人 + 关于）
├─ character.html        角色详情页（?id=a-su 或 ?id=pugua）
├─ serve.bat             双击起本地服务器
├─ assets/
│  ├─ css/style.css      全部样式（设计变量集中在文件顶部 :root）
│  ├─ js/data.js         ← 所有内容都在这里（角色、图片、文案）
│  ├─ js/site.js         渲染 + 灯箱 + 动效
│  ├─ favicon.svg
│  └─ img/               站内图片（压缩版）+ manifest.json
├─ tools/
│  ├─ make-assets.ps1    从原始图集生成站内图片
│  ├─ verify.mjs         CDP 真实浏览器验证（截图 + 断言）
│  └─ shot.mjs           截单页/单区块的图
├─ shots/                验证截图（可删）
└─ shots-verify.log      最近一次验证日志
```

---

## 三、怎么加图

**1. 放文件**：把图片丢进 `assets/img/`，文件名用英文（避免 URL 里的中文转义）。

**2. 改数据**：打开 `assets/js/data.js`，在对应角色的 `images` 数组里加一行：

```js
{ file: 'a-su-new.jpg', cat: '插画', title: '新图标题', note: '可选的小字说明' },
```

`cat` 只能取这五个之一：`三视图` / `头像` / `插画` / `合作` / `其它`。
分类筛选按钮和数量会自动跟着变。

**3. 空位**：还没图的分类，写在 `emptySlots` 里，画廊里就会显示一个虚线空位：

```js
emptySlots: [{ cat: '立绘', note: 'STANDING ART' }]
```

补到图之后，把这张空位删掉、并在 `images` 里加对应条目即可。

### 如果要新增一张原图（大图）

`tools/make-assets.ps1` 里有一张转换表（源文件 → 站内文件名 + 最大边 + 压缩质量）。
加一行再执行：

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\make-assets.ps1
```

它只读原始图集、只往 `assets/img/` 写压缩版，不会改动原图。

---

## 四、怎么加第三个角色

1. 复制 `data.js` 里 `characters` 数组中的一个对象，改 `id`、`index`、`name`、`latin`、`code`、
   `tags`、`card`、`lead`、`fields`、`images`。
2. `id` 是详情页的地址参数：`character.html?id=你的id`。
3. 首页卡片、hero 里的快捷入口、交叉链接、统计数字都会自动出现，不用改 HTML。

---

## 五、常见改动位置

| 想改什么 | 改哪里 |
| --- | --- |
| 站名 / 版本号 / 首页大标题 / 首页主图 | `assets/js/data.js` 的 `site`、`hero` |
| 首页「关于」正文 | `index.html` 的 `.about__text` |
| 颜色、字号、间距 | `assets/css/style.css` 顶部的 `:root` 变量 |
| 卡片裁图位置 | `data.js` 里角色的 `card.pos`（就是 CSS `object-position`） |
| 详情页右侧展示位 | `data.js` 里角色的 `head`（裁切头像 + 线稿）或 `portrait`（透明底立绘）：填 `{ image: 'xxx.png', line: 'xxx-line.png', tag: '…' }`，没有就写 `null` → 显示空位 |

---

## 六、设计说明

- **色板**：底色 `#0a0a0b`，细线 `rgba(255,255,255,.16)`，强调色 `#ffd400`。
  强调色只用在编号、切角、悬停扫线这些小块上，不铺大面积。
- **字体**：拉丁字母 `Bahnschrift SemiCondensed`（DIN 风格），中文 `Noto Sans SC`，
  数字和标签 `Cascadia Mono`。全部是系统字体，不联网加载。
- **方舟味的关键三样**：右下 45° 切角（`.cut` / 卡片 clip-path）、四角刻度框（`.corners`）、
  等宽大写小标签配超大英文标题。
- **动效**：开机过场 0.7 秒（点击可跳过）、滚动进场、鼠标视差、灯箱淡入；
  `prefers-reduced-motion` 下全部关闭。

### 白天 / 夜晚两套主题（右上角开关）

- 顶栏右上角有唯一的主题开关 `#themeToggle`：`DAY ○ / ● NIGHT`，白天浅底、夜晚主题黑 + 亮灰分隔。
- 选择存在 `localStorage` 的 `asu-archive-theme`（`day` / `night`），跨页面保持；
  也可以 `?theme=night` 强制。
- 强调色是**独立一层**：`body[data-char]` 决定，没选角色时是灰 `#8d97a3`，
  选了阿苏变蓝 `#2f80bd`、蒲瓜变黄绿 `#8ba31f`（夜晚各有更亮的一套）。
  首页点开索引条目就会整页染色，切换时由 `body.is-theming` 开一段 0.5s 的颜色过渡。
- 主题底色只跟着主题走；详情页额外带一点角色底色偏移，靠 `body[data-surface="char"]`。
- 首页主视觉是**轮换海报**：`hero.slides` 里放图，默认 20 秒一张（`slideInterval`），鼠标在页面上时暂停；鼠标靠近右下角会出现「‹ ›」和指示条，可以直接手动翻。
- 字体的偏移描边：`.t-off` 只留**一层**描边（`color-mix(accent 44%, ink-3)` 去饱和），
  原来的那层浅色「阴影」已经删掉；首页 `ARCHIVE` 那行从空心描边改成实色，
  因为细笔画描边会糊成实心（就是之前那个穿模）。
- 立绘残影：回到第一版的**左上**方向，错开 5.6% / 4.4%，透明度 0.24（更淡），本体不再反向位移。
- **主题切换不割裂**：渐变属性无法补间，所以首页压暗层改成两张（昼/夜）叠着做透明度交叉淡入；插画渐隐改用 CSS mask（与颜色无关）；背景网格线改成中性灰；面板底色统一成 `var(--bg)` 走颜色过渡；`filter` 也加进了过渡列表。
- 索引条目的悬停放大只作用在数字和名字上（整块缩放会把边框和强调线挤出边界=穿模）。

### 头像裁切 + 黑白线稿残影（阿苏的详情页）

1. `tools/make-assets.ps1` 里 `a-su-head.png` 那条带 `crop`，从「立绘透明底」原图
   （3124×3960）按像素坐标裁出肩以上：`x 860 / y 300 / 1280×1260`。
2. `tools/make-line-art.mjs` 对裁出的头像做 Sobel 边缘检测，输出 `a-su-head-line.png`
   —— 就是那张黑白线稿（借浏览器 canvas 算，再用 CDP 把 PNG 拿回来存盘）。
3. 页面里两张图叠起来：线稿在底层往左上错开 5.6% / 4.4%、透明度 0.24。

```powershell
node tools/make-line-art.mjs assets\img\a-su-head.png assets\img\a-su-head-line.png 24 "18,30,46"
```

换角色或重裁时：改 `crop` → 重跑资源脚本 → 重跑线稿脚本 → `data.js` 里 `head` 指向两张图。
`head.line` 不填也能用，只是残影会退回原图本身。


### 首页索引的交互（全站只有这一处索引）
- **电脑**：鼠标停上去 → 条目轻微放大（`scale(1.015)`，从外侧边缘为原点）；
  点一下 → 下面展开该角色的详情；再点一下同一个条目 → 进入档案页。
- **手机**：没有悬停，点一下展开、再点一下进档案，逻辑一致。
- 展开面板按角色所在侧展开：左条目（A_su）插画在左、文字在右，插画从左边缘放大进来；
  右条目（蒲瓜）镜像，插画从右边缘放大进来。
- 展开时高度用 JS 量出 `scrollHeight` 后做过渡，动画结束再切回 `auto`，所以窗口缩放不会留白。
- 也可以直接点展开面板里的「进入档案」按钮，或者在展开状态下按 `ESC` 收起。
- 实现全部在 `assets/js/site.js` 的 `Duo` 模块里，样式在 `style.css` 的 `.duo*` 段。

---

## 七、验证

```powershell
# 先起浏览器（带 CDP）
& "$env:ProgramFiles (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new `
  --remote-debugging-port=9222 --user-data-dir=".browserprof" about:blank

node tools/verify.mjs http://127.0.0.1:8777 shots
```

它会打开首页、两个详情页、`file://` 直开模式，以及 390×844 的手机视口，检查元素数量、
图片是否加载、灯箱与分类筛选、**索引的两段式点击（先展开、再跳转）**、手机端点击展开，
还有控制台报错与网络失败，然后截图到 `shots/`，最后打印 `ALL PASS` 或失败项。

当前状态：**ALL PASS，控制台 0 报错**。

---

## 八、内容说明

- 这是**本地演示**，非官方同人档案，未用于任何商业用途。
- 图片版权属于原作者；站内图片为适应网页做的压缩版本。
- 档案表里的「备注 / 补充」等拿不到信息的字段显示为「待补充」，没有编造设定；
  「外观 / 服饰」两栏是对画面本身的客观描述。

---

## 九、部署到 GitHub Pages + 自定义域名 asu.pugua.net

站点是纯静态的，**不需要构建**。仓库根目录就是站点根目录：

``````
index.html
character.html
404.html
.nojekyll          ← 让 Pages 跳过 Jekyll
CNAME              ← 内容是一行：asu.pugua.net
assets/            ← css / js / img
tools/  README.md  ← 只给自己看，不影响访问
``````

### 1. 推到 GitHub（需要你的账号）

仓库已经 `git init -b main` 好了，只差提交和推送：

```powershell
cd D:\Asu\works\DSHwork\asu-archive
git config user.name  "你的名字"
git config user.email "你的邮箱"
git add -A
git commit -m "asu-archive: static site with custom domain"
git remote add origin https://github.com/2428591372asu-cpu/asu-archive.git
git push -u origin main
```

### 2. 打开 Pages

仓库 Settings → Pages → Source 选 `Deploy from a branch` → 分支 `main` + 目录 `/ (root)` → Save。
Custom domain 一栏会自动读到仓库里的 `CNAME`（asu.pugua.net），保存后等 DNS 检查通过，
再勾上 **Enforce HTTPS**。

### 3. DNS 解析（在 pugua.net 的域名服务商那边加）

| 类型 | 主机记录 | 记录值 |
| --- | --- | --- |
| CNAME | `asu` | `2428591372asu-cpu.github.io` |

加完等生效（通常几分钟到几小时）。验证：

```powershell
Resolve-DnsName asu.pugua.net -Type CNAME
```

拿到 `2428591372asu-cpu.github.io` 之后，访问 `https://asu.pugua.net` 即可。
如果域名在 Cloudflare 这类带代理的服务商，先关掉那条记录的代理（灰云），等 Pages 证书签发完再开。

### 4. 注意点

- 所有路径都是相对路径，放在 `/<仓库名>/` 子路径下也能跑。
- 图片是**逐步加载**的：画廊图带 `loading="lazy"`，首屏只拉首图；轮换的第二张要等第一次轮换才请求。
- 浏览量用 **Moe-counter**：页脚是一张 `https://count.getloli.com/get/@asu-archive?theme=moebooru`
  的 SVG 计数图。配置在 `assets/js/data.js` 的 `site.counter`：`name` 是计数键（要唯一），
  `theme` 可选 `moebooru` / `gelbooru` / `rule34` 等；取不到图时自动退回本地计数。
- 仓库约 18 MB（图片 JPEG q92，没额外压缩），Pages 的软限制是 1 GB，够用。
## 十、这一版改了什么（v0.5）

- 首页标题 A_SU&PUGUA，字号收到 94px；统计条 02 / 50 / 08 / 00。
- 主题切换不再割裂：昼/夜压暗层叠图交叉淡入、插画渐隐改 mask、网格线中性灰、面板底色走 ar(--bg)。
- 立绘残影：往右上 9% / -7.5%，放大 1.06，透明度 0.17。
- 蒲瓜头像重新裁切：把自拍杆和手机一起收进画面，头部占比缩小（裁切框 x380 y70 4020×4140）。
- 竖排「阿苏 / 蒲瓜」原来是空心描边，汉字笔画密会糊成实心（穿模），改低透明实色。
- 「选择角色」展开更从容（0.78s），内容整块淡入；切换角色时同样重播一次。
- 载入过场改成灰底、更大的标记与进度条；点「进入档案」时先铺一层灰底 LOADING 再跳转。
- 页脚是 Moe-counter 的萌系浏览计数器（取不到图时退回本地计数）。
