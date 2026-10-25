/* ==========================================================================
   site.js — 渲染与交互
   依赖 data.js 里的 window.ARCHIVE，不需要任何框架 / 构建工具
   ========================================================================== */
(function () {
  'use strict';

  var D = window.ARCHIVE;

/* ---------------------------------------------------------------- 界面文字 */
function L(path, fallback) {
  var v = (D && D.labels) || {};
  var ks = String(path).split('.');
  for (var i = 0; i < ks.length; i++) { v = (v == null) ? v : v[ks[i]]; }
  return (typeof v === 'string' && v) ? v : (fallback || '');
}
function applyLabels() {
  $$('[data-label]').forEach(function (el) {
    var v = L(el.getAttribute('data-label'), null);
    if (v) el.textContent = v;
  });
  $$('[data-label-html]').forEach(function (el) {
    var v = L(el.getAttribute('data-label-html'), null);
    if (v) el.innerHTML = esc(v);
  });
  $$('[data-label-short]').forEach(function (el) {
    var v = L(el.getAttribute('data-label-short'), null);
    if (v) el.setAttribute('data-short', v);
  });
  var ti = ((D.labels || {}).titles || {})[document.body.dataset.page || 'index'];
  if (ti) document.title = ti;
}
  if (!D) return;

  var IMG = 'assets/img/';
  /* 单文件构建时 window.__IMG__ 里是 base64；正常目录版继续走 assets/img/ */
  function img(file) {
    if (window.__IMG__ && window.__IMG__[file]) return window.__IMG__[file];
    /* 图片放在 assets/img/gallery/<主文件夹>/ 里，由 tools/scan-gallery.mjs 登记路径 */
    if (window.GALLERY_MAP && window.GALLERY_MAP[file]) return IMG + window.GALLERY_MAP[file];
    return IMG + file;
  }
  /* 单文件构建时 window.__ARCHIVE_ROUTE__ 接管页面切换；目录版直接跳转。
     不要再铺转场层——跳转本身够快，加过渡只会闪。 */
  function nav(href) {
    if (typeof window.__ARCHIVE_ROUTE__ === 'function') { window.__ARCHIVE_ROUTE__(href); return; }
    window.location.href = href;
  }  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------------------- 主题开关 */
  var THEME_KEY = 'asu-archive-theme';
  var themeTimer = 0;

  function readTheme() {
    var t = null;
    try { t = window.localStorage.getItem(THEME_KEY); } catch (e) { t = null; }
    if (!t) {
      var m = /(?:\?|&)theme=(day|night|scifi)/.exec(location.search);
      if (m) t = m[1];
    }
    return t === 'night' || t === 'scifi' ? t : 'day';
  }

  function applyTheme(t) {
    document.body.dataset.theme = t;
    var scifi = t === 'scifi';
    var night = t === 'night';

    var btn = $('#themeToggle');
    if (btn) {
      btn.classList.toggle('is-night', night);
      btn.setAttribute('aria-pressed', night ? 'true' : 'false');
      btn.setAttribute('aria-label', night ? '切换到白天模式' : '切换到夜晚模式');
      var lb = btn.querySelector('.theme-toggle__label');
      if (lb) lb.textContent = scifi ? 'SCI-FI' : night ? 'NIGHT' : 'DAY';
    }

    /* 星域按钮：只在星域主题下点亮 */
    var skin = $('#skinToggle');
    if (skin) {
      skin.classList.toggle('is-on', scifi);
      skin.setAttribute('aria-pressed', scifi ? 'true' : 'false');
      skin.setAttribute('aria-label', scifi ? '退出星域主题（回到白天/夜晚）' : '切换到星域主题');
      var sl = skin.querySelector('.skin-toggle__label');
      if (sl) sl.textContent = '星域';
    }

    if (scifi) unlockScifi();
    document.body.classList.toggle('is-unlocked', unlocked || scifi);

    if (window.__SF_ATMOSPHERE__) window.__SF_ATMOSPHERE__.refresh();
  }

  /* 记住进入星域之前是白天还是黑夜，退出时回到原处 */
  var SF_PREV = 'night';
  try {
    var pv = window.localStorage.getItem(THEME_KEY + ':prev');
    if (pv === 'day' || pv === 'night') SF_PREV = pv;
  } catch (e) {}

  /* ---------- 星域是彩蛋：默认隐藏，解锁后才出现 ---------- */
  var unlocked = false;
  try {
    unlocked = window.localStorage.getItem(THEME_KEY + ':unlock') === '1';
  } catch (e) {}

  function unlockScifi() {
    if (unlocked) return;
    unlocked = true;
    document.body.classList.add('is-unlocked');
    try { window.localStorage.setItem(THEME_KEY + ':unlock', '1'); } catch (e) {}
  }

  function initTheme() {
    /* 彩蛋：在任何地方敲 star */
    var seq = '';
    document.addEventListener('keydown', function (e) {
      if (!e.key || e.key.length !== 1 || !/[a-z]/i.test(e.key)) return;
      seq = (seq + e.key.toLowerCase()).slice(-4);
      if (seq === 'star') unlockScifi();
    });

    var start = readTheme();
    if (start === 'scifi') { SF_PREV = 'night'; unlockScifi(); }
    applyTheme(start);

    var skin = $('#skinToggle');
    if (skin) {
      skin.addEventListener('click', function () {
        var now = document.body.dataset.theme;
        if (now !== 'scifi') SF_PREV = now === 'day' ? 'day' : 'night';
        var next = now === 'scifi' ? SF_PREV : 'scifi';
        document.body.classList.add('is-theming');
        applyTheme(next);
        try {
          window.localStorage.setItem(THEME_KEY, next);
          window.localStorage.setItem(THEME_KEY + ':prev', SF_PREV);
        } catch (err) {}
        window.clearTimeout(themeTimer);
        themeTimer = window.setTimeout(function () {
          document.body.classList.remove('is-theming');
        }, 700);
      });
    }

    var btn = $('#themeToggle');
    if (!btn) return;

    /* 手机端彩蛋：1.4 秒内连点 5 次主题按钮 → 解锁星域并直接进入 */
    var taps = 0;
    var tapTimer = 0;

    btn.addEventListener('click', function () {
      taps++;
      window.clearTimeout(tapTimer);
      tapTimer = window.setTimeout(function () { taps = 0; }, 1400);
      if (taps >= 5) {
        taps = 0;
        unlockScifi();
        document.body.classList.add('is-theming');
        applyTheme('scifi');
        try { window.localStorage.setItem(THEME_KEY, 'scifi'); } catch (e) {}
        window.clearTimeout(themeTimer);
        themeTimer = window.setTimeout(function () {
          document.body.classList.remove('is-theming');
        }, 700);
        return;
      }

      var now = document.body.dataset.theme;
      var next = now === 'night' ? 'day' : 'night';
      document.body.classList.add('is-theming');
      applyTheme(next);
      try { window.localStorage.setItem(THEME_KEY, next); } catch (e) {}
      window.clearTimeout(themeTimer);
      themeTimer = window.setTimeout(function () {
        document.body.classList.remove('is-theming');
      }, 640);
    });
  }

  window.__ARCHIVE_EASTER__ = {
    unlock: unlockScifi,
    isUnlocked: function () { return unlocked; }
  };

  /* 图片加载失败时的兜底（本地删了图也不会整块塌掉） */
  document.addEventListener('error', function (e) {
    var t = e.target;
    if (!t || t.tagName !== 'IMG' || t.dataset.broken) return;
    t.dataset.broken = '1';
    var box = document.createElement('div');
    box.className = 'img-missing';
    box.textContent = 'IMAGE NOT FOUND · ' + (t.dataset.file || '');
    t.replaceWith(box);
  }, true);

  /* ---------------------------------------------------------------- 数字统计 */
  function stats() {
    var files = {}, cats = {}, slots = 0;
    D.characters.forEach(function (c) {
      c.images.forEach(function (i) { files[i.file] = 1; cats[i.cat] = 1; });
      D.together.forEach(function (i) { files[i.file] = 1; });
      slots += (c.emptySlots || []).length;
    });
    D.categories.forEach(function (c) { cats[c] = 1; });
    return {
      chars: D.characters.length,
      files: Object.keys(files).length,
      cats: Object.keys(cats).length,
      slots: slots
    };
  }
  var pad2 = function (n) { return (n < 10 ? '0' : '') + n; };
  /* 「A_SU」和「A_su」这种同名中英写法，只显示一次 */
  var sameName = function (c) {
    return String(c.name).toLowerCase() === String(c.latin).toLowerCase();
  };

  /* ---------------------------------------------------------------- 载入过场 */
  function initBoot() {
    var boot = $('#boot');
    if (!boot) return;
    var pctEl = $('#bootPct'), barEl = $('#bootBar'), urlEl = $('#bootUrl');
    if (urlEl) {
      urlEl.textContent = location.protocol === 'file:'
        ? 'FILE://LOCAL/'
        : location.origin.toUpperCase() + '/';
    }

    var closed = false;
    function done() {
      if (closed) return;
      closed = true;
      boot.classList.add('is-done');
      window.setTimeout(function () { if (boot.parentNode) boot.remove(); }, 800);
    }

    var t0 = performance.now(), dur = 900;
    function tick(now) {
      if (closed) return;
      var t = Math.min(1, (now - t0) / dur);
      var v = Math.round((1 - Math.pow(1 - t, 3)) * 100);
      if (pctEl) pctEl.textContent = v;
      if (barEl) barEl.style.width = v + '%';
      if (t < 1) window.requestAnimationFrame(tick);
      else window.setTimeout(done, 180);
    }
    window.requestAnimationFrame(tick);

    window.setTimeout(done, 2600);            /* 兜底 */
    boot.addEventListener('click', done);
    window.addEventListener('keydown', done, { once: true });
  }

  /* ---------------------------------------------------------------- 顶栏 */
  function initTopbar() {
    var bar = $('#topbar');
    if (!bar) return;
    var tick = function () {
      if (window.scrollY > 24) bar.classList.add('is-stuck');
      else bar.classList.remove('is-stuck');
    };
    tick();
    window.addEventListener('scroll', tick, { passive: true });
  }

  /* ---------------------------------------------------------------- 鼠标视差 */
  function initParallax() {
    var bg = $('.hero__bg');
    if (!bg || reduceMotion) return;
    if (window.matchMedia('(hover: none)').matches) return;
    var raf = 0, tx = 0, ty = 0;
    window.addEventListener('pointermove', function (e) {
      tx = (e.clientX / window.innerWidth - 0.5) * -20;
      ty = (e.clientY / window.innerHeight - 0.5) * -14;
      if (raf) return;
      raf = window.requestAnimationFrame(function () {
        raf = 0;
        bg.style.setProperty('--px', tx.toFixed(1) + 'px');
        bg.style.setProperty('--py', ty.toFixed(1) + 'px');
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------------------- 滚动进场 */
  var io = null;
  function initReveal() {
    var items = $$('[data-reveal]').filter(function (el) { return !el.dataset.observed; });
    items.forEach(function (el) { el.dataset.observed = '1'; });
    if (!('IntersectionObserver' in window) || reduceMotion) {
      items.forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    if (!io) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) {
            en.target.classList.add('is-in');
            io.unobserve(en.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px', threshold: 0.06 });
    }
    items.forEach(function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------------------- 灯箱 */
  var LB = (function () {
    var root, imgEl, tEl, sEl, cEl, totEl, catEl, prevB, nextB, closeB;
    var list = [], idx = 0, lastFocus = null, bound = false;

    function build() {
      root = document.createElement('div');
      root.className = 'lb';
      root.id = 'lb';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', '图集预览');
      root.innerHTML =
        '<div class="lb__top"><span><b id="lbCount">01</b> / <span id="lbTotal">01</span></span>' +
        '<span id="lbCat">—</span></div>' +
        '<div class="lb__stage"><img class="lb__img" id="lbImg" alt=""></div>' +
        '<div class="lb__bar">' +
          '<div class="lb__meta"><div class="t" id="lbTitle"></div><div class="s" id="lbNote"></div></div>' +
          '<div class="lb__nav">' +
            '<button class="lb__btn" id="lbPrev" aria-label="上一张">&lsaquo;</button>' +
            '<button class="lb__btn" id="lbNext" aria-label="下一张">&rsaquo;</button>' +
            '<button class="lb__btn" id="lbClose" aria-label="关闭">&times;</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(root);

      imgEl = $('#lbImg', root); tEl = $('#lbTitle', root); sEl = $('#lbNote', root);
      cEl = $('#lbCount', root); totEl = $('#lbTotal', root); catEl = $('#lbCat', root);
      prevB = $('#lbPrev', root); nextB = $('#lbNext', root); closeB = $('#lbClose', root);

      prevB.addEventListener('click', function () { step(-1); });
      nextB.addEventListener('click', function () { step(1); });
      closeB.addEventListener('click', close);
      root.addEventListener('click', function (e) {
        if (e.target === root || e.target.classList.contains('lb__stage')) close();
      });
    }

    function draw() {
      var it = list[idx];
      if (!it) return;
      imgEl.dataset.file = it.file;
      imgEl.src = img(it.file);
      imgEl.alt = it.title || '';
      tEl.textContent = it.title || '';
      sEl.textContent = it.note || '';
      catEl.textContent = it.cat || 'ARCHIVE';
      cEl.textContent = pad2(idx + 1);
      totEl.textContent = pad2(list.length);
      var single = list.length < 2;
      prevB.disabled = single; nextB.disabled = single;
      cEl.parentNode.style.visibility = '';
      if (single) { prevB.style.visibility = 'hidden'; nextB.style.visibility = 'hidden'; }
      else { prevB.style.visibility = ''; nextB.style.visibility = ''; }
    }

    function step(d) {
      if (list.length < 2) return;
      idx = (idx + d + list.length) % list.length;
      draw();
    }

    function open(items, start) {
      if (!items || !items.length) return;
      if (!root) build();
      list = items; idx = start || 0;
      lastFocus = document.activeElement;
      document.body.classList.add('is-locked');
      root.classList.add('is-open');
      draw();
      if (!bound) {
        bound = true;
        document.addEventListener('keydown', function (e) {
          if (!root.classList.contains('is-open')) return;
          if (e.key === 'Escape') { e.preventDefault(); close(); }
          else if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
          else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        });
      }
      window.setTimeout(function () { closeB.focus(); }, 60);
    }

    function close() {
      if (!root) return;
      root.classList.remove('is-open');
      document.body.classList.remove('is-locked');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    return { open: open, close: close };
  })();

  /* ---------------------------------------------------------------- 首页大图轮换 */
  function initHeroSlides(h) {
    var raw = (h.slides && h.slides.length) ? h.slides : [h.image];
    var slides = raw.map(function (s) {
      return typeof s === 'string'
        ? { file: s, art: false, char: '' }
        : { file: s.file, art: !!s.art, char: s.char || '', pos: s.pos || '', tone: s.tone || '' };
    });
    var heroEl = $('#index');
    function paintSlideMeta(s) {
      if (!heroEl) return;
      heroEl.dataset.slide = s.art ? 'art' : 'photo';
      if (s.art && s.char) heroEl.dataset.slideChar = s.char;
      else delete heroEl.dataset.slideChar;
    }
    var layers = $$('.hero__slide');
    var nav = $('#heroNav');
    var dotsWrap = $('#heroDots');
    if (!layers.length) return;

    layers.forEach(function (l, i) {
      var s0 = slides[Math.min(i, slides.length - 1)];
      /* 只有第一张立刻加载，其余等轮换时再取，避免一次拉满 */
      if (i === 0) {
        l.src = img(s0.file);
        l.dataset.file = s0.file;
        l.dataset.kind = s0.art ? 'art' : 'photo';
        l.dataset.tone = s0.tone || '';
        if (s0.pos) l.style.objectPosition = s0.pos;
        paintSlideMeta(s0);
      }
      l.alt = '双人插画';
    });
    layers[0].classList.add('is-on');
    if (layers[1]) layers[1].classList.remove('is-on');

    if (slides.length < 2 || !nav) return;

    var active = 0, cur = 0, timer = 0, paused = false;
    var every = h.slideInterval || 20000;

    function paintDots() {
      if (!dotsWrap) return;
      if (!dotsWrap.children.length) {
        dotsWrap.innerHTML = slides.map(function () { return '<i></i>'; }).join('');
      }
      $$('i', dotsWrap).forEach(function (d, i) {
        d.classList.toggle('is-on', i === cur);
      });
    }

    function arm() {
      window.clearInterval(timer);
      if (paused || reduceMotion) return;
      timer = window.setInterval(function () { go(1); }, every);
    }

    function go(dir) {
      var next = (cur + dir + slides.length) % slides.length;
      var back = layers[1 - active];
      var front = layers[active];
      var ns = slides[next];
      var src = img(ns.file);

      function swap() {
        back.dataset.kind = ns.art ? 'art' : 'photo';
        back.dataset.tone = ns.tone || '';
        back.dataset.file = ns.file;
        back.style.objectPosition = ns.pos || '';
        back.src = src;
        paintSlideMeta(ns);
        back.classList.add('is-on');
        front.classList.remove('is-on');
        active = 1 - active;
        cur = next;
        paintDots();
      }

      /* 先把下一张解码好再换层，否则换的瞬间这一层是空白，会闪一下 */
      var done = false;
      function once() { if (done) return; done = true; swap(); arm(); }
      var pre = new Image();
      pre.onload = once;
      pre.onerror = once;
      pre.src = src;
      if (pre.complete) once();
    }

    nav.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.hero__arrow') : null;
      if (!btn) return;
      go(Number(btn.dataset.dir) || 1);
    });

    /* 鼠标进到主视觉里先暂停自动轮换，方便手动翻 */
    var hero = $('#index');
    if (hero) {
      hero.addEventListener('mouseenter', function () { paused = true; window.clearInterval(timer); });
      hero.addEventListener('mouseleave', function () { paused = false; arm(); });
    }

    paintDots();
    arm();
  }

  /* ---------------------------------------------------------------- 通用片段 */
  function imgTag(file, alt, cls, extra) {
    return '<img class="' + cls + ' js-lazy" src="' + img(file) + '" alt="' + esc(alt) + '"' +
      ' data-file="' + esc(file) + '" loading="lazy" decoding="async" ' + (extra || '') + '>';
  }

  /* 多图角标：两个重叠的方框 + 张数，用在系列封面上 */
  function countBadge(n) {
    return '<span class="gitem__count" title="多图 · ' + n + ' 张">' +
      '<svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">' +
      '<rect x="1.7" y="1.7" width="9.2" height="9.2" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4"/>' +
      '<rect x="5.6" y="5.6" width="8.7" height="8.7" rx="1.5" fill="currentColor" fill-opacity=".22" stroke="currentColor" stroke-width="1.4"/>' +
      '</svg><b>' + pad2(n) + '</b></span>';
  }

  function fieldHTML(f) {
    var v;
    if (f.v == null || f.v === '') {
      v = '<span class="tbd" title="尚未补充">' + esc(L('hints.tbd', '待补充')) + '</span>';
    } else if (f.link) {
      v = '<a href="character.html?id=' + encodeURIComponent(f.link) + '">' + esc(f.v) + '</a>';
    } else {
      v = esc(f.v);
    }
    return '<div class="field' + (f.wide ? ' field--wide' : '') + '">' +
      '<div class="field__k">' + esc(f.k) + '</div>' +
      '<div class="field__v">' + v + '</div></div>';
  }

  function sectionHead(idx, cn, en, meta, reveal) {
    return '<div class="section-head" data-reveal><div class="section-head__idx"><i></i>' + idx + '</div>' +
      '<div class="section-head__t"><h2>' + esc(cn) + '</h2><span>' + esc(en) + '</span></div>' +
      '<div class="section-head__meta">' + (meta || '') + '</div></div>';
  }

  /* ==========================================================================
     首页
     ========================================================================== */
  function renderIndex() {
    var h = D.hero, s = stats();

    /* 回首页：强调色退回灰色（主题由右上角开关决定，这里不动） */
    delete document.body.dataset.char;
    delete document.body.dataset.surface;

    initHeroSlides(h);
    $('#heroLabel').textContent = h.label;
    $('#heroTitle').innerHTML =
      '<span class="hero__title-l1 t-off" data-text="' + esc(h.title1) + '">' + esc(h.title1) + '</span>' +
      '<span class="hero__title-l2">' + esc(h.title2) + '</span>';
    $('#heroCn').innerHTML = esc(h.cn) + ' <em>/</em> ' + D.characters.length + ' CHARACTERS';
    $('#heroLead').textContent = h.lead;

    $('#heroStats').innerHTML = [
      [pad2(s.chars), L('stats.0', '角色')],
      [pad2(s.files), L('stats.1', '图集')],
      [pad2(s.cats), L('stats.2', '分类')],
      [pad2(s.slots), L('stats.3', '预留空位')]
    ].map(function (row) {
      return '<div class="hero__stat"><b>' + row[0] + '</b><span>' + row[1] + '</span></div>';
    }).join('');

    /* 索引条目与展开面板由 Duo.init() 渲染 */

    /* 双人图集 */
    var folderT = (window.GALLERY && window.GALLERY.together) || null;
    var togetherList = folderT
      ? folderT.map(function (it) {
          var isSeries = it.type === 'series';
          return {
            file: isSeries ? it.cover : it.file,
            title: it.title,
            note: it.note || (isSeries ? it.count + ' 张一组' : ''),
            cat: '合作 / TOGETHER',
            series: isSeries ? it.files : null,
            count: isSeries ? it.count : 0
          };
        })
      : D.together.map(function (t) {
          return { file: t.file, title: t.title, note: t.note, cat: '合作 / TOGETHER', series: null, count: 0 };
        });
    var togetherItems = togetherList.map(function (t) {
      return { file: t.file, title: t.title, note: t.note, cat: t.cat };
    });
    /* 双人图集：分页（每页 8 张，2 行 × 4 列），图再多也不会把页面拉长到滑不动 */
    var PER_PAGE = 8;
    var pageCount = Math.max(1, Math.ceil(togetherList.length / PER_PAGE));
    var page = 1;

    function paintShots() {
      var start = (page - 1) * PER_PAGE;
      var slice = togetherList.slice(start, start + PER_PAGE);
      $('#shots').innerHTML = slice.map(function (t, i) {
        var gi = start + i;
        return '<figure class="shot" role="button" tabindex="0" data-shot="' + gi + '"' +
          ' aria-label="查看 ' + esc(t.title) + '">' +
          imgTag(t.file, t.title, '') +
          (t.count ? countBadge(t.count) : '') +
        '<figcaption class="shot__bar"><span class="shot__no">' + pad2(gi + 1) + '</span>' +
          '<span>' + esc(t.title) + ' · ' + esc(t.note) + '</span></figcaption></figure>';
      }).join('');

      $$('#shots .shot').forEach(function (el) {
        var open = function () {
          var it = togetherList[Number(el.dataset.shot)];
          if (it && it.series && it.series.length) {
            LB.open(it.series.map(function (f, k) {
              return { file: f, title: it.title + ' · ' + pad2(k + 1), note: it.note || '', cat: it.cat };
            }), 0);
            return;
          }
          LB.open(togetherItems, Number(el.dataset.shot));
        };
        el.addEventListener('click', open);
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
        });
      });

      var pager = $('#shotsPager');
      if (!pager && $('#shots')) {
        pager = document.createElement('div');
        pager.id = 'shotsPager';
        pager.className = 'shots__pager';
        $('#shots').parentNode.insertBefore(pager, $('#shots').nextSibling);
      }
      if (pager) {
        if (pageCount <= 1) {
          pager.hidden = true;
          pager.innerHTML = '';
        } else {
          pager.hidden = false;
          var btns = '<button type="button" class="pg" data-pg="prev"' + (page === 1 ? ' disabled' : '') + ' aria-label="上一页">‹</button>';
          for (var p = 1; p <= pageCount; p++) {
            btns += '<button type="button" class="pg' + (p === page ? ' is-on' : '') + '" data-pg="' + p + '">' + pad2(p) + '</button>';
          }
          btns += '<button type="button" class="pg" data-pg="next"' + (page === pageCount ? ' disabled' : '') + ' aria-label="下一页">›</button>';
          pager.innerHTML = btns + '<span class="shots__pgnum">' + pad2(page) + ' / ' + pad2(pageCount) + '</span>';
          $$('#shotsPager .pg').forEach(function (b) {
            b.addEventListener('click', function () {
              var v = b.dataset.pg;
              if (v === 'prev') page = Math.max(1, page - 1);
              else if (v === 'next') page = Math.min(pageCount, page + 1);
              else page = Number(v);
              paintShots();
              var top = $('#shots');
              if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start', behavior: 'smooth' });
            });
          });
        }
      }
      $('#shotsMore').textContent = pad2(togetherList.length) + ' ' + L('shotsMore', 'ITEMS — 点击任意一张查看大图');
    }

    paintShots();

    /* 关于：标题与段落来自 data.js，段落里可以带换行 */
    var ab = D.about || {};
    if (ab.title && $('#aboutTitle')) $('#aboutTitle').textContent = ab.title;
    if (ab.subtitle && $('#aboutSub')) $('#aboutSub').textContent = ab.subtitle;
    if ($('#aboutText')) {
      /* 容错：paragraphs 可能是数组，也可能是一整段字符串（旧数据 / 手改） */
      var ps = ab.paragraphs;
      if (typeof ps === 'string') ps = ps.split(/\n\s*\n|\n/);
      if (!Array.isArray(ps)) ps = [];
      $('#aboutText').innerHTML = ps.map(function (t) {
        return '<p>' + esc(String(t).trim()) + '</p>';
      }).join('');
    }

    /* 关于 / 规格 */
    var specTable = (D.about && Array.isArray(D.about.table)) ? D.about.table : [];
    if ($('#spec')) {
      $('#spec').innerHTML = specTable.map(function (r) {
        return '<div class="spec__row"><div class="spec__k">' + esc(r.k || '') + '</div>' +
          '<div class="spec__v">' + esc(r.v || '') + '</div></div>';
      }).join('');
    }
  }

  /* ==========================================================================
     详情页
     ========================================================================== */
  function renderCharacter() {
    var id = window.__CHAR_ID__ || new URLSearchParams(location.search).get('id');
    var c = null;
    for (var i = 0; i < D.characters.length; i++) {
      if (D.characters[i].id === id) { c = D.characters[i]; break; }
    }
    if (!c) c = D.characters[0];

    var other = D.characters.filter(function (x) { return x.id !== c.id; })[0];
    var cats = {};
    c.images.forEach(function (im) { cats[im.cat] = 1; });

    document.title = c.latin + ' · ' + D.site.name;
    var desc = $('meta[name="description"]');
    if (desc) desc.setAttribute('content', c.name + ' 的角色档案与设定图集 — ' + D.site.name);

    /* 主题由右上角开关决定；这里只挂角色强调色 + 页面底色 */
    document.body.dataset.char = c.id;
    document.body.dataset.surface = 'char';

    /* 左栏 */
    $('#dhLeft').innerHTML =
      '<nav class="dh__crumb" aria-label="位置">' +
        '<a href="index.html">INDEX</a><span class="sep">/</span>' +
        '<span>' + esc(c.index) + '</span><span class="sep">/</span>' +
        '<span class="cur">' + esc(c.latin) + '</span>' +
      '</nav>' +
      '<span class="dh__rule" aria-hidden="true"></span>' +
      '<h1 class="dh__latin t-off" data-text="' + esc(c.latin) + '">' + esc(c.latin) + '</h1>' +
      (sameName(c) ? '' : '<p class="dh__cn">' + esc(c.name) + '</p>') +
      '<div class="dh__tags">' + c.tags.map(function (t) {
        return '<span class="tag">' + esc(t) + '</span>';
      }).join('') + '</div>' +
      '<p class="dh__lead">' + esc(c.lead) + '</p>' +
      '<div class="dh__mini">' +
        '<span>' + esc(c.code) + '</span>' +
        '<span>图集 <b>' + pad2(c.images.length) + '</b></span>' +
        '<span>分类 <b>' + pad2(Object.keys(cats).length) + '</b></span>' +
        ((c.emptySlots || []).length ? '<span>空位 <b>' + pad2(c.emptySlots.length) + '</b></span>' : '') +
      '</div>' +
      '<div class="dh__actions">' +
        '<a class="btn" href="#gallery">' + esc(L('buttons.gallery', '查看画廊')) + ' <span class="arw">&rarr;</span></a>' +
        '<a class="btn btn--ghost" href="index.html#index">' + esc(L('buttons.back', '返回索引')) + '</a>' +
      '</div>';

    /* 右栏：立绘裁切头像 + 描边残影；没有裁切就退回旧的头像位 / 空位 */
    var plate = $('#plate');
    if (c.head && c.head.image) {
      plate.classList.add('plate--head');
      plate.innerHTML =
        '<div class="portrait__grid"></div>' +
        '<span class="portrait__word" aria-hidden="true">' + esc(c.name) + '</span>' +
        '<img class="portrait__ghost" src="' + img(c.head.line || c.head.image) + '" alt="" aria-hidden="true" decoding="async">' +
        '<img class="portrait__main" src="' + img(c.head.image) + '" alt="' +
          esc(c.name) + ' ' + esc(c.head.tag || '') + '" decoding="async">' +
        '<span class="plate__tag">' + esc(c.head.tag || 'HEAD') + '</span>' +
        '<div class="plate__foot"><span>' + esc(c.head.note || '') + '</span>' +
        '<span>' + esc(c.code) + '</span></div>';
    } else {
      plate.innerHTML = '<div class="plate__grid"></div><div class="plate__cross"></div>';
      if (c.portrait && c.portrait.image) {
        plate.insertAdjacentHTML('beforeend',
          '<span class="plate__tag">' + esc(c.portrait.tag || 'PORTRAIT') + '</span>' +
          imgTag(c.portrait.image, c.name + ' 立绘', 'plate__img', 'loading="eager"'));
      } else {
        plate.insertAdjacentHTML('beforeend',
          '<span class="plate__tag">PORTRAIT / 立绘位</span>' +
          '<div class="plate__empty"><b>NO DATA</b><span>此角色暂无透明底立绘</span>' +
          '<span>补图后改 data.js → head / portrait</span></div>');
      }
      plate.insertAdjacentHTML('beforeend',
        '<div class="plate__foot"><span>' + (c.portrait ? 'IMAGE / PNG' : 'RESERVED') + '</span>' +
        '<span>' + esc(c.code) + '</span></div>');
    }

    /* 档案表 */
    $('#dossierGrid').innerHTML = c.fields.map(fieldHTML).join('');

    /* 画廊：优先用文件夹清单（assets/img/gallery/<角色>/），没有就退回 data.js */
    var folderItems = (window.GALLERY && window.GALLERY[c.id]) || null;
    var galItems = folderItems
      ? folderItems.map(function (it) {
          var isSeries = it.type === 'series';
          return {
            file: isSeries ? it.cover : it.file,
            title: it.title,
            note: it.note || (isSeries ? it.count + ' 张一组' : ''),
            cat: it.cat || (isSeries ? '系列' : '单图'),
            series: isSeries ? it.files : null,
            count: isSeries ? it.count : 0
          };
        })
      : (c.images || []);
    var galCats = [];
    galItems.forEach(function (i) { if (galCats.indexOf(i.cat) < 0) galCats.push(i.cat); });

    /* 画廊 */
    var gal = (function () {
      var filter = 'ALL';

      function itemHTML(it, i, list) {
        return '<figure class="gitem" role="button" tabindex="0" data-i="' + i + '"' +
          ' style="animation-delay:' + (i * 35) + 'ms" aria-label="查看 ' + esc(it.title) + '">' +
          imgTag(it.file, it.title, '') +
          (it.count ? countBadge(it.count) : '') +
          '<span class="gitem__tag">' + esc(it.cat) + '</span>' +
          '<div class="gitem__ov"><span class="gitem__t">' + esc(it.title) + '</span>' +
          '<span class="gitem__c">' + esc(it.cat) + '</span></div></figure>';
      }

      function slotHTML(s) {
        return '<div class="empty-slot"><b>EMPTY SLOT</b>' +
          '<span>' + esc(s.cat) + ' · ' + esc(s.note || '') + '</span>' +
          '<span>待补充 · 放进 assets/img/ 后改 data.js</span></div>';
      }

      function paint() {
        var list = filter === 'ALL'
          ? galItems.slice().sort(function (a, b) {
              return galCats.indexOf(a.cat) - galCats.indexOf(b.cat);
            })
          : galItems.filter(function (i) { return i.cat === filter; });
        var slots = (c.emptySlots || []).filter(function (s) {
          return filter === 'ALL' || s.cat === filter;
        });

        var html = list.map(function (it, i) { return itemHTML(it, i, list); }).join('');
        html += slots.map(slotHTML).join('');
        $('#masonry').innerHTML = html;

        var lbItems = list.map(function (it) {
          return { file: it.file, title: it.title, note: it.note || '', cat: it.cat };
        });
        $$('#masonry .gitem').forEach(function (el) {
          var open = function () {
            var it = list[Number(el.dataset.i)];
            if (it && it.series && it.series.length) {
              LB.open(it.series.map(function (f, k) {
                return { file: f, title: it.title + ' · ' + pad2(k + 1), note: it.note || '', cat: it.cat };
              }), 0);
              return;
            }
            LB.open(lbItems, Number(el.dataset.i));
          };
          el.addEventListener('click', open);
          el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
          });
        });
      }

      function paintFilters() {
        var all = [['ALL', '全部', galItems.length]].concat(
          galCats.map(function (cat) {
            var n = galItems.filter(function (i) { return i.cat === cat; }).length;
            var empty = (c.emptySlots || []).some(function (s) { return s.cat === cat; });
            return [cat, cat, n, empty];
          }).filter(function (r) { return r[2] > 0 || r[3]; })
        );
        $('#filters').innerHTML = all.map(function (r) {
          var on = filter === r[0] ? ' is-on' : '';
          return '<button class="chip' + on + '" data-filter="' + esc(r[0]) + '">' +
            '<span class="rhombus" style="width:5px;height:5px"></span>' +
            esc(r[1]) + ' <em>' + pad2(r[2]) + '</em></button>';
        }).join('');
        $$('#filters .chip').forEach(function (b) {
          b.addEventListener('click', function () {
            filter = b.dataset.filter;
            paintFilters();
            paint();
            initReveal();
          });
        });
      }

      return {
        init: function () {
          paintFilters();
          paint();
        }
      };
    })();
    gal.init();

    /* 交叉链接 */
    if (other) {
      $('#xcard').href = 'character.html?id=' + encodeURIComponent(other.id);
      $('#xcard').innerHTML =
        '<div><div class="xcard__k">NEXT FILE / 另一位角色</div>' +
        '<div class="xcard__n">' + esc(other.latin) + '</div>' +
        '<div class="xcard__cn">' + esc(other.name) + '</div></div>' +
        '<div class="xcard__arw">&rarr;</div>';
    } else {
      $('#xcard').parentNode.remove();
    }

    /* 页脚版本号 */
    var fv = $('#footVer'); if (fv) fv.textContent = D.site.version;
  }

  /* ==========================================================================
     首页唯一索引 —— 悬停微放大 / 点一下展开详情 / 再点一下进档案
     ========================================================================== */
  var Duo = (function () {
    var row, detail, hero, openId = null, timer = 0, switchTimer = 0;

    function char(id) {
      for (var i = 0; i < D.characters.length; i++) {
        if (D.characters[i].id === id) return D.characters[i];
      }
      return null;
    }
    function sideOf(id) { return id === D.characters[0].id ? 'left' : 'right'; }

    function stripHTML() {
      return D.characters.map(function (c, i) {
        var s = i === 0 ? 'left' : 'right';
        return '<button type="button" class="duo__item" data-id="' + esc(c.id) + '"' +
          ' data-side="' + s + '" aria-expanded="false" aria-controls="duoDetail"' +
          ' style="--origin:' + s + ' center;--cue-x:' + (s === 'left' ? '5px' : '-5px') + '">' +
          '<span class="duo__no">' + esc(c.index) + '</span>' +
          '<span class="duo__label"><span class="duo__name">' + esc(c.latin) + '</span>' +
            (sameName(c) ? '' : '<span class="duo__cn">' + esc(c.name) + '</span>') +
          '</span>' +
          '<span class="duo__cue">' + esc(L('hints.cueOpen', '展开详情')) + '</span>' +
        '</button>';
      }).join('');
    }

    function detailHTML(c) {
      var cats = {};
      c.images.forEach(function (im) { cats[im.cat] = 1; });
      var slots = (c.emptySlots || []).length;
      return '<div class="duo__inner">' +
        '<div class="duo__art">' +
          '<img src="' + img(c.card.image) + '" alt="' + esc(c.name) + ' 插画"' +
            ' data-file="' + esc(c.card.image) + '" decoding="async"' +
            ' onload="this.classList.toggle(\'is-wide\', this.naturalWidth > this.naturalHeight)">' +
        '</div>' +
        '<div class="duo__scrim"></div>' +
        '<div class="duo__info">' +
          '<p class="duo__k"><i></i>PROFILE :// ' + esc(c.code) + '</p>' +
          '<h3 class="duo__latin">' + esc(c.latin) + '</h3>' +
          '<p class="duo__meta">' + esc(c.name) + ' · ' + esc(c.cat) + '</p>' +
          '<div class="duo__tags">' + c.tags.map(function (t) {
            return '<span class="tag">' + esc(t) + '</span>';
          }).join('') + '</div>' +
          '<p class="duo__lead">' + esc(c.lead) + '</p>' +
          '<p class="duo__stats">' +
            '<span>图集 <b>' + pad2(c.images.length) + '</b></span>' +
            '<span>分类 <b>' + pad2(Object.keys(cats).length) + '</b></span>' +
            (slots ? '<span>空位 <b>' + pad2(slots) + '</b></span>' : '') +
          '</p>' +
          '<div class="duo__cta">' +
            '<a class="btn" href="character.html?id=' + encodeURIComponent(c.id) + '">' +
              esc(L('buttons.enter', '进入档案')) + ' <span class="arw">&rarr;</span></a>' +
          '</div>' +
        '</div>' +
      '</div>';
    }

    function mark(openIdNow) {
      $$('.duo__item', row).forEach(function (b) {
        var on = b.dataset.id === openIdNow;
        b.classList.toggle('is-open', on);
        b.setAttribute('aria-expanded', on ? 'true' : 'false');
        var cue = b.querySelector('.duo__cue');
        if (cue) cue.textContent = on ? (L('hints.cueEnter', '进入档案') + ' \u2192') : L('hints.cueOpen', '展开详情');
      });
      if (hero) hero.classList.toggle('is-expanded', !!openIdNow);
      /* 选中谁，全站强调色就跟着变（灰 → 蓝 / 黄绿），切换时开一段颜色过渡 */
      document.body.classList.add('is-theming');
      if (openIdNow) document.body.dataset.char = openIdNow;
      else delete document.body.dataset.char;
      window.clearTimeout(themeTimer);
      themeTimer = window.setTimeout(function () {
        document.body.classList.remove('is-theming');
      }, 560);
    }

    function open(id) {
      var c = char(id);
      if (!c || openId === id) return;
      var switching = !!openId;

      if (switching) {
        /* 切换角色：只播左右覆盖。先按方向定好，再把高度瞬间落位，
           否则面板高度过渡会和擦入动画同时播，看起来像在往下撑 */
        var ai = -1, bi = -1;
        for (var k = 0; k < D.characters.length; k++) {
          if (D.characters[k].id === openId) ai = k;
          if (D.characters[k].id === id) bi = k;
        }
        detail.dataset.dir = (bi >= ai) ? '1' : '-1';
        window.clearTimeout(switchTimer);
        detail.classList.add('is-switch');
      } else {
        detail.style.height = '0px';
        void detail.offsetHeight;
      }

      detail.setAttribute('data-side', sideOf(id));
      detail.innerHTML = detailHTML(c);
      detail.classList.add('is-open');
      detail.style.height = detail.scrollHeight + 'px';
      openId = id;
      mark(id);

      if (switching) {
        switchTimer = window.setTimeout(function () {
          detail.classList.remove('is-switch');
        }, 840);
      }

      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        if (openId) detail.style.height = 'auto';
      }, 1120);

      /* 展开时不再自动滚动页面——那会让点击和切换看起来像在上下跳 */

    }

    function close() {
      if (!openId) return;
      detail.style.height = detail.offsetHeight + 'px';
      void detail.offsetHeight;
      detail.classList.remove('is-open');
      detail.style.height = '0px';
      openId = null;
      mark(null);
    }

    function go(id) {
      nav('character.html?id=' + encodeURIComponent(id));
    }

    function init() {
      row = $('#duoRow');
      detail = $('#duoDetail');
      hero = $('#index');
      if (!row || !detail) return;
      row.innerHTML = stripHTML();

      row.addEventListener('click', function (e) {
        var btn = e.target.closest ? e.target.closest('.duo__item') : null;
        if (!btn) return;
        var id = btn.dataset.id;
        if (openId === id) go(id); else open(id);
      });

      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' && openId) close();
      });

      /* 尺寸变化后重新量高度，避免留白 */
      var rt = 0;
      window.addEventListener('resize', function () {
        window.clearTimeout(rt);
        rt = window.setTimeout(function () {
          if (!openId) return;
          detail.style.height = detail.scrollHeight + 'px';
          window.setTimeout(function () {
            if (openId) detail.style.height = 'auto';
          }, 680);
        }, 160);
      });

      detail.addEventListener('transitionend', function (e) {
        if (e.propertyName === 'height' && openId) detail.style.height = 'auto';
      });
    }

    return { init: init, close: close };
  })();

  /* 图片到位再淡入（配合 CSS 的 img.js-lazy） */
  document.addEventListener('load', function (e) {
    var t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('js-lazy')) t.classList.add('is-ready');
  }, true);

  /* ---------------------------------------------------------------- 浏览量（猫娘） */
  function initCounter() {
    var cfg = (D.site && D.site.counter) || {};
    var wraps = $$('.js-counter');
    if (!wraps.length) return;

    /* 本地计数（远端拿不到时用它兜底） */
    var local = 0;
    try {
      local = Number(window.localStorage.getItem('asu-visits') || '0') || 0;
      if (!window.sessionStorage.getItem('asu-visit-once')) {
        local += 1;
        window.localStorage.setItem('asu-visits', local);
        window.sessionStorage.setItem('asu-visit-once', '1');
      }
    } catch (e) {}
    var txt = Number(local || 1).toLocaleString('en-US');

    /* 单文件版里两个视图各有一份页脚，所以用 class 逐个填，不能只取第一个 */
    var base = cfg.base || 'https://count.getloli.com/get/@';
    var slug = String(cfg.name || 'asu-archive').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '') || 'asu-archive';
    var url = base + encodeURIComponent(slug) +
              '?theme=' + encodeURIComponent(cfg.theme || 'moebooru');

    wraps.forEach(function (wrap) {
      var img = wrap.querySelector('.js-moe');
      var fb = wrap.querySelector('.js-counter-fallback');
      var num = wrap.querySelector('.js-count');
      if (num) num.textContent = txt;
      if (!img) return;

      var settled = false;
      function fallback() {
        if (settled) return;
        settled = true;
        img.hidden = true;
        if (fb) fb.hidden = false;
      }
      img.addEventListener('load', function () {
        if (img.naturalWidth > 0) { if (fb) fb.hidden = true; img.hidden = false; }
        else fallback();
      }, { once: true });
      img.addEventListener('error', fallback, { once: true });

      /* Moe-counter：一张 SVG 计数图，数字本身就是萌系立绘 */
      img.src = url;
    });
  }  /* ---------------------------------------------------------------- 后台静默预热 */
  function initWarmUp() {
    function run() {
      var files = [];
      D.characters.forEach(function (c) {
        if (c.head) {
          if (c.head.image) files.push(c.head.image);
          if (c.head.line) files.push(c.head.line);
        }
        c.images.slice(0, 3).forEach(function (i) { files.push(i.file); });
      });
      files.slice(0, 8).forEach(function (f) {
        var im = new Image();
        im.decoding = 'async';
        im.src = img(f);
      });
    }
    if ('requestIdleCallback' in window) window.requestIdleCallback(run, { timeout: 2600 });
    else window.setTimeout(run, 1500);
  }

  /* ---------------------------------------------------------------- 启动 */
  function boot() {
    var page = document.body.dataset.page;
    if (page === 'index') { renderIndex(); Duo.init(); }
    else if (page === 'character') renderCharacter();

    var fv = $('#footVer'); if (fv) fv.textContent = D.site.version;

    applyLabels();
    initTheme();
    initTopbar();
    initParallax();
    initReveal();
    initCounter();
    initWarmUp();
    initBoot();
  }

  /* 单文件版需要单独驱动两个视图（目录版用不到） */
  window.ARCHIVE_APP = {
    renderIndex: renderIndex,
    renderChar: renderCharacter,
    initReveal: initReveal,
    duo: Duo,
    chars: D.characters
  };

  /* 点「进入档案」的链接也走同一套灰底转场（单文件版里则是视图切换） */
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var h = a.getAttribute('href') || '';
    if (!/^character\.html\?id=/.test(h)) return;
    e.preventDefault();
    e.stopPropagation();
    nav(h);
  }, true);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
