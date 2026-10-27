/* ==========================================================================
   A_SU ARCHIVE — 星域主题的氛围层（SCI-FI ATMOSPHERE）v4
   --------------------------------------------------------------------------
   1) 星空：漂移星点 + 固定暗连线 + 星座簇呼吸光
   2) 随机脉冲暗线：每次随机挑两颗邻近星，让它们之间亮起一条暗线再消失（闪烁）
   3) 鼠标轨迹：按距离落点，头部用阻尼跟随 + 二次曲线连接，慢速也顺
   4) 视口角标 / 刻度轨 / 指针视差；无常驻 3D 星环
   两条绘制循环分开：星层 30fps，轨迹层跟随屏幕刷新率。
   ========================================================================== */
(function () {
  'use strict';

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------- 0. 两张画布 */
  var canvas = document.createElement('canvas');
  canvas.className = 'sf-stars';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.insertBefore(canvas, document.body.firstChild);
  var ctx = canvas.getContext('2d', { alpha: true });

  var tcanvas = document.createElement('canvas');
  tcanvas.className = 'sf-trail';
  tcanvas.setAttribute('aria-hidden', 'true');
  document.body.appendChild(tcanvas);
  var tctx = tcanvas.getContext('2d', { alpha: true });

  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0;
  var H = 0;

  var starRaf = 0;
  var trailRaf = 0;
  var lastStar = 0;
  var starAcc = 0;
  var lastTrail = 0;
  var linkTick = 0;

  var pointer = { x: -999, y: -999, active: false, px: 0, py: 0 };

  var stars = [];
  var clusters = [];
  var links = []; /* 固定暗连线 [i, j, 权重] */
  var pulses = []; /* 随机闪烁连线 {a, b, t0, life} */
  var MAX_PULSES = 18;

  /* ---- 轨迹参数 ---- */
  /* 采样间距随速度变：慢的时候密（64），快的时候稀（120） */
  var SAMPLE_MIN = 32;
  var SAMPLE_MAX = 120;
  var SPEED_REF = 1.6; /* 约 1.6 px/ms 就算「快」 */
  var sampleDist = SAMPLE_MIN;
  var speedSm = 0; /* 平滑后的速度 px/ms */
  var prevPtr = null;
  var TRAIL_LIFE = 1600; /* 毫秒 */
  var MAX_POINTS = 20;
  var trail = []; /* {x,y,t} */
  var lastPt = null;
  var cursor = { x: 0, y: 0, has: false };
  var head = { x: 0, y: 0, has: false }; /* 阻尼跟随的头部 */
  var trailDirty = true;

  /* ------------------------------------------------------------ 1. 主题参数 */
  function cfg() {
    var t = (document.body && document.body.dataset.theme) || 'day';
    if (t === 'scifi') {
      return {
        on: true,
        star: '150,222,255',
        link: '110,200,255',
        density: 11000,
        max: 200,
        linkDist: 150,
        linkA: 0.22,
        starA: 0.9,
        trail: true,
        clusterA: 1,
        maxFps: 30,
        pulseA: 0.72
      };
    }
    if (t === 'night') {
      return {
        on: true,
        star: '225,238,255',
        link: '200,225,255',
        density: 18000,
        max: 120,
        linkDist: 120,
        linkA: 0.16,
        starA: 0.55,
        trail: true,
        clusterA: 0.6,
        maxFps: 24,
        pulseA: 0.42
      };
    }
    return { on: false, maxFps: 20, pulseA: 0 };
  }

  /* 淡入：出生后 dur 毫秒内从 0 平滑到 1（smoothstep） */
  function rampIn(ageMs, durMs) {
    var x = ageMs / durMs;
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  /* --------------------------------------------------------------- 2. 星空 */
  function sizeCanvas() {
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    tcanvas.width = canvas.width;
    tcanvas.height = canvas.height;
    tctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed();
    trailDirty = true;
    if (head.has) {
      head.has = false;
    }
  }

  function seed() {
    var c = cfg();
    var n = Math.round(Math.min(c.max || 160, Math.max(36, (W * H) / (c.density || 15000))));
    stars = [];
    for (var i = 0; i < n; i++) {
      stars.push({
        x: Math.random() * W,
        y: Math.random() * H,
        z: 0.4 + Math.random() * 0.6,
        r: 0.5 + Math.random() * 1.2,
        tw: Math.random() * Math.PI * 2,
        sp: 0.00015 + Math.random() * 0.0003,
        vx: (Math.random() - 0.5) * 0.04,
        vy: (Math.random() - 0.5) * 0.03
      });
    }

    clusters = [];
    var cn = Math.max(3, Math.min(5, Math.round(W / 460)));
    for (var k = 0; k < cn; k++) {
      clusters.push({
        x: (0.14 + Math.random() * 0.72) * W,
        y: (0.12 + Math.random() * 0.76) * H,
        r: 95 + Math.random() * 85,
        ph: Math.random() * Math.PI * 2
      });
    }
    pulses = [];
    buildLinks();
  }

  function clusterWeight(x, y) {
    var w = 0;
    for (var i = 0; i < clusters.length; i++) {
      var c = clusters[i];
      var dx = x - c.x;
      var dy = y - c.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < c.r) w = Math.max(w, 1 - d / c.r);
    }
    return w;
  }

  function buildLinks() {
    var c = cfg();
    var dist = c.linkDist || 130;
    links = [];
    for (var a = 0; a < stars.length; a++) {
      for (var b = a + 1; b < stars.length; b++) {
        var dx = stars[a].x - stars[b].x;
        var dy = stars[a].y - stars[b].y;
        var d2 = dx * dx + dy * dy;
        if (d2 > dist * dist) continue;
        var k = 1 - Math.sqrt(d2) / dist;
        var w = Math.max(clusterWeight(stars[a].x, stars[a].y), clusterWeight(stars[b].x, stars[b].y));
        links.push([a, b, k * k * (1 + w * 1.6)]);
      }
    }
  }

  /* ------------------------------------------ 3. 随机脉冲暗线（星空闪烁） */
  function spawnPulse(ts) {
    if (pulses.length >= MAX_PULSES) return;
    var n = stars.length;
    if (n < 4) return;

    var i = (Math.random() * n) | 0;
    var a = stars[i];
    var reach = 210;

    /* 随机抽几个候选，挑一个够近的：省掉全量遍历 */
    var best = -1;
    var bestD = Infinity;
    for (var t = 0; t < 16; t++) {
      var j = (Math.random() * n) | 0;
      if (j === i) continue;
      var d = Math.abs(stars[j].x - a.x) + Math.abs(stars[j].y - a.y);
      if (d < reach && d < bestD) {
        bestD = d;
        best = j;
      }
    }
    if (best < 0) return;

    pulses.push({
      a: i,
      b: best,
      t0: ts,
      life: 900 + Math.random() * 1100
    });
  }

  /* --------------------------------------------------------------- 4. 星层 */
  function drawStars(ts) {
    starRaf = window.requestAnimationFrame(drawStars);

    var c = cfg();
    var dt = ts - lastStar;
    lastStar = ts;
    var minGap = 1000 / (c.maxFps || 30);
    starAcc += dt;
    if (starAcc < minGap) return;
    starAcc = 0;

    if (!c.on) {
      ctx.clearRect(0, 0, W, H);
      return;
    }

    var ox = pointer.px * 10;
    var oy = pointer.py * 8;

    ctx.clearRect(0, 0, W, H);

    /* --- 星点 --- */
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      s.x += s.vx * s.z;
      s.y += s.vy * s.z;
      if (s.x < -16) s.x = W + 16;
      if (s.x > W + 16) s.x = -16;
      if (s.y < -16) s.y = H + 16;
      if (s.y > H + 16) s.y = -16;

      var tw = 0.6 + Math.sin(ts * s.sp + s.tw) * 0.4;
      var cw = clusterWeight(s.x, s.y) * c.clusterA;
      var alpha = c.starA * tw * (0.35 + s.z * 0.6) * (0.8 + cw * 0.7);
      ctx.fillStyle = 'rgba(' + c.star + ',' + Math.min(1, alpha).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(s.x + ox * s.z, s.y + oy * s.z, s.r * s.z * (1 + cw * 0.45), 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- 固定暗连线 --- */
    for (var n = 0; n < links.length; n++) {
      var la = links[n];
      var sa = stars[la[0]];
      var sb = stars[la[1]];
      var lnA = la[2] * c.linkA * Math.min(sa.z, sb.z);
      if (lnA < 0.01) continue;
      ctx.strokeStyle = 'rgba(' + c.link + ',' + Math.min(0.5, lnA).toFixed(3) + ')';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(sa.x + ox * sa.z, sa.y + oy * sa.z);
      ctx.lineTo(sb.x + ox * sb.z, sb.y + oy * sb.z);
      ctx.stroke();
    }

    /* --- 随机脉冲暗线：亮起再消失 --- */
    if (c.pulseA > 0 && Math.random() < 0.6) spawnPulse(ts);
    for (var p = pulses.length - 1; p >= 0; p--) {
      var pu = pulses[p];
      var age = (ts - pu.t0) / pu.life;
      if (age >= 1) {
        pulses.splice(p, 1);
        continue;
      }
      var A = stars[pu.a];
      var B = stars[pu.b];
      /* sin 曲线：淡入 → 亮 → 淡出 */
      var k = Math.sin(Math.PI * age);
      var pa = k * c.pulseA * Math.min(1, 0.55 + Math.min(A.z, B.z) * 0.8);
      if (pa < 0.01) continue;
      ctx.strokeStyle = 'rgba(' + c.link + ',' + pa.toFixed(3) + ')';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      ctx.moveTo(A.x + ox * A.z, A.y + oy * A.z);
      ctx.lineTo(B.x + ox * B.z, B.y + oy * B.z);
      ctx.stroke();

      /* 两端各一点微光，像信号握手 */
      ctx.fillStyle = 'rgba(' + c.star + ',' + (pa * 1.2).toFixed(3) + ')';
      ctx.beginPath();
      ctx.arc(A.x + ox * A.z, A.y + oy * A.z, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(B.x + ox * B.z, B.y + oy * B.z, 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* --- 星座簇呼吸光 --- */
    for (var q = 0; q < clusters.length; q++) {
      var cl = clusters[q];
      var breathe = 0.5 + Math.sin(ts * 0.00026 + cl.ph) * 0.5;
      var gg = ctx.createRadialGradient(cl.x, cl.y, 0, cl.x, cl.y, cl.r);
      gg.addColorStop(0, 'rgba(' + c.link + ',' + (0.045 * breathe * c.clusterA).toFixed(3) + ')');
      gg.addColorStop(1, 'rgba(' + c.link + ',0)');
      ctx.fillStyle = gg;
      ctx.beginPath();
      ctx.arc(cl.x, cl.y, cl.r, 0, Math.PI * 2);
      ctx.fill();
    }

    if (++linkTick > 150) {
      linkTick = 0;
      buildLinks();
    }
  }

  /* ------------------------------------------- 5. 鼠标轨迹（阻尼 + 曲线） */
  function pushTrail(x, y, now) {
    trail.push({ x: x, y: y, t: now });
    if (trail.length > MAX_POINTS) trail.shift();
    lastPt = { x: x, y: y };
    trailDirty = true;
  }

  /* 阻尼笔尖：head 是笔尖，先追向光标，再按笔尖走过的路程落采样点。
     采样点就是笔尖经过的位置，所以后面的折线一定经过它们。 */
  function stepPen(ts, dt) {
    if (!pointer.active) {
      head.has = false;
      return;
    }

    if (!head.has) {
      head.x = pointer.x;
      head.y = pointer.y;
      head.has = true;
      lastPt = { x: head.x, y: head.y };
      trail.push({ x: head.x, y: head.y, t: ts });
      trailDirty = true;
      return;
    }

    /* 测速：上一帧到这一帧光标走了多少像素 / 每毫秒 */
    var rawSpeed = 0;
    if (prevPtr && dt > 0) {
      var pdx = pointer.x - prevPtr.x;
      var pdy = pointer.y - prevPtr.y;
      rawSpeed = Math.sqrt(pdx * pdx + pdy * pdy) / dt;
    }
    prevPtr = { x: pointer.x, y: pointer.y };

    /* 平滑一下，间距不会忽大忽小 */
    speedSm = speedSm * 0.82 + rawSpeed * 0.18;
    var t01 = Math.min(1, speedSm / SPEED_REF);
    sampleDist = SAMPLE_MIN + t01 * (SAMPLE_MAX - SAMPLE_MIN);

    var dx = pointer.x - head.x;
    var dy = pointer.y - head.y;
    var dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 320) {
      /* 大跳：笔尖直接过去并记一个点；这种位移本身就是「很快」，不要清零测速 */
      head.x = pointer.x;
      head.y = pointer.y;
      speedSm = Math.max(speedSm, SPEED_REF);
      if (lastPt) {
        lastPt = { x: head.x, y: head.y };
        trail.push({ x: head.x, y: head.y, t: ts });
        if (trail.length > MAX_POINTS) trail.shift();
        trailDirty = true;
      }
    } else {
      var k = 1 - Math.exp(-dt / 70); /* 70ms 时间常数：跟手但略有延迟 */
      head.x += dx * k;
      head.y += dy * k;
    }

    /* 按笔尖走过的距离落点 */
    if (!lastPt) {
      lastPt = { x: head.x, y: head.y };
      trail.push({ x: head.x, y: head.y, t: ts });
      trailDirty = true;
      return;
    }

    var sx = head.x - lastPt.x;
    var sy = head.y - lastPt.y;
    if (Math.sqrt(sx * sx + sy * sy) >= sampleDist) {
      lastPt = { x: head.x, y: head.y };
      trail.push({ x: head.x, y: head.y, t: ts });
      if (trail.length > MAX_POINTS) trail.shift();
      trailDirty = true;
    }
  }

  function drawTrail(ts) {
    trailRaf = window.requestAnimationFrame(drawTrail);
    if (reduce) return;

    var c = cfg();
    var dt = ts - lastTrail;
    lastTrail = ts;
    if (dt > 200) dt = 16; /* 标签切换回来时别一下跳太远 */

    var active = false;

    if (!c.on || !c.trail) {
      if (trailDirty) {
        tctx.clearRect(0, 0, W, H);
        trailDirty = false;
      }
      return;
    }

    stepPen(ts, dt);

    /* 丢掉过期的点 */
    var expired = false;
    while (trail.length && ts - trail[0].t > TRAIL_LIFE) {
      trail.shift();
      expired = true;
    }
    if (expired) trailDirty = true;

    if (!trail.length && !head.has) {
      if (trailDirty) {
        tctx.clearRect(0, 0, W, H);
        trailDirty = false;
      }
      return;
    }

    active = true;
    if (active) {
      tctx.clearRect(0, 0, W, H);

      /* 只连采样点：光标本身不出点、也不出线 */
      var pts = trail.slice();

      var n = pts.length;
      if (n >= 2) {
        tctx.lineCap = 'round';
        tctx.lineJoin = 'round';
        for (var i = 1; i < n; i++) {
          var a = pts[i - 1];
          var b = pts[i];
          var k = Math.max(0, 1 - (ts - b.t) / TRAIL_LIFE);
          var alpha = (0.16 + k * 0.9) * (c.linkA + 1.0) * rampIn(ts - b.t, 210);
          tctx.strokeStyle = 'rgba(' + c.link + ',' + Math.min(0.92, alpha).toFixed(3) + ')';
          tctx.lineWidth = 0.85 + k * 1.7;
          tctx.beginPath();
          tctx.moveTo(a.x, a.y);
          tctx.lineTo(b.x, b.y);
          tctx.stroke();
        }
      }

      /* 跳线：隔一两个点回连，织成三角网（第一版的感觉）。
         每对是否相连由时间戳算哈希决定 → 稳定不闪，但看起来是随机的。 */
      for (var m = 2; m < trail.length; m++) {
        var pa2 = trail[m];
        var ka2 = Math.max(0, 1 - (ts - pa2.t) / TRAIL_LIFE);
        if (ka2 < 0.14) continue;
        for (var back = 2; back <= 4; back++) {
          var jj = m - back;
          if (jj < 0) continue;
          var pb2 = trail[jj];
          var ddx = pa2.x - pb2.x;
          var ddy = pa2.y - pb2.y;
          var dd = Math.sqrt(ddx * ddx + ddy * ddy);
          if (dd > 265 || dd < 8) continue;

          var roll = Math.abs(Math.sin(pb2.t * 0.0013 + back * 1.7 + m * 0.37));
          if (roll > 0.82) continue;

          var kb2 = Math.max(0, 1 - (ts - pb2.t) / TRAIL_LIFE);
          var la2 = ka2 * kb2 * (0.7 - dd / 520) * rampIn(ts - Math.max(pa2.t, pb2.t), 260);
          if (la2 < 0.02) continue;

          tctx.strokeStyle = 'rgba(' + c.link + ',' + Math.min(0.62, la2).toFixed(3) + ')';
          tctx.lineWidth = 0.8;
          tctx.beginPath();
          tctx.moveTo(pa2.x, pa2.y);
          tctx.lineTo(pb2.x, pb2.y);
          tctx.stroke();
        }
      }

      /* 牵引线：最新采样点连到附近星点，让轨迹和星场咬在一起 */
      var anchor = trail.length ? trail[trail.length - 1] : null;
      if (anchor) {
        for (var si = 0; si < stars.length; si++) {
          var st = stars[si];
          var qx = st.x - anchor.x;
          var qy = st.y - anchor.y;
          var qd = Math.sqrt(qx * qx + qy * qy);
          if (qd > 175) continue;
          var qa = (1 - qd / 175) * 0.5 * rampIn(ts - anchor.t, 240);
          tctx.strokeStyle = 'rgba(' + c.link + ',' + qa.toFixed(3) + ')';
          tctx.lineWidth = 0.75;
          tctx.beginPath();
          tctx.moveTo(anchor.x, anchor.y);
          tctx.lineTo(st.x, st.y);
          tctx.stroke();

          tctx.fillStyle = 'rgba(' + c.star + ',' + (qa * 1.8).toFixed(3) + ')';
          tctx.beginPath();
          tctx.arc(st.x, st.y, 1.4, 0, Math.PI * 2);
          tctx.fill();
        }
      }

      /* 采样点：方点 + 斜十字，像星座里的节点 */
      for (var j = 0; j < trail.length; j++) {
        var pt = trail[j];
        var kp = Math.max(0, 1 - (ts - pt.t) / TRAIL_LIFE);
        if (kp <= 0.04) continue;

        var sz = 2.4 + kp * 2.8;
        tctx.fillStyle = 'rgba(' + c.star + ',' + (kp * 0.95 * rampIn(ts - pt.t, 190)).toFixed(3) + ')';
        tctx.fillRect(pt.x - sz / 2, pt.y - sz / 2, sz, sz);

      }


      trailDirty = false;
    }
  }

  /* ------------------------------------------------------------ 6. 指针 */
  function bindPointer() {
    window.addEventListener(
      'pointermove',
      function (e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        pointer.active = true;
        pointer.px = (e.clientX / window.innerWidth - 0.5) * 2;
        pointer.py = (e.clientY / window.innerHeight - 0.5) * 2;
        var root = document.documentElement;
        root.style.setProperty('--mx', pointer.px.toFixed(3));
        root.style.setProperty('--my', pointer.py.toFixed(3));
      },
      { passive: true }
    );
    /* 手机：手指拖动同样驱动轨迹（触摸没有 hover，抬起就停） */
    function onTouch(e) {
      var t = e.touches && e.touches[0];
      if (!t) return;
      pointer.x = t.clientX;
      pointer.y = t.clientY;
      pointer.active = true;
      pointer.px = (t.clientX / window.innerWidth - 0.5) * 2;
      pointer.py = (t.clientY / window.innerHeight - 0.5) * 2;
      var root = document.documentElement;
      root.style.setProperty('--mx', pointer.px.toFixed(3));
      root.style.setProperty('--my', pointer.py.toFixed(3));
    }
    window.addEventListener('touchstart', onTouch, { passive: true });
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener(
      'touchend',
      function () {
        pointer.active = false;
        cursor.has = false;
      },
      { passive: true }
    );
    window.addEventListener(
      'touchcancel',
      function () {
        pointer.active = false;
        cursor.has = false;
      },
      { passive: true }
    );

    window.addEventListener(
      'pointerleave',
      function () {
        pointer.active = false;
        pointer.px = 0;
        pointer.py = 0;
        cursor.has = false;
        document.documentElement.style.setProperty('--mx', '0');
        document.documentElement.style.setProperty('--my', '0');
      },
      { passive: true }
    );
  }

  /* ------------------------------------------- 7. 视口角标 / 刻度轨 / 渐晕 */
  function buildLayers() {
    if (!document.querySelector('.sf-vignette')) {
      var v = document.createElement('div');
      v.className = 'sf-vignette';
      v.setAttribute('aria-hidden', 'true');
      document.body.appendChild(v);
    }
    if (!document.querySelector('.sf-frame')) {
      var f = document.createElement('div');
      f.className = 'sf-frame';
      f.setAttribute('aria-hidden', 'true');
      f.innerHTML = '<i></i><i></i><i></i><i></i>';
      document.body.appendChild(f);
    }
    if (!document.querySelector('.sf-rail')) {
      var r = document.createElement('div');
      r.className = 'sf-rail';
      r.setAttribute('aria-hidden', 'true');
      document.body.appendChild(r);
    }
  }

  /* ----------------------------------------------------------------- 8. 启动 */
  function boot() {
    sizeCanvas();
    buildLayers();
    bindPointer();

    lastStar = performance.now();
    lastTrail = lastStar;

    cancelAnimationFrame(starRaf);
    cancelAnimationFrame(trailRaf);
    starRaf = requestAnimationFrame(drawStars);
    trailRaf = requestAnimationFrame(drawTrail);

    var rt = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(rt);
        rt = setTimeout(sizeCanvas, 180);
      },
      { passive: true }
    );

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        cancelAnimationFrame(starRaf);
        cancelAnimationFrame(trailRaf);
        starRaf = 0;
        trailRaf = 0;
      } else {
        lastStar = performance.now();
        lastTrail = lastStar;
        if (!starRaf) starRaf = requestAnimationFrame(drawStars);
        if (!trailRaf) trailRaf = requestAnimationFrame(drawTrail);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.__SF_ATMOSPHERE__ = {
    debug: function () {
      return {
        trail: trail.length,
        sampleDist: Math.round(sampleDist),
        pulses: pulses.length,
        stars: stars.length,
        links: links.length,
        clusters: clusters.length,
        orb: document.querySelectorAll('.sf-orb').length,
        theme: (document.body && document.body.dataset.theme) || 'day'
      };
    },
    refresh: function () {
      trail.length = 0;
      lastPt = null;
      trailDirty = true;
      head.has = false;
      prevPtr = null;
      speedSm = 0;
      sampleDist = SAMPLE_MIN;
      if (!starRaf) starRaf = requestAnimationFrame(drawStars);
      if (!trailRaf) trailRaf = requestAnimationFrame(drawTrail);
    }
  };
})();
