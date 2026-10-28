/* ==========================================================================
   A_SU ARCHIVE — 天域主题氛围层（AETHER ATMOSPHERE）v5 · 印刷版
   --------------------------------------------------------------------------
   按《众生行记》图录的工艺重做整页的平面图层：

   · 钴蓝圆盘 + 三道环（实线 / 虚线 / 刻度）套印在插画上
   · 拼贴界面框、尺寸标注线、外框数字
   · 六块碎玻璃、飘落羽毛
   · 红色轨迹：六边形节点 + 锁定圈；采样点上长出树形分叉，
     离主干越远越淡、越细；线描两遍（套印错位），线身微拱，线头过冲
   只在 body[data-theme="heaven"] 时活动。
   ========================================================================== */
(function () {
  'use strict';

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FPS = 30;
  var FEATHERS = 14;

  var SHARD_KEYS = ['a', 'b', 'c', 'd', 'e', 'f'];
  var SHARD_PAR = [9, -6, 5, -4, 7, -8];

  /* 轨迹 */
  var GAP = 120;
  var LIFE = 2100;
  var MAX_PTS = 16;
  var COLOR = '184,35,31';

  /* 树：寿命与主线一致（都用 LIFE），形状随机 */
  var TREE_MAX = 4;
  var TREE_CHANCE = 0.3;
  var TREE_GROW = 620;
  var DEPTH_FADE = 0.66;
  var TREE_ALPHA = 0.95;

  /* 圆环 */
  var RING_MIN = 3;
  var RING_MAX = 5;

  var canvas = null;
  var ctx = null;
  var trailCanvas = null;
  var tctx = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0;
  var H = 0;

  var feathers = [];
  var floats = [];
  var floatCanvas = null;
  var fctx = null;
  var shards = [];
  var raf = 0;
  var last = 0;
  var acc = 0;

  var px = 0;
  var py = 0;
  var tpx = 0;
  var tpy = 0;

  var pts = [];
  var rings = [];
  var trees = [];
  var ringTick = 0;
  var ringNeed = RING_MIN + Math.floor(Math.random() * (RING_MAX - RING_MIN + 1));
  var pen = { x: 0, y: 0, on: false };
  var goal = { x: 0, y: 0, on: false };

  function active() {
    return document.body && document.body.dataset.theme === 'heaven';
  }

  /* ------------------------------------------------------- 1. 平面图层 */
  function buildStage() {
    if (document.querySelector('.hv-stage')) return;

    var host =
      document.querySelector('.hero') ||
      document.querySelector('.dh') ||
      document.querySelector('main') ||
      document.body;

    if (host !== document.body && getComputedStyle(host).position === 'static') {
      host.style.position = 'relative';
    }

    var stage = document.createElement('div');
    stage.className = 'hv-stage';
    stage.setAttribute('aria-hidden', 'true');
    stage.innerHTML =
      '<div class="hv-ring hv-ring--c"></div>' +
      '<div class="hv-ring hv-ring--b"></div>' +
      '<div class="hv-disc"></div>' +
      '<div class="hv-ring hv-ring--a"></div>' +
      '<div class="hv-frame hv-frame--a"><b>RECORD 06</b><i>LATERANO · SANCTUM</i></div>' +
      '<div class="hv-frame hv-frame--b"><b>PLATE 02</b><i>SETTING ARCHIVE</i></div>' +
      '<div class="hv-dim hv-dim--h"><span>1200 · PLATE WIDTH</span></div>' +
      '<div class="hv-dim hv-dim--v"><span>900</span></div>' +
      '<div class="hv-no">06</div>' +
      '<span class="hv-reg hv-reg--tl"></span>' +
      '<span class="hv-reg hv-reg--tr"></span>' +
      '<span class="hv-reg hv-reg--bl"></span>' +
      '<span class="hv-reg hv-reg--br"></span>' +
      '<div class="hv-strip"></div>' +
      '<div class="hv-scan"></div>' +
      '<div class="hv-orbit" aria-hidden="true">' +
      '<svg viewBox="0 0 400 400">' +
      '<defs><path id="hvOrbPath" d="M200,200 m-192,0 a192,192 0 1,1 384,0 a192,192 0 1,1 -384,0"/></defs>' +
      '<text><textPath href="#hvOrbPath" startOffset="0">LATERANO · SANCTUM · RECORD 06 · A_SU / PUGUA · PLATE 01—02 · </textPath></text>' +
      '</svg></div>';

    shards = SHARD_KEYS.map(function (k) {
      var el = document.createElement('div');
      el.className = 'hv-shard hv-shard--' + k;
      stage.appendChild(el);
      return el;
    });

    host.appendChild(stage);
  }

  function buildCanvas(cls) {
    var el = document.querySelector('.' + cls);
    if (!el) {
      el = document.createElement('canvas');
      el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      document.body.appendChild(el);
    }
    return el;
  }

  /* --------------------------------------- 2. 浮动的小几何（会闪烁的那种） */
  var FLOAT_N = 26;

  function seedFloats() {
    floats = [];
    var types = ['cross', 'square', 'dot', 'diamond', 'sparkle'];
    for (var i = 0; i < FLOAT_N; i++) {
      var kind = types[Math.floor(Math.random() * types.length)];
      var warm = Math.random() < 0.45;
      floats.push({
        kind: kind,
        x: Math.random() * W,
        y: Math.random() * H,
        s: kind === 'sparkle' ? 5 + Math.random() * 6 : 2 + Math.random() * 4,
        vx: (Math.random() - 0.3) * 0.012,
        vy: -(0.004 + Math.random() * 0.012),
        ph: Math.random() * Math.PI * 2,
        sway: 0.4 + Math.random() * 1.1,
        blink: Math.random() < 0.45,
        bph: Math.random() * Math.PI * 2,
        bsp: 0.004 + Math.random() * 0.012,
        a: 0.18 + Math.random() * 0.34,
        color: warm ? '184,35,31' : '58,91,194',
        rot: Math.random() * Math.PI
      });
    }
  }

  function drawFloat(f, ts) {
    var pulse;
    if (f.blink) {
      var raw = Math.sin(ts * f.bsp + f.bph);
      pulse = raw > 0.15 ? 1 : 0.12;
    } else {
      pulse = 0.55 + 0.45 * Math.sin(ts * f.bsp * 0.6 + f.bph);
    }

    var a = f.a * pulse;
    if (a <= 0.02) return;

    var s = f.s;
    fctx.save();
    fctx.translate(f.x, f.y);
    fctx.strokeStyle = 'rgba(' + f.color + ',' + a.toFixed(3) + ')';
    fctx.fillStyle = 'rgba(' + f.color + ',' + a.toFixed(3) + ')';
    fctx.lineWidth = 0.9;

    if (f.kind === 'cross') {
      var arm = s * 1.7;
      fctx.beginPath();
      fctx.moveTo(-arm, 0); fctx.lineTo(arm, 0);
      fctx.moveTo(0, -arm); fctx.lineTo(0, arm);
      fctx.stroke();
    } else if (f.kind === 'square') {
      fctx.rotate(f.rot);
      fctx.strokeRect(-s, -s, s * 2, s * 2);
    } else if (f.kind === 'dot') {
      fctx.beginPath();
      fctx.arc(0, 0, s * 0.8, 0, 6.283);
      fctx.fill();
    } else if (f.kind === 'diamond') {
      fctx.beginPath();
      fctx.moveTo(0, -s * 1.5);
      fctx.lineTo(s * 1.1, 0);
      fctx.lineTo(0, s * 1.5);
      fctx.lineTo(-s * 1.1, 0);
      fctx.closePath();
      fctx.stroke();
    } else {
      var L = s * 2.2;
      var S = s * 0.7;
      fctx.beginPath();
      fctx.moveTo(0, -L); fctx.lineTo(0, L);
      fctx.moveTo(-L, 0); fctx.lineTo(L, 0);
      fctx.moveTo(-S, -S); fctx.lineTo(S, S);
      fctx.moveTo(S, -S); fctx.lineTo(-S, S);
      fctx.lineWidth = 0.7;
      fctx.stroke();
    }
    fctx.restore();
  }

  function paintFloats(ts) {
    if (!fctx) return;
    fctx.clearRect(0, 0, W, H);
    for (var i = 0; i < floats.length; i++) drawFloat(floats[i], ts);
  }

  /* ------------------------------------------------------------- 2. 羽毛 */
  function seedFeathers() {
    feathers = [];
    for (var f = 0; f < FEATHERS; f++) {
      feathers.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 3 + Math.random() * 5,
        vy: 0.008 + Math.random() * 0.016,
        sway: Math.random() * Math.PI * 2,
        rot: Math.random() * Math.PI,
        spin: (Math.random() - 0.5) * 0.0016,
        a: 0.14 + Math.random() * 0.2
      });
    }
  }

  function drawFeather(f) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.rotate(f.rot);
    ctx.beginPath();
    ctx.moveTo(0, -f.s);
    ctx.quadraticCurveTo(f.s * 0.55, 0, 0, f.s);
    ctx.quadraticCurveTo(-f.s * 0.22, 0, 0, -f.s);
    ctx.fillStyle = 'rgba(30,56,76,' + f.a.toFixed(3) + ')';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -f.s * 0.86);
    ctx.lineTo(0, f.s * 0.86);
    ctx.strokeStyle = 'rgba(255,255,255,.45)';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    ctx.restore();
  }

  /* ------------------------------------- 3. 淡入淡出 / 采样点 / 分形树 */
  function fadeIn(age, dur) {
    var x = age / dur;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  function pointAlpha(age) {
    var fi = fadeIn(age, 200);
    var fo = Math.max(0, 1 - age / LIFE);
    return fi * fo * fo;
  }

  function addPoint(x, y, now) {
    var prev = pts.length ? pts[pts.length - 1] : null;
    var ang = prev ? Math.atan2(y - prev.y, x - prev.x) : Math.random() * 6.283;

    pts.push({ x: x, y: y, t: now, ang: ang });

    ringTick++;
    if (ringTick >= ringNeed) {
      ringTick = 0;
      ringNeed = RING_MIN + Math.floor(Math.random() * (RING_MAX - RING_MIN + 1));
      rings.push({ x: x, y: y, t0: now, r0: 3, r1: 66, dur: 1000, a: 0.5 });
      rings.push({ x: x, y: y, t0: now + 140, r0: 2, r1: 38, dur: 860, a: 0.26 });
    }

    if (Math.random() < TREE_CHANCE) growTree(x, y, ang, now);

    if (pts.length > MAX_PTS) pts.shift();
  }

  /* 两角之间的最小夹角（把角度差规约到 0..π） */
  function angleGap(a, b) {
    var d = Math.abs(a - b) % (Math.PI * 2);
    return d > Math.PI ? Math.PI * 2 - d : d;
  }

  /* 在 [0,2π) 里挑一个方向：尽量离 forbid 远一点，别和主线叠在一起 */
  function pickDir(forbid, minGap) {
    for (var i = 0; i < 24; i++) {
      var d = Math.random() * Math.PI * 2;
      if (angleGap(d, forbid) >= minGap) return d;
    }
    /* 实在挑不出来就干脆取反向 */
    return forbid + Math.PI;
  }

  /* 广度优先生长：每层先铺满，树冠才匀称，不会一边长成一根筷子 */
  function growTree(x, y, ang, now) {
    if (trees.length >= TREE_MAX) trees.shift();

    var segs = [];
    var tips = [];

    var maxDepth = 4;
    var budget = 8 + Math.floor(Math.random() * 8); /* 8..15 段 */
    var baseLen = 26 + Math.random() * 36; /* 26..62 */
    var shrink = 0.74 + Math.random() * 0.2; /* 每级收细 74%..94% */

    var queue = [{ x: x, y: y, dir: pickDir(ang, 1.05), len: baseLen, depth: 0, d0: 0 }];
    var guard = 0;

    while (queue.length && segs.length < budget && guard++ < 400) {
      var n = queue.shift();
      if (n.depth > maxDepth) continue;

      var bend = (Math.random() - 0.5) * 0.7;
      var x1 = n.x + Math.cos(n.dir) * n.len;
      var y1 = n.y + Math.sin(n.dir) * n.len;

      segs.push({
        x0: n.x, y0: n.y, x1: x1, y1: y1,
        depth: n.depth, d0: n.d0, len: n.len, bend: bend
      });

      if (n.depth >= maxDepth || segs.length >= budget) {
        tips.push({ x: x1, y: y1, depth: n.depth, dir: n.dir });
        continue;
      }

      var roll = Math.random();
      var kids = roll < 0.22 ? 1 : roll < 0.82 ? 2 : 3;

      for (var i = 0; i < kids; i++) {
        var spread = 0.42 + Math.random() * 0.8;
        var theta = n.dir + (i - (kids - 1) / 2) * spread + (Math.random() - 0.5) * 0.4;
        if (angleGap(theta, n.dir) < 0.26) theta = n.dir + 0.26 * (i % 2 ? 1 : -1);

        queue.push({
          x: x1, y: y1,
          dir: theta,
          len: n.len * shrink * (0.92 + Math.random() * 0.16),
          depth: n.depth + 1,
          d0: n.d0 + n.len
        });
      }
    }

    if (!segs.length) return;

    var reach = 0;
    for (var s = 0; s < segs.length; s++) {
      if (segs[s].d0 + segs[s].len > reach) reach = segs[s].d0 + segs[s].len;
    }

    trees.push({
      segs: segs,
      tips: tips,
      root: { x: x, y: y },
      reach: reach,
      t0: now
    });
  }
  /* 一条线描两遍，第二遍偏一点（套印错位） */
  function strokeTwice(alpha, weight) {
    /* 白底托墨：先垫一层极浅的白，让红压在红色圆盘上也读得出来 */
    tctx.strokeStyle = 'rgba(255,255,255,' + (alpha * 0.85).toFixed(3) + ')';
    tctx.lineWidth = weight + 2.4;
    tctx.stroke();

    tctx.strokeStyle = 'rgba(' + COLOR + ',' + alpha.toFixed(3) + ')';
    tctx.lineWidth = weight;
    tctx.stroke();

    tctx.save();
    tctx.translate(0.7, -0.6);
    tctx.strokeStyle = 'rgba(' + COLOR + ',' + (alpha * 0.45).toFixed(3) + ')';
    tctx.lineWidth = weight * 0.75;
    tctx.stroke();
    tctx.restore();
  }

  function drawTree(tr, now) {
    var age = now - tr.t0;
    if (age < 0 || age > LIFE) return;

    /* 与主线共用同一条透明度曲线：一起出现、一起消失 */
    var shared = pointAlpha(age);
    if (shared <= 0.002) return;

    var growT = Math.min(1, age / TREE_GROW);
    var growEase = growT * growT * (3 - 2 * growT);
    var visible = tr.reach * growEase;

    /* 构造圆：根部的定位环 */
    if (growT > 0.05) {
      var crad = 22 + 34 * growEase;
      tctx.beginPath();
      tctx.arc(tr.root.x, tr.root.y, crad, 0, 6.283);
      tctx.strokeStyle = 'rgba(' + COLOR + ',' + (shared * 0.32).toFixed(3) + ')';
      tctx.lineWidth = 0.8;
      tctx.stroke();

      var tick = -Math.PI / 2;
      tctx.beginPath();
      tctx.moveTo(tr.root.x + Math.cos(tick) * crad, tr.root.y + Math.sin(tick) * crad);
      tctx.lineTo(
        tr.root.x + Math.cos(tick) * (crad + 6),
        tr.root.y + Math.sin(tick) * (crad + 6)
      );
      tctx.strokeStyle = 'rgba(' + COLOR + ',' + (shared * 0.45).toFixed(3) + ')';
      tctx.lineWidth = 0.9;
      tctx.stroke();
    }

    for (var i = 0; i < tr.segs.length; i++) {
      var sg = tr.segs[i];
      if (sg.d0 >= visible) continue;

      var shown = Math.min(1, (visible - sg.d0) / sg.len);
      var ex = sg.x0 + (sg.x1 - sg.x0) * shown;
      var ey = sg.y0 + (sg.y1 - sg.y0) * shown;

      /* 离主干越远越淡、越细；整体再乘主线的透明度 */
      var depthA = Math.pow(DEPTH_FADE, sg.depth);
      var alpha = TREE_ALPHA * depthA * shared;
      var weight = Math.max(0.5, 1.5 - sg.depth * 0.28);

      var mx = (sg.x0 + ex) / 2;
      var my = (sg.y0 + ey) / 2;
      var nx = -(ey - sg.y0);
      var ny = ex - sg.x0;
      var nl = Math.hypot(nx, ny) || 1;
      var bow = sg.bend * shown * 26;

      tctx.beginPath();
      tctx.moveTo(sg.x0, sg.y0);
      tctx.quadraticCurveTo(mx + (nx / nl) * bow, my + (ny / nl) * bow, ex, ey);

      if (shown >= 1) {
        var dx = sg.x1 - sg.x0;
        var dy = sg.y1 - sg.y0;
        var dl = Math.hypot(dx, dy) || 1;
        tctx.lineTo(sg.x1 + (dx / dl) * 2.2, sg.y1 + (dy / dl) * 2.2);
      }

      strokeTwice(alpha, weight);
    }

    for (var t = 0; t < tr.tips.length; t++) {
      var tp = tr.tips[t];
      var d = Math.abs(tp.x - tr.root.x) + Math.abs(tp.y - tr.root.y);
      if (visible < d) continue;
      var ta = 0.55 * Math.pow(DEPTH_FADE, tp.depth) * shared;
      var r = Math.max(1, 2.4 - tp.depth * 0.35);
      tctx.beginPath();
      tctx.arc(tp.x, tp.y, r, 0, 6.283);
      tctx.fillStyle = 'rgba(' + COLOR + ',' + ta.toFixed(3) + ')';
      tctx.fill();

      /* 枝头两片子叶：让末端不是一个光秃秃的点 */
      var leaf = 4; /* 固定长度，避免每帧抖动 */
      var la = ta * 0.75;
      for (var lf = 0; lf < 2; lf++) {
        var a2 = tp.dir + (lf === 0 ? -0.85 : 0.85);
        tctx.beginPath();
        tctx.moveTo(tp.x, tp.y);
        tctx.lineTo(tp.x + Math.cos(a2) * leaf * 2.2, tp.y + Math.sin(a2) * leaf * 2.2);
        tctx.strokeStyle = 'rgba(' + COLOR + ',' + la.toFixed(3) + ')';
        tctx.lineWidth = 0.7;
        tctx.stroke();
      }
    }
  }

  /* --------------------------------------------- 4. 六边形节点 + 锁定圈 */
  function drawHexNode(x, y, r, rot, alpha) {
    tctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = rot + (i * Math.PI) / 3;
      var hx = x + Math.cos(a) * r;
      var hy = y + Math.sin(a) * r;
      if (i === 0) tctx.moveTo(hx, hy);
      else tctx.lineTo(hx, hy);
    }
    tctx.closePath();
    tctx.strokeStyle = 'rgba(' + COLOR + ',' + alpha.toFixed(3) + ')';
    tctx.lineWidth = 1;
    tctx.stroke();

    tctx.fillStyle = 'rgba(' + COLOR + ',' + (alpha * 0.9).toFixed(3) + ')';
    tctx.fillRect(x - 1.2, y - 1.2, 2.4, 2.4);
  }

  function drawLockRing(x, y, r, rot, alpha) {
    tctx.save();
    tctx.beginPath();
    tctx.setLineDash([3, 5]);
    tctx.arc(x, y, r, rot, 6.283 + rot);
    tctx.strokeStyle = 'rgba(' + COLOR + ',' + alpha.toFixed(3) + ')';
    tctx.lineWidth = 0.8;
    tctx.stroke();
    tctx.restore();

    for (var k = 0; k < 4; k++) {
      var a = rot + (k * Math.PI) / 2;
      tctx.beginPath();
      tctx.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      tctx.lineTo(x + Math.cos(a) * (r + 4), y + Math.sin(a) * (r + 4));
      tctx.strokeStyle = 'rgba(' + COLOR + ',' + (alpha * 0.8).toFixed(3) + ')';
      tctx.lineWidth = 0.9;
      tctx.stroke();
    }
  }

  /* ------------------------------------------------------------- 5. 画轨迹 */
  function drawTrail(now) {
    tctx.clearRect(0, 0, W, H);

    for (var i = 1; i < pts.length; i++) {
      var pa = pts[i - 1];
      var pb = pts[i];
      var al = Math.min(pointAlpha(now - pa.t), pointAlpha(now - pb.t));
      if (al <= 0) continue;
      tctx.beginPath();
      tctx.moveTo(pa.x, pa.y);
      tctx.lineTo(pb.x, pb.y);
      tctx.strokeStyle = 'rgba(255,255,255,' + (al * 0.8).toFixed(3) + ')';
      tctx.lineWidth = 3.4;
      tctx.stroke();
      tctx.strokeStyle = 'rgba(' + COLOR + ',' + (al * 0.8).toFixed(3) + ')';
      tctx.lineWidth = 1.1;
      tctx.stroke();
    }

    for (var ti = 0; ti < trees.length; ti++) drawTree(trees[ti], now);

    for (var r = 0; r < rings.length; r++) {
      var g = rings[r];
      var t = (now - g.t0) / g.dur;
      if (t < 0 || t >= 1) continue;
      var ease = 1 - Math.pow(1 - t, 3);
      var rad = g.r0 + (g.r1 - g.r0) * ease;
      var ra = (1 - t) * (1 - t) * g.a;
      tctx.beginPath();
      tctx.arc(g.x, g.y, rad, 0, 6.283);
      tctx.strokeStyle = 'rgba(' + COLOR + ',' + ra.toFixed(3) + ')';
      tctx.lineWidth = 1;
      tctx.stroke();
    }

    for (var n = 0; n < pts.length; n++) {
      var q = pts[n];
      var na = pointAlpha(now - q.t);
      if (na <= 0) continue;
      var isLast = n === pts.length - 1;
      var size = (isLast ? 6.2 : 4.4) * (0.5 + na * 0.5);
      drawHexNode(q.x, q.y, size, now * 0.0004 + n, na * 0.85);
      if (isLast) drawLockRing(q.x, q.y, size + 7, now * 0.0008, na * 0.42);
    }
  }

  /* ------------------------------------------------------------- 6. 尺寸 */
  function resize() {
    if (!canvas) return;
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;

    [canvas, trailCanvas, floatCanvas].forEach(function (cv) {
      cv.width = Math.round(W * dpr);
      cv.height = Math.round(H * dpr);
    });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    seedFeathers();
    seedFloats();
    pts = [];
    rings = [];
    trees = [];
    pen.on = false;
  }

  function paintFeathers() {
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < feathers.length; i++) drawFeather(feathers[i]);
  }

  /* ------------------------------------------------------------- 7. 循环 */
  function loop(ts) {
    raf = window.requestAnimationFrame(loop);

    var dt = ts - last;
    last = ts;
    if (dt > 200) dt = 16;

    if (!active()) return;

    px += (tpx - px) * Math.min(1, dt * 0.0032);
    py += (tpy - py) * Math.min(1, dt * 0.0032);
    for (var i = 0; i < shards.length; i++) {
      var f = SHARD_PAR[i] || 6;
      shards[i].style.translate =
        (px * f).toFixed(1) + 'px ' + (py * f * 0.7).toFixed(1) + 'px';
    }

    if (pen.on && goal.on) {
      var k = 1 - Math.exp(-dt / 72);
      pen.x += (goal.x - pen.x) * k;
      pen.y += (goal.y - pen.y) * k;

      var lastP = pts.length ? pts[pts.length - 1] : null;
      var d = lastP ? Math.hypot(pen.x - lastP.x, pen.y - lastP.y) : Infinity;
      if (d >= GAP) addPoint(pen.x, pen.y, ts);
    }

    var cut = ts - LIFE;
    while (pts.length && pts[0].t < cut) pts.shift();
    for (var r = rings.length - 1; r >= 0; r--) {
      if (ts - rings[r].t0 > rings[r].dur) rings.splice(r, 1);
    }
    for (var tri = trees.length - 1; tri >= 0; tri--) {
      if (ts - trees[tri].t0 > LIFE) trees.splice(tri, 1);
    }

    drawTrail(ts);

    if (reduce) return;

    acc += dt;
    if (acc < 1000 / FPS) return;
    var step = acc;
    acc = 0;

    for (var fe = 0; fe < feathers.length; fe++) {
      var fh = feathers[fe];
      fh.y += fh.vy * step;
      fh.rot += fh.spin * step;
      fh.x += Math.sin(ts * 0.0006 + fh.sway) * 0.012 * step;
      if (fh.y > H + 20) {
        fh.y = -20;
        fh.x = Math.random() * W;
        fh.rot = Math.random() * Math.PI;
      }
    }
    /* 浮动小几何：慢飘 + 上下摆动 */
    for (var fi = 0; fi < floats.length; fi++) {
      var fl = floats[fi];
      fl.x += (fl.vx + Math.sin(ts * 0.0003 + fl.ph) * 0.006) * step;
      fl.y += fl.vy * step;
      if (fl.y < -30) { fl.y = H + 30; fl.x = Math.random() * W; }
      if (fl.x < -40) fl.x = W + 40;
      if (fl.x > W + 40) fl.x = -40;
    }

    paintFeathers();
    paintFloats(ts);
  }

  /* ------------------------------------------------------------- 8. 指针 */
  function bindPointer() {
    function move(x, y) {
      tpx = (x / window.innerWidth - 0.5) * 2;
      tpy = (y / window.innerHeight - 0.5) * 2;

      goal.x = x;
      goal.y = y;
      goal.on = true;
      if (!pen.on) {
        pen.x = x;
        pen.y = y;
        pen.on = true;
        addPoint(x, y, performance.now());
      }
    }

    window.addEventListener('pointermove', function (e) {
      move(e.clientX, e.clientY);
    }, { passive: true });

    window.addEventListener('pointerdown', function (e) {
      move(e.clientX, e.clientY);
      if (!active()) return;
      rings.push({
        x: e.clientX, y: e.clientY, t0: performance.now(),
        r0: 2, r1: 34, dur: 620, a: 0.4
      });
    }, { passive: true });

    window.addEventListener('pointerleave', function () {
      goal.on = false;
      pen.on = false;
    }, { passive: true });

    window.addEventListener('touchstart', function (e) {
      var t = e.touches && e.touches[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive: true });

    window.addEventListener('touchmove', function (e) {
      var t = e.touches && e.touches[0];
      if (t) move(t.clientX, t.clientY);
    }, { passive: true });

    ['touchend', 'touchcancel'].forEach(function (ev) {
      window.addEventListener(ev, function () {
        goal.on = false;
        pen.on = false;
      }, { passive: true });
    });
  }

  /* 章节编号：FIG. 01 / FIG. 02 …，印刷图录的图版号 */
  function decorateSections() {
    var heads = document.querySelectorAll('.section-head');
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].querySelector('.hv-fig')) continue;
      var tag = document.createElement('span');
      tag.className = 'hv-fig';
      tag.setAttribute('aria-hidden', 'true');
      tag.textContent = 'FIG. ' + (i + 1 < 10 ? '0' : '') + (i + 1);
      heads[i].appendChild(tag);
    }
  }
  /* ------------------------------------------------------------- 9. 启动 */
  function boot() {
    buildStage();
    decorateSections();
    canvas = buildCanvas('hv-feathers');
    ctx = canvas.getContext('2d', { alpha: true });
    trailCanvas = buildCanvas('hv-trail');
    tctx = trailCanvas.getContext('2d', { alpha: true });
    floatCanvas = buildCanvas('hv-float');
    fctx = floatCanvas.getContext('2d', { alpha: true });

    resize();
    bindPointer();
    last = performance.now();
    if (!raf) raf = window.requestAnimationFrame(loop);

    var rt = 0;
    window.addEventListener('resize', function () {
      clearTimeout(rt);
      rt = setTimeout(resize, 220);
    }, { passive: true });

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(raf);
        raf = 0;
      } else if (!raf) {
        last = performance.now();
        raf = window.requestAnimationFrame(loop);
      }
    });

    window.__HV_ATMOSPHERE__ = {
      refresh: function () {
        resize();
        last = performance.now();
        if (active()) { paintFeathers(); paintFloats(performance.now()); }
      },
      /* 调试用：在指定位置长一棵树，方便单独看形状 */
      spawnTree: function (x, y, ang) {
        growTree(
          typeof x === 'number' ? x : W * 0.5,
          typeof y === 'number' ? y : H * 0.5,
          typeof ang === 'number' ? ang : 0,
          performance.now()
        );
        return trees.length;
      },
      debug: function () {
        return {
          stage: !!document.querySelector('.hv-stage'),
          disc: !!document.querySelector('.hv-disc'),
          rings: document.querySelectorAll('.hv-ring').length,
          frames: document.querySelectorAll('.hv-frame').length,
          dims: document.querySelectorAll('.hv-dim').length,
          feathers: feathers.length,
          floats: floats.length,
          orbit: !!document.querySelector('.hv-orbit'),
          scan: !!document.querySelector('.hv-scan'),
          shards: shards.length,
          trail: !!document.querySelector('.hv-trail'),
          trailPts: pts.length,
          trees: trees.length,
          active: active()
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
