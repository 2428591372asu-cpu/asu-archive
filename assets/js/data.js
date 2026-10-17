/* ==========================================================================
   data.js — 全站内容都在这一个文件里
   想加图 / 改名字 / 加第三个角色，只改这里，不用动 HTML。
   --------------------------------------------------------------------------
   images[].file    ← assets/img/ 下的文件名（不要带路径）
   images[].cat     ← 分类，取值见下方 CATEGORIES
   images[].title   ← 画廊里显示的名字
   images[].note    ← 小字说明（可省略）
   fields[].v = null 时，页面会显示「待补充」虚线下划线
   emptySlots       ← 还没有图的分类，会在画廊里留一个虚线空位
   ========================================================================== */

window.ARCHIVE = (function () {
  'use strict';

  const CATEGORIES = ['立绘', '三视图', '头像', '表情', '插画', '像素', '合作', '其它'];

  const characters = [
    /* ------------------------------------------------------------------ */
    {
      id: 'a-su',
      index: '01',
      name: '阿苏',
      latin: 'A_SU',
      code: 'FILE-001',
      cat: '白狐 · FOX',
      tags: ['白发', '蓝瞳', '狐耳', '白大衣', '铃铛缎带'],

      // 首页卡片用图（object-position 调裁剪位置）
      card: { image: 'a-su-birthday.jpg', pos: '50% 18%' },

      // 详情页右栏：head = 从「立绘透明底」裁出的肩以上头像，会自动配一层描边残影
      head: { image: 'a-su-head.png', line: 'a-su-head-line.png', tag: 'HEAD / 立绘裁切', note: '立绘透明底 · 肩以上' },
      // 没有 head 时退回这里：portrait 填透明底 PNG，否则 null → 显示空位
      portrait: { image: 'a-su-avatar.png', tag: 'AVATAR / 头像' },

      lead: '白发、蓝瞳、直立的大狐耳与白色长尾。白色立领外套内搭蓝衬衫与浅蓝领带，' +
            '黑色长袜，右腿系铃铛缎带；头顶一枚蓝色四角星发饰。',

      fields: [
        { k: '编号', v: 'FILE-001' },
        { k: '代号', v: 'A_SU' },
        { k: '名称', v: '阿苏' },
        { k: '分类', v: '角色档案 / CHARACTER' },
        { k: '外观', v: '白发 · 蓝瞳 · 狐耳 · 白色长尾' },
        { k: '服饰', v: '白色外套 · 蓝领带 · 黑色长袜 · 铃铛缎带' },
        { k: '关联', v: '蒲瓜', link: 'pugua' },
        { k: '立绘', v: '已补 · 透明底 / 白底' },
        { k: '补充', v: null, wide: true }
      ],

      images: [
        { file: 'a-su-standing.png',   cat: '立绘',   title: '立绘 · 透明底', note: '全身站姿' },
        { file: 'a-su-standing-w.jpg', cat: '立绘',   title: '立绘 · 白底',   note: '全身站姿' },
        { file: 'a-su-sheet-1.jpg',    cat: '三视图', title: '三视图 · 排版 1', note: '正 / 背 / 侧' },
        { file: 'a-su-sheet-2.jpg',    cat: '三视图', title: '三视图 · 排版 2' },
        { file: 'a-su-sheet-plain.jpg', cat: '三视图', title: '三视图 · 无排版' },
        { file: 'a-su-turnaround.jpg', cat: '三视图', title: '三视图 · 旧版', note: '含配色与细节标注' },
        { file: 'a-su-avatar.png',     cat: '头像',   title: '头像 · 透明底', note: 'PNG 透明通道' },
        { file: 'a-su-avatar2.png',    cat: '头像',   title: '头像 II · 透明底', note: 'PNG 透明通道' },
        { file: 'a-su-avatar-bg.jpg',  cat: '头像',   title: '头像 · 带背景' },
        { file: 'a-su-avatar2-bg.jpg', cat: '头像',   title: '头像 II · 带背景' },
        { file: 'a-su-portrait.jpg',   cat: '头像',   title: '头像 · 白底' },
        { file: 'a-su-portrait2.jpg',  cat: '头像',   title: '头像 II · 白底' },
        { file: 'a-su-face-1.png',     cat: '表情',   title: '表情 · 苦呀西（透明底）' },
        { file: 'a-su-face-1-w.jpg',   cat: '表情',   title: '表情 · 苦呀西（白底）' },
        { file: 'a-su-face-2.png',     cat: '表情',   title: '表情 · 哈气（透明底）' },
        { file: 'a-su-face-2-w.jpg',   cat: '表情',   title: '表情 · 哈气（白底）' },
        { file: 'a-su-birthday.jpg',   cat: '插画',   title: '生贺', note: '生日插画' },
        { file: 'a-su-birthday-alt.jpg', cat: '插画', title: '生贺 · 差分', note: '生贺差分版' },
        { file: 'together-clean.jpg',    cat: '合作', title: '双人 · 海滩（无噪点）', note: '与蒲瓜' },
        { file: 'together-original.jpg', cat: '合作', title: '双人 · 海滩（原图）',   note: '与蒲瓜' },
        { file: 'together-draft.jpg',    cat: '合作', title: '双人 · 海滩（草稿）',   note: '与蒲瓜' },
        { file: 'a-su-mcskin.png',     cat: '其它',   title: 'MC 皮肤', note: '64 × 64 像素' }
      ],

      emptySlots: []
    },

    /* ------------------------------------------------------------------ */
    {
      id: 'pugua',
      index: '02',
      name: '蒲瓜',
      latin: 'PUGUA',
      code: 'FILE-002',
      cat: '蓝狐 · FOX',
      tags: ['蓝发', '绿瞳', '狐耳', '连帽外套', '像素'],

      // 卡片用「像素蒲瓜」
      card: { image: 'pugua-pixel.png', pos: '50% 46%' },

      // 详情页右栏：从「立绘自拍杆透明底」裁出的肩以上头像 + 线稿残影
      head: { image: 'pugua-head.png', line: 'pugua-head-line.png',
              tag: 'HEAD / 立绘裁切', note: '立绘自拍杆透明底 · 肩以上' },
      portrait: null,

      lead: '蓝紫色长发、绿色瞳孔，狐耳与浅蓝色长尾。浅蓝连帽外套配深蓝百褶裙与白衬衫，' +
            '单肩小挎包上挂一朵蓝色花饰，白色短靴；立绘里还举着一根自拍杆。',

      fields: [
        { k: '编号', v: 'FILE-002' },
        { k: '代号', v: 'PUGUA' },
        { k: '名称', v: '蒲瓜' },
        { k: '分类', v: '角色档案 / CHARACTER' },
        { k: '外观', v: '蓝发 · 绿瞳 · 狐耳 · 浅蓝长尾' },
        { k: '服饰', v: '浅蓝连帽外套 · 深蓝百褶裙 · 小挎包' },
        { k: '关联', v: '阿苏', link: 'a-su' },
        { k: '立绘', v: '已补 · 自拍杆透明底' },
        { k: '头像', v: '已补 · 含线稿残影' },
        { k: '补充', v: null, wide: true }
      ],

      images: [
        { file: 'pugua-standing.png',     cat: '立绘',   title: '立绘 · 自拍杆（透明底）', note: '全身站姿' },
        { file: 'pugua-standing-2.png',   cat: '立绘',   title: '立绘 II · 透明底' },
        { file: 'pugua-standing-3.jpg',   cat: '立绘',   title: '立绘 III · 黑裙' },
        { file: 'pugua-turnaround.jpg',   cat: '三视图', title: '三视图 · 正 / 侧 / 背', note: '含配件与色卡' },
        { file: 'pugua-turnaround-2.jpg', cat: '三视图', title: '三视图 · 格纹版' },
        { file: 'pugua-lineart.jpg',      cat: '三视图', title: '线稿 · 眼睛特写' },
        { file: 'pugua-sheet-1.jpg',      cat: '三视图', title: '设定 · 分镜页' },
        { file: 'pugua-sheet-2.jpg',      cat: '三视图', title: '设定 · 表情动作集' },
        { file: 'pugua-face-1.jpg',       cat: '头像',   title: '头像 · 贴纸' },
        { file: 'pugua-face-2.jpg',       cat: '头像',   title: '头像 · 黄底' },
        { file: 'pugua-face-3.jpg',       cat: '头像',   title: '头像 · 深色' },
        { file: 'pugua-face-4.png',       cat: '头像',   title: '头像 · 贴纸 Q 版' },
        { file: 'pugua-face-5.png',       cat: '头像',   title: '头像 · 坐姿 Q 版' },
        { file: 'pugua-pixel.png',        cat: '像素',   title: '像素 · 蒲瓜', note: '主页卡图' },
        { file: 'pugua-pixel-head.png',   cat: '像素',   title: '像素 · 头像' },
        { file: 'pugua-pixel-ember.png',  cat: '像素',   title: '像素 · EMBER' },
        { file: 'pugua-selfie.jpg',       cat: '插画',   title: '插画 · 自拍' },
        { file: 'pugua-halfbody.jpg',     cat: '插画',   title: '插画 · 半身' },
        { file: 'pugua-hat-green.jpg',    cat: '插画',   title: '插画 · 草帽' },
        { file: 'pugua-pastel.jpg',       cat: '插画',   title: '插画 · 粉彩' },
        { file: 'pugua-portrait-1.jpg',   cat: '插画',   title: '插画 · 水手领' },
        { file: 'pugua-portrait-2.jpg',   cat: '插画',   title: '插画 · 星屑' },
        { file: 'pugua-fox.jpg',          cat: '插画',   title: '插画 · 抱狐' },
        { file: 'pugua-hat-1.jpg',        cat: '插画',   title: '插画 · 白帽' },
        { file: 'pugua-hat-2.jpg',        cat: '插画',   title: '插画 · 白帽 · 星' },
        { file: 'pugua-eyes.jpg',         cat: '其它',   title: '特写 · 眼睛' },
        { file: 'pugua-scene.jpg',        cat: '其它',   title: '场景 · 夜' },
        { file: 'together-picnic.jpg',    cat: '合作',   title: '双人 · 野餐', note: '与阿苏' },
        { file: 'together-clean.jpg',     cat: '合作',   title: '双人 · 海滩（无噪点）', note: '与阿苏' },
        { file: 'together-original.jpg',  cat: '合作',   title: '双人 · 海滩（原图）',   note: '与阿苏' },
        { file: 'together-draft.jpg',     cat: '合作',   title: '双人 · 海滩（草稿）',   note: '与阿苏' }
      ],

      emptySlots: []
    }
  ];

  /* 首页「双人 / TOGETHER」横排用的图 */
  const together = [
    { file: 'together-picnic.jpg',   title: '野餐',     note: '双人插画' },
    { file: 'together-clean.jpg',    title: '海滩',     note: '无噪点版' },
    { file: 'together-original.jpg', title: '海滩',     note: '原图' },
    { file: 'together-draft.jpg',    title: '海滩',     note: '草稿' }
  ];

  return {
    site: {
      name: 'A_SU ARCHIVE',
      cn: '设定档案',
      version: 'v0.1.0-demo',
      tagline: '本地演示 · 非官方同人档案',
      /* 页脚浏览量：Moe-counter（https://github.com/journey-ad/Moe-counter）
         name 随意但要唯一；theme 可选 moebooru / gelbooru / rule34 …
         自建实例时把 base 换成自己的域名即可 */
      counter: { name: 'asu-archive', theme: 'moebooru', base: 'https://count.getloli.com/get/@' }
    },
    hero: {
      image: 'together-picnic.jpg',
      /* 首页大图轮换：20 秒一张，鼠标靠近时出现左右按钮 */
      slides: ['together-picnic.jpg', 'together-clean.jpg'],
      slideInterval: 20000,
      label: 'CHARACTER ARCHIVE',
      title1: 'A_SU&PUGUA',
      title2: 'ARCHIVE',
      cn: '双人设定档案',
      lead: '两只白蓝配色的狐狸，一份从设定图到成图的完整档案。' +
            '首页收录两位角色，点进去可以看到各自的图集、三视图与像素图。'
    },
    categories: CATEGORIES,
    characters: characters,
    together: together
  };
})();
