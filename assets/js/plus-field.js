/* ==========================================================================
   A_SU ARCHIVE — 「+ / ·」点阵背景层（PLUS FIELD v4）
   --------------------------------------------------------------------------
   莱茵生命式的技术档案底纹：
   同一张网格里，字形内的格子画「+」，字形外的格子画「·」，整片等距、同行同列。
   涟漪从字形中心荡开：波峰经过时「+」先胀大，并把周围的「·」往外推挤，
   形成真正的水波位移，而不只是明暗变化。

   缩放规则（v4）：滚动跨过一条边界时，整片字形「一次性」放大并居中；
   滚回边界以内则缩回原位。带迟滞区间，边界附近不会抖。
   - 整个层 position:fixed 且永远在最底层
   - 换字时交叉淡入，并把整片符号轻微打乱重排
   - prefers-reduced-motion：不跑涟漪，只留静态画面
   ========================================================================== */
(function () {
  'use strict';

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var CELL = 20; /* 栅格间距：越大气氛越稀疏 */
  var FPS = 30;

  /* 放大后的额外倍率与目标锚点 */
  var ZOOM_MAX = 0.34; /* 放大 34% */
  var ZOOM_CENTER = 0.5; /* 放大后水平居中 */

  /* 每种文字的摆放：archive 居中，角色名偏左 */
  var LAYOUT = {
    archive: { ax: 0.5, ay: 0.5, size: 0.66 },
    name: { ax: 0.35, ay: 0.5, size: 0.55 }
  };

  var canvas = document.createElement('canvas');
  canvas.className = 'plus-field';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d', { alpha: true });

  var maskCanvas = document.createElement('canvas');
  var maskCtx = maskCanvas.getContext('2d', { willReadFrequently: true });

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0, H = 0;

  var cells = []; /* 当前整片网格 */
  var prevCells = null; /* 上一个字，用于交叉淡入 */
  var morphT = 1;
  var text = '';
  var baseAx = 0.5; /* 当前字形的基础锚点 */
  var baseAy = 0.5;
  var cols = 0, rows = 0, offX = 0, offY = 0;

  var raf = 0, last = 0, acc = 0;
  var burstAt = -1e9; /* 跨边界的瞬间放一记涟漪（换字不放） */
  var lastWaveAmp = 0;

  /* 鼠标「水拨」：指针附近把点阵轻轻排开 */
  var CURSOR_R = 128;
  var CURSOR_PUSH = 9;
  var ptr = { x: -9999, y: -9999, tx: -9999, ty: -9999, active: false };

  var zoom = 0; /* 0 = 原位，1 = 放大居中 */
  var zoomTarget = 0;
  var enlarged = false;

  /* ------------------------------------------------------------ 1. 取文字 */
  function resolveText() {
    var L = (window.ARCHIVE && window.ARCHIVE.labels) || {};
    var cfg = L.plusText;
    var want = window.__PLUS_TEXT__;
    if (cfg && typeof cfg === 'object') {
      if (want && cfg[want]) return String(cfg[want]);
      return String(cfg.archive || 'ARCHIVE');
    }
    if (typeof cfg === 'string' && cfg) return cfg;
    return want ? String(want) : 'ARCHIVE';
  }

  /* ------------------------------------------------------------ 2. 配色 */
  function palette() {
    var t = (document.body && document.body.dataset.theme) || 'day';
    if (t === 'night') return { rgb: '206,226,246', base: 0.13, hot: 0.18, dot: 0.115 };
    if (t === 'scifi') return { rgb: '120,214,248', base: 0.15, hot: 0.2, dot: 0.13 };
    /* 天堂：象牙纸面上的暖金细点，比星域更沉一点 */
    if (t === 'heaven') return { rgb: '146,112,48', base: 0.13, hot: 0.175, dot: 0.115 };
    return { rgb: '18,30,44', base: 0.14, hot: 0.185, dot: 0.12 }; /* day */
  }

  /* 传进来可能是 key（'a-su'）也可能是最终文字，统一解析一次 */
  function textForKey(v) {
    var s = String(v == null ? '' : v);
    var cfg = ((window.ARCHIVE && window.ARCHIVE.labels) || {}).plusText;
    if (cfg && typeof cfg === 'object' && cfg[s]) return String(cfg[s]);
    return s;
  }

  function pickLayout(t) {
    return String(t).toLowerCase() === 'archive' ? LAYOUT.archive : LAYOUT.name;
  }

  /* --------------------------------------------------- 3. 栅格化文字成网格 */
  function buildCells(source) {
    maskCanvas.width = Math.max(1, Math.round(W));
    maskCanvas.height = Math.max(1, Math.round(H));
    maskCtx.setTransform(1, 0, 0, 1, 0, 0);
    maskCtx.clearRect(0, 0, W, H);

    var lines = String(source || '').split('|').slice(0, 2);
    var flat = lines.join(' ');
    var L = pickLayout(source);

    var size = Math.min((W * L.size) / Math.max(2.2, flat.length * 0.62), H * 0.4);
    if (size < 22) size = 22;

    maskCtx.font =
      '700 ' + Math.round(size) + 'px "Bahnschrift SemiCondensed", "Segoe UI", system-ui, sans-serif';
    maskCtx.textAlign = 'center';
    maskCtx.textBaseline = 'middle';
    maskCtx.fillStyle = '#fff';

    var lineH = size * 1.04;
    var baseY = H * L.ay - ((lines.length - 1) * lineH) / 2;
    for (var i = 0; i < lines.length; i++) {
      maskCtx.save();
      if (maskCtx.letterSpacing !== undefined) {
        maskCtx.letterSpacing = Math.round(size * 0.05) + 'px';
      }
      maskCtx.fillText(lines[i], W * L.ax, baseY + i * lineH);
      maskCtx.restore();
    }

    var img = null;
    try {
      img = maskCtx.getImageData(0, 0, W, H).data;
    } catch (e) {
      img = null;
    }

    baseAx = L.ax;
    baseAy = L.ay;
    var gcx = W * baseAx;
    var gcy = H * baseAy;

    var out = [];
    for (var r = 0; r < rows; r++) {
      for (var c = 0; c < cols; c++) {
        var x = offX + c * CELL;
        var y = offY + r * CELL;

        /* 整格 4x4 采样，算子形覆盖率 */
        var sum = 0, hits = 0, maxA = 0;
        if (img) {
          for (var sy = 0; sy < 5; sy++) {
            for (var sx = 0; sx < 5; sx++) {
              var px = Math.round(x + (sx - 2) * CELL * 0.22);
              var py = Math.round(y + (sy - 2) * CELL * 0.22);
              if (px >= 0 && py >= 0 && px < W && py < H) {
                var av = img[(py * W + px) * 4 + 3] / 255;
                sum += av;
                if (av > maxA) maxA = av;
                hits++;
              }
            }
          }
        }
        var v = hits ? sum / hits : 0;

        /* 符号决定：
           平均覆盖率高 → 实心，必为 +；
           格子只是被斜笔画蹭到（平均低但峰值高）也算 + —— 否则 A 的斜线会整个消失；
           其余边缘随机，让轮廓有一点点毛边。 */
        var isPlus;
        if (v >= 0.3 || maxA >= 0.55) isPlus = true;
        else if (v > 0.05) isPlus = Math.random() < 0.25 + v * 1.6;
        else isPlus = false;

        var dx = x - gcx;
        var dy = y - gcy;
        var dist = Math.sqrt(dx * dx + dy * dy) || 1;

        out.push({
          rx: dx, /* 相对字形锚点，放大时绕它缩放 */
          ry: dy,
          v: v,
          plus: isPlus,
          ux: dx / dist, /* 从中心指向外的单位向量：涟漪沿它推 */
          uy: dy / dist,
          dist: dist,
          /* 轻微打乱：每次换字重新掷一次 */
          jx: (Math.random() - 0.5) * CELL * 0.06,
          jy: (Math.random() - 0.5) * CELL * 0.06,
          ph: Math.random() * Math.PI * 2,
          wt: 0.92 + Math.random() * 0.16
        });
      }
    }
    return out;
  }

  function setText(t) {
    t = String(t || '');
    if (!t || t === text) return;
    var next = buildCells(t);
    if (cells.length) prevCells = cells;
    cells = next;
    text = t;
    morphT = 0;
  }

  function rebuild() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols = Math.floor(W / CELL);
    rows = Math.floor(H / CELL);
    offX = (W - cols * CELL) / 2 + CELL / 2;
    offY = (H - rows * CELL) / 2 + CELL / 2;

    var t = text || resolveText();
    text = '';
    cells = [];
    prevCells = null;
    morphT = 1;
    setText(t);
  }

  /* ------------------------------------------------------- 4. 边界与缩放 */
  function readBoundary() {
    var y = window.scrollY || window.pageYOffset || 0;
    var h = window.innerHeight || H;
    var enter = h * 0.62; /* 划过这里 → 放大 */
    var exit = h * 0.46; /* 退回这里以内 → 缩回 */
    if (!enlarged && y > enter) {
      enlarged = true;
      zoomTarget = 1;
      burstAt = performance.now(); /* 放大瞬间给一记涟漪 */
    } else if (enlarged && y < exit) {
      enlarged = false;
      zoomTarget = 0;
      burstAt = performance.now();
    }
  }

  /* ------------------------------------------------------------- 5. 绘制 */
  function draw(ts) {
    raf = window.requestAnimationFrame(draw);

    var dt = ts - last;
    last = ts;
    if (dt > 200) dt = 16;
    acc += dt;
    if (acc < 1000 / FPS) return;
    acc = 0;

    if (morphT < 1) morphT = Math.min(1, morphT + dt / 640);

    /* 快切：约 200ms 到位，读起来是「一次性」，但不会生硬闪断 */
    zoom += (zoomTarget - zoom) * Math.min(1, dt / 60);
    if (Math.abs(zoomTarget - zoom) < 0.002) zoom = zoomTarget;

    /* 指针跟随：留一点延迟，水感更自然 */
    if (ptr.active) {
      ptr.x += (ptr.tx - ptr.x) * Math.min(1, dt / 55);
      ptr.y += (ptr.ty - ptr.y) * Math.min(1, dt / 55);
    }

    var pal = palette();
    ctx.clearRect(0, 0, W, H);

    /* 锚点与整体倍率：放大时往中间收并整体放大 */
    var sc = 1 + zoom * ZOOM_MAX;
    var ax = baseAx + (ZOOM_CENTER - baseAx) * zoom;
    var gx = W * ax;
    var gy = H * baseAy;

    /* 从上到下的扫描带：一条亮带缓慢落下，带内透明度先升后降 */
    var scanPeriod = 9000;
    var scanPh = (ts % scanPeriod) / scanPeriod;
    var scanY = -H * 0.25 + scanPh * H * 1.5;
    var scanBand = H * 0.24;
    function scanBoost(y) {
      var sd = Math.abs(y - scanY);
      if (sd >= scanBand) return 0;
      var sb = 1 - sd / scanBand;
      return sb * sb;
    }

    /* 两道错开的涟漪 + 换字/放大时的一记强波 */
    /* 涟漪只属于「切换大小」那一下：平时完全静止 */
    var waves = [];
    if (!reduce) {
      var age = ts - burstAt;
      if (age >= 0 && age < 1700) {
        var k = age / 1700;
        waves.push({ r: k * Math.max(W, H) * 0.78, amp: Math.sin(Math.PI * k) * 20, w: 150 });
      }
    }

    /* 位移与增益：高斯包络，越靠波峰推得越远 */
    function fieldOf(c) {
      var push = 0, gain = 0;
      for (var wi = 0; wi < waves.length; wi++) {
        var wv = waves[wi];
        var q = (c.dist - wv.r) / wv.w;
        var g = Math.exp(-q * q * 2.4);
        push += wv.amp * g;
        gain += g;
      }
      if (gain > 1.6) gain = 1.6;
      return { push: push, gain: gain };
    }

    lastWaveAmp = waves.length ? Math.abs(waves[0].amp) : 0;

    var mulNew = prevCells && morphT < 1 ? morphT * morphT : 1;
    var mulOld = prevCells && morphT < 1 ? 1 - morphT * morphT : 0;

    /* 点：批量画 */
    for (var pass = 0; pass < 2; pass++) {
      var set = pass === 0 ? cells : prevCells;
      if (!set) continue;
      var mul = pass === 0 ? mulNew : mulOld;
      if (mul <= 0) continue;

      for (var i = 0; i < set.length; i++) {
        var c = set[i];
        if (c.plus) continue;
        var f = fieldOf(c);
        var X = gx + c.rx * sc + c.ux * f.push * sc + c.jx * sc;
        var Y = gy + c.ry * sc + c.uy * f.push * sc + c.jy * sc;
      if (ptr.active) {
        var wdx = X - ptr.x;
        var wdy = Y - ptr.y;
        var wd2 = wdx * wdx + wdy * wdy;
        if (wd2 < CURSOR_R * CURSOR_R) {
          var wd = Math.sqrt(wd2) || 1;
          var wf = 1 - wd / CURSOR_R;
          var wa = wf * wf * CURSOR_PUSH;
          X += (wdx / wd) * wa;
          Y += (wdy / wd) * wa;
        }
      }

        if (X < -40 || X > W + 40 || Y < -40 || Y > H + 40) continue;
        var a = pal.base * c.wt * (1 - f.gain * 0.35) * mul * (1 + scanBoost(Y) * 1.45);
        if (a > 0.95) a = 0.95;
        if (a < 0.012) continue;
        ctx.fillStyle = 'rgba(' + pal.rgb + ',' + a.toFixed(3) + ')';
        /* 圆点：和加号同一视觉重量，靠形状区分 */
        ctx.beginPath();
        ctx.arc(X, Y, 1.45, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    /* 加号：逐个描边，波峰处胀大 */
    function stampPlus(c, mul) {
      if (!c.plus) return;
      var f = fieldOf(c);
      var X = gx + c.rx * sc + c.ux * f.push * sc + c.jx * sc;
      var Y = gy + c.ry * sc + c.uy * f.push * sc + c.jy * sc;
      if (ptr.active) {
        var wdx = X - ptr.x;
        var wdy = Y - ptr.y;
        var wd2 = wdx * wdx + wdy * wdy;
        if (wd2 < CURSOR_R * CURSOR_R) {
          var wd = Math.sqrt(wd2) || 1;
          var wf = 1 - wd / CURSOR_R;
          var wa = wf * wf * CURSOR_PUSH;
          X += (wdx / wd) * wa;
          Y += (wdy / wd) * wa;
        }
      }

      if (X < -50 || X > W + 50 || Y < -50 || Y > H + 50) return;

      var breath = 0.86 + 0.14 * Math.sin(ts * 0.0009 + c.ph);
      var a = (pal.base + (pal.hot - pal.base) * c.v * breath + f.gain * 0.22) * mul * (1 + scanBoost(Y) * 1.45);
      if (a > 0.95) a = 0.95;
      if (a < 0.015) return;
      var arm = (2.9 + c.v * 2.3) * (1 + f.gain * 0.55) * breath * (1 + zoom * 0.1);

      ctx.strokeStyle = 'rgba(' + pal.rgb + ',' + a.toFixed(3) + ')';
      ctx.lineWidth = 1.5 + f.gain * 0.6;
      ctx.beginPath();
      ctx.moveTo(X - arm, Y);
      ctx.lineTo(X + arm, Y);
      ctx.moveTo(X, Y - arm);
      ctx.lineTo(X, Y + arm);
      ctx.stroke();
    }

    if (prevCells && mulOld > 0) {
      for (var j = 0; j < prevCells.length; j++) stampPlus(prevCells[j], mulOld);
    }
    for (var m = 0; m < cells.length; m++) stampPlus(cells[m], mulNew);
  }

  /* ------------------------------------------------------------- 6. 启动 */
  function boot() {
    text = resolveText();
    rebuild();
    last = performance.now();
    /* 首帧再算一次：脚本可能在布局完成前执行，那时画布尺寸还是 0 */
    window.requestAnimationFrame(function () {
      rebuild();
      last = performance.now();
      readBoundary();
      zoom = zoomTarget;
    });
    if (!raf) raf = window.requestAnimationFrame(draw);

    window.addEventListener('scroll', readBoundary, { passive: true });

    var rt = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(rt);
        rt = setTimeout(function () {
          var keep = text;
          rebuild();
          if (keep) setText(keep);
          readBoundary();
        }, 220);
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = window.requestAnimationFrame(draw);
      }
    });

    function onMove(e) {
      var pt = e.touches && e.touches[0] ? e.touches[0] : e;
      if (typeof pt.clientX !== 'number') return;
      ptr.tx = pt.clientX;
      ptr.ty = pt.clientY;
      if (!ptr.active) {
        ptr.x = ptr.tx;
        ptr.y = ptr.ty;
        ptr.active = true;
      }
    }
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('touchstart', onMove, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: true });
    window.addEventListener('pointerdown', onMove, { passive: true });
    window.addEventListener(
      'pointerleave',
      function () {
        ptr.active = false;
      },
      { passive: true }
    );
    document.addEventListener('touchend', function () {
      ptr.active = false;
    });

    window.__PLUS_FIELD__ = {
      setText: function (t) {
        window.__PLUS_TEXT__ = t;
        setText(textForKey(t));
      },
      rebuild: rebuild,
      stats: function () {
        var plus = 0;
        for (var i = 0; i < cells.length; i++) if (cells[i].plus) plus++;
        return {
          cells: cells.length,
          plus: plus,
          text: text,
          zoom: +zoom.toFixed(2),
          enlarged: enlarged,
          waveAmp: +lastWaveAmp.toFixed(1),
          ptrActive: ptr.active
        };
      }
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
