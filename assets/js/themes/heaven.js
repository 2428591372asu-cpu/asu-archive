/* ==========================================================================
   A_SU ARCHIVE — 天域主题氛围层（AETHER ATMOSPHERE）
   --------------------------------------------------------------------------
   配合 assets/css/themes/heaven.css 的冷白海报语言，做三件事：
   · 白鸽群：小、密、飘，缓慢上升并轻微摆动（canvas）
   · 玻璃碎片：三块几何剪影，随指针做极轻的视差（CSS 定位 + JS 位移）
   · 放射线：纯 CSS 旋转，这里不碰

   只在 body[data-theme="heaven"] 时活动；prefers-reduced-motion 只画一帧。
   ========================================================================== */
(function () {
  'use strict';

  var reduce =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var FPS = 30;
  var DOVES = 46;

  var canvas = null;
  var ctx = null;
  var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  var W = 0;
  var H = 0;

  var birds = [];
  var shards = [];
  var raf = 0;
  var last = 0;
  var acc = 0;
  var px = 0;
  var py = 0;
  var tpx = 0;
  var tpy = 0;

  function active() {
    return document.body && document.body.dataset.theme === 'heaven';
  }

  /* ------------------------------------------------------- 1. 建静态图层 */
  function buildLayers() {
    if (!document.querySelector('.hv-rays')) {
      var r = document.createElement('div');
      r.className = 'hv-rays';
      r.setAttribute('aria-hidden', 'true');
      document.body.appendChild(r);
    }

    shards = [];
    ['a', 'b', 'c'].forEach(function (k) {
      var el = document.querySelector('.hv-shard--' + k);
      if (!el) {
        el = document.createElement('div');
        el.className = 'hv-shard hv-shard--' + k;
        el.setAttribute('aria-hidden', 'true');
        document.body.appendChild(el);
      }
      shards.push(el);
    });

    if (!document.querySelector('.hv-doves')) {
      canvas = document.createElement('canvas');
      canvas.className = 'hv-doves';
      canvas.setAttribute('aria-hidden', 'true');
      document.body.appendChild(canvas);
      ctx = canvas.getContext('2d', { alpha: true });
    } else {
      canvas = document.querySelector('.hv-doves');
      ctx = canvas.getContext('2d', { alpha: true });
    }
  }

  /* --------------------------------------------------------- 2. 白鸽群 */
  function seedBirds() {
    var want = Math.min(DOVES, Math.round((W * H) / 26000) + 18);
    birds = [];
    for (var i = 0; i < want; i++) {
      var depth = Math.random(); /* 0 = 远，1 = 近 */
      birds.push({
        x: Math.random() * W,
        y: Math.random() * H,
        s: 4 + depth * 11, /* 半翼展 */
        vx: (0.004 + Math.random() * 0.008) * (0.5 + depth),
        vy: -(0.006 + Math.random() * 0.014) * (0.5 + depth),
        a: 0.16 + depth * 0.34,
        ph: Math.random() * Math.PI * 2,
        flap: 0.0006 + Math.random() * 0.0012
      });
    }
  }

  function drawBird(b, ts) {
    /* 经典「海鸥」两笔剪影：远看就是一羽鸽子 */
    var s = b.s;
    var flap = 1 + Math.sin(ts * b.flap + b.ph) * 0.22;
    var x = b.x + Math.sin(ts * 0.0005 + b.ph) * 8;
    var y = b.y;

    ctx.beginPath();
    ctx.moveTo(x - s, y);
    ctx.quadraticCurveTo(x - s * 0.42, y - s * 0.82 * flap, x, y - s * 0.14);
    ctx.quadraticCurveTo(x + s * 0.42, y - s * 0.82 * flap, x + s, y);
    ctx.quadraticCurveTo(x + s * 0.4, y - s * 0.1, x, y + s * 0.44);
    ctx.quadraticCurveTo(x - s * 0.4, y - s * 0.1, x - s, y);
    ctx.closePath();

    ctx.fillStyle = 'rgba(30,62,86,' + b.a.toFixed(3) + ')';
    ctx.fill();
  }

  function resize() {
    if (!canvas) return;
    W = canvas.clientWidth || window.innerWidth;
    H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    seedBirds();
  }

  function paint(ts) {
    if (!ctx) return;
    ctx.clearRect(0, 0, W, H);
    for (var i = 0; i < birds.length; i++) drawBird(birds[i], ts);
  }

  /* ------------------------------------------------------------- 3. 循环 */
  function loop(ts) {
    raf = window.requestAnimationFrame(loop);

    var dt = ts - last;
    last = ts;
    if (dt > 200) dt = 16;

    if (!active()) return;

    px += (tpx - px) * Math.min(1, dt * 0.0032);
    py += (tpy - py) * Math.min(1, dt * 0.0032);

    if (shards.length) {
      shards[0].style.translate = (px * 9).toFixed(1) + 'px ' + (py * 7).toFixed(1) + 'px';
      shards[1].style.translate = (px * -6).toFixed(1) + 'px ' + (py * 5).toFixed(1) + 'px';
      shards[2].style.translate = (px * 5).toFixed(1) + 'px ' + (py * -6).toFixed(1) + 'px';
    }

    acc += dt;
    if (acc < 1000 / FPS) return;
    var step = acc;
    acc = 0;

    if (reduce) {
      paint(ts);
      return;
    }

    for (var i = 0; i < birds.length; i++) {
      var b = birds[i];
      b.x += b.vx * step;
      b.y += b.vy * step;
      if (b.y < -30) {
        b.y = H + 30;
        b.x = Math.random() * W;
      }
      if (b.x > W + 40) b.x = -40;
    }
    paint(ts);
  }

  /* ------------------------------------------------------------- 4. 启动 */
  function bindPointer() {
    function move(x, y) {
      tpx = (x / window.innerWidth - 0.5) * 2;
      tpy = (y / window.innerHeight - 0.5) * 2;
    }
    window.addEventListener(
      'pointermove',
      function (e) {
        move(e.clientX, e.clientY);
      },
      { passive: true }
    );
    window.addEventListener(
      'touchmove',
      function (e) {
        var t = e.touches && e.touches[0];
        if (t) move(t.clientX, t.clientY);
      },
      { passive: true }
    );
  }

  function boot() {
    buildLayers();
    resize();
    bindPointer();
    last = performance.now();
    if (!raf) raf = window.requestAnimationFrame(loop);

    var rt = 0;
    window.addEventListener(
      'resize',
      function () {
        clearTimeout(rt);
        rt = setTimeout(resize, 220);
      },
      { passive: true }
    );

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
        if (active()) paint(last);
      },
      debug: function () {
        return {
          rays: !!document.querySelector('.hv-rays'),
          doves: birds.length,
          shards: shards.length,
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
