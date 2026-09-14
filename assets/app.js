/* 网文改编 Track — 前端渲染（原生 JS，无构建、无依赖）
   数据来源：shuju/track_data.json（由 build_track_data.py 生成）
   页面职责：只渲染，不做业务计算；所有指标/洞察均已在 ETL 阶段算好。
   视觉风格参考 Hugging Face Leaderboard：偏白底 / 顶部横向导航 / 黑色胶囊按钮。*/

'use strict';

var DATA = null;
var CUR = 'overview';
var VIEW = {};   /* 每页表格状态：搜索词 / 筛选 / 排序 / 分页 / 已展开行 */
var IME_ON = false;              /* 中文输入法组合中，此时不重渲染 */

/* ---------------- 工具 ---------------- */
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function num(n) { return (n == null || isNaN(n)) ? '—' : Number(n).toLocaleString('zh-CN'); }
function wan(v) {
  if (!v) return '—';
  return Math.round(v / 10000).toLocaleString('zh-CN') + ' 万';
}
function pct(a, b) { return b ? (Math.round(a / b * 1000) / 10) + '%' : '—'; }

/* 吉祥物：一本翻开的书 + 播放键，寓意「小说 → 短剧」。 */
var MASCOT = '<svg viewBox="0 0 40 40" width="30" height="30" xmlns="http://www.w3.org/2000/svg">' +
  '<rect x="2.5" y="7" width="35" height="26" rx="5" fill="#FFD21E"/>' +
  '<path d="M20 11.5c-2.6-1.6-5.6-2.2-8.6-1.9-.9.1-1.6.9-1.6 1.8v14.9c0 1 .9 1.8 1.9 1.7 2.7-.3 5.6.3 8.3 1.9V11.5z" fill="#fff"/>' +
  '<path d="M20 11.5c2.6-1.6 5.6-2.2 8.6-1.9.9.1 1.6.9 1.6 1.8v14.9c0 1-.9 1.8-1.9 1.7-2.7-.3-5.6.3-8.3 1.9V11.5z" fill="#fff" opacity=".82"/>' +
  '<circle cx="20" cy="29.6" r="7.4" fill="#111114"/>' +
  '<path d="M17.6 26.3l5.4 3.3-5.4 3.3z" fill="#FFD21E"/>' +
  '<circle cx="12.8" cy="15.2" r="1.5" fill="#111114"/>' +
  '<circle cx="27.2" cy="15.2" r="1.5" fill="#111114"/>' +
  '</svg>';

/* 三平台 logo（内联 SVG，比 emoji 更清晰且跨系统一致）：
   番茄=番茄果实 / 起点=翻开的书 / 晋江=樱花。尺寸由调用方传入。 */
function logoSvg(plat, size) {
  var s = size || 18;
  var head = '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s +
             '" xmlns="http://www.w3.org/2000/svg" style="display:block;flex-shrink:0">';
  if (plat === 'fanqie') {
    return head +
      '<path d="M12 3.6c-.7-1-1.9-1.5-3.1-1.3.5.9 1.3 1.5 2.2 1.8-1-.5-2.2-.5-3.2 0 .8.6 1.8.9 2.8.7" fill="#3f9142"/>' +
      '<path d="M12 3.2c1-.9 2.4-1.1 3.6-.6-.7.8-1.6 1.2-2.6 1.3 1.1-.2 2.2.1 3.1.8-1 .4-2.1.4-3.1 0" fill="#4caf50"/>' +
      '<circle cx="12" cy="14.2" r="8" fill="#e8412c"/>' +
      '<path d="M8.4 9.4c-1.3 1-2 2.5-2 4.1 0-2 1-3.8 2.7-4.8" fill="#fff" opacity=".45"/>' +
      '<path d="M12 6.2c-.5 0-.9-.4-.9-.9V3.6c0-.5.4-.9.9-.9s.9.4.9.9v1.7c0 .5-.4.9-.9.9z" fill="#3f9142"/>' +
      '</svg>';
  }
  if (plat === 'qidian') {
    return head +
      '<path d="M3 5.4c2.8-1 5.7-1 8.5.4v14c-2.8-1.4-5.7-1.4-8.5-.4V5.4z" fill="#2563eb"/>' +
      '<path d="M21 5.4c-2.8-1-5.7-1-8.5.4v14c2.8-1.4 5.7-1.4 8.5-.4V5.4z" fill="#5b93f5"/>' +
      '<path d="M11.5 5.8h1v14h-1z" fill="#1d4ed8"/>' +
      '<path d="M5 8.4c1.6-.4 3.2-.4 4.7.2M5 11.2c1.6-.4 3.2-.4 4.7.2" stroke="#fff" stroke-width="1" stroke-linecap="round" opacity=".7" fill="none"/>' +
      '</svg>';
  }
  if (plat === 'jjwxc') {
    return head +
      '<g fill="#f472b6">' +
      '<ellipse cx="12" cy="5.6" rx="2.5" ry="3.6"/>' +
      '<ellipse cx="12" cy="5.6" rx="2.5" ry="3.6" transform="rotate(72 12 12)"/>' +
      '<ellipse cx="12" cy="5.6" rx="2.5" ry="3.6" transform="rotate(144 12 12)"/>' +
      '<ellipse cx="12" cy="5.6" rx="2.5" ry="3.6" transform="rotate(216 12 12)"/>' +
      '<ellipse cx="12" cy="5.6" rx="2.5" ry="3.6" transform="rotate(288 12 12)"/>' +
      '</g><circle cx="12" cy="12" r="2.2" fill="#fbbf24"/>' +
      '</svg>';
  }
  /* 概览：三色堆叠方块 */
  return head +
    '<rect x="3" y="3" width="8" height="8" rx="2" fill="#ea580c"/>' +
    '<rect x="13" y="3" width="8" height="8" rx="2" fill="#2563eb"/>' +
    '<rect x="3" y="13" width="8" height="8" rx="2" fill="#db2777"/>' +
    '<rect x="13" y="13" width="8" height="8" rx="2" fill="#111114"/>' +
    '</svg>';
}

/* ---------------- 导航配置 ---------------- */
var NAV = [
  { key: 'overview', label: '概览', p: 'overview',
    title: '概览', sub: '三平台头部与本期变化' },
  { key: 'fanqie_wwds', label: '番茄小说', p: 'fanqie',
    title: '番茄改编全库', sub: '全量' },
  { key: 'fanqie_hot', label: '番茄小说', p: 'fanqie',
    title: '番茄最热榜 Top50', sub: '新热榜' },
  { key: 'fanqie_peak', label: '番茄小说', p: 'fanqie',
    title: '番茄巅峰榜 Top30', sub: '总榜' },
  { key: 'qidian_sales', label: '起点中文网', p: 'qidian',
    title: '起点畅销榜 Top50', sub: '新热榜' },
  { key: 'qidian_coll', label: '起点中文网', p: 'qidian',
    title: '起点收藏榜 Top1000', sub: '总榜' },
  { key: 'jjwxc_month', label: '晋江文学城', p: 'jjwxc',
    title: '晋江积分月榜 Top50', sub: '新热榜' },
  { key: 'jjwxc_score', label: '晋江文学城', p: 'jjwxc',
    title: '晋江积分榜 Top1000', sub: '总榜' }
];
/* 顶栏一级导航：4 个入口，各自默认落到第一个子页 */
var TOPNAV = [
  { p: 'overview', label: '概览', first: 'overview' },
  { p: 'fanqie', label: '番茄小说', first: 'fanqie_wwds' },
  { p: 'qidian', label: '起点中文网', first: 'qidian_sales' },
  { p: 'jjwxc', label: '晋江文学城', first: 'jjwxc_month' }
];
function navOf(key) {
  for (var i = 0; i < NAV.length; i++) if (NAV[i].key === key) return NAV[i];
  return NAV[0];
}
function subsOf(p) { return NAV.filter(function (n) { return n.p === p; }); }

/* 当前页选中的快照索引（按页 key 记住） */
var SNAP_IDX = {};
function snapsOf(key) { return ((DATA.pages || {})[key] || {}).snapshots || []; }
function curSnap(key) {
  var ss = snapsOf(key);
  if (!ss.length) return null;
  var i = SNAP_IDX[key] || 0;
  return ss[Math.min(i, ss.length - 1)];
}

function go(key) {
  CUR = key;
  renderChrome();
  renderPage();
  window.scrollTo(0, 0);
}

/* ---------------- 外框：顶栏 / 页头 / 子标签 ---------------- */
function renderChrome() {
  var cn = navOf(CUR);
  document.getElementById('brandMark').innerHTML = MASCOT;
  document.getElementById('genAt').textContent =
    '最近更新 ' + (((DATA || {}).meta || {}).generated_at || '—').slice(0, 16);

  /* 顶栏一级导航（带平台 logo） */
  var tn = document.getElementById('topnav');
  tn.innerHTML = TOPNAV.map(function (t) {
    return '<span class="nv' + (cn.p === t.p ? ' on' : '') + '" data-first="' + t.first + '">' +
           logoSvg(t.p, 17) + esc(t.label) + '</span>';
  }).join('');
  tn.querySelectorAll('.nv').forEach(function (n) {
    n.onclick = function () { go(n.getAttribute('data-first')); };
  });

  /* 页头 */
  var page = ((DATA || {}).pages || {})[CUR] || {};
  var m = page.meta || {};
  var snap = curSnap(CUR);
  var rowN = snap ? (snap.rows_count || (snap.rows || []).length) : 0;

  var badges = '<span class="badge ' + cn.p + '">' + esc(cn.sub) + '</span>';

  /* 元信息第一行：更新时间 */
  var line1 = [];
  if (CUR === 'overview') {
    line1.push('数据集 <b>7</b> 个');
    line1.push('最近更新 <b>' + esc(((DATA || {}).meta || {}).generated_at || '—') + '</b>');
  } else if (CUR === 'fanqie_wwds') {
    /* ⭐ 两个日期必须读 snap（每期各自的 xlsx 日期），不许读 m.rank_date/m.detail_date ——
       page.meta 恒等于最新一期，切到 7 月快照时会一直显示 8-31。
       这与下面 else 分支「榜单日随快照切换」是同一条规矩，2026-09-08 那次只修了
       六个榜单页、漏了本页，2026-09-11 补上。读不到显「—」，绝不回退最新期。 */
    line1.push('榜单数据 <b>' + esc((snap && snap.rank_date) || '—') + '</b>');
    line1.push('改编明细 <b>' + esc((snap && snap.detail_date) || '—') + '</b>');
    line1.push('收录 <b>' + num(rowN) + '</b> 本');
  } else {
    /* 不再显示「在榜 N 本」—— 子标签上已经带了同一个数字，重复 */
    /* ⭐ 榜单日随改编快照切换：每期各配「<= 该快照日的最近榜单日」
       （后端 _bangdan_top_pei_dui）。⛔ 不要退回读 m.board_date —— 那是最新一期的
       榜单日，切到 7 月快照时会显示 8-27，正是 2026-09-08 修掉的错配 bug。
       读不到就显示「—」，宁可缺也不能显示错的日期。 */
    var bangdanRi = snap ? snap.bangdan_ri : m.board_date;
    line1.push('榜单日 <b>' + esc(bangdanRi || '—') + '</b>');
  }

  /* 元信息第二行：来源链接 + 已统计天数（参考 Dylan 站写法） */
  var src = m.board_src || {};
  var line2 = '';
  if (src.source_url) {
    var color = cn.p === 'overview' ? 'var(--ink)' : 'var(--' + cn.p + ')';
    line2 = '来源: <a href="' + esc(src.source_url) + '" target="_blank" rel="noopener" ' +
            'style="color:' + color + ';font-weight:600;text-decoration:underline;' +
            'text-underline-offset:2px">' + esc(src.source || src.board_name || '原站') + ' ↗</a>';
  }

  document.getElementById('pagehead').innerHTML =
    '<div class="pagehead-in">' +
      '<div class="ph-ava ' + cn.p + '">' + logoSvg(cn.p, 30) + '</div>' +
      '<div class="ph-body">' +
        '<div class="ph-title-row"><span class="ph-title">' + esc(cn.title) + '</span>' + badges + '</div>' +
        '<div class="ph-meta">' + line1.map(function (x) { return '<span>' + x + '</span>'; }).join('') + '</div>' +
        (line2 ? '<div class="ph-src">' + line2 + '</div>' : '') +
      '</div>' +
      '<div class="ph-actions" id="phActions"></div>' +
    '</div>';

  /* 页头右侧：快照切换 + 外链 */
  var acts = [];
  var ss = snapsOf(CUR);
  if (ss.length > 1) {
    acts.push('<span class="snap-label">改编数据快照</span>' +
      '<select class="snap-sel" id="snapSel">' + ss.map(function (s, i) {
        var cvd = s.covered != null ? '（' + num(s.covered) + ' 本）' : '';
        return '<option value="' + i + '"' + ((SNAP_IDX[CUR] || 0) === i ? ' selected' : '') + '>' +
               esc(s.date || '—') + cvd + (i === 0 ? ' · 最新' : '') + '</option>';
      }).join('') + '</select>');
  } else if (snap && snap.date) {
    /* 只有一期数据时不给下拉，但要说明原因 ——
       否则读者会以为是功能缺失，而不是「库里确实只有一期」。 */
    acts.push('<span class="snap-label">改编数据快照</span>' +
      '<select class="snap-sel" disabled title="该数据集目前只采集过一期，累积多期后此处可切换">' +
      '<option>' + esc(snap.date) + '（仅此一期）</option></select>');
  }
  /* extra_link（晋江版权影音推介）不在这里放按钮 ——
     它是补充信息源、不是主操作，只在口径说明区以超链接呈现。 */
  document.getElementById('phActions').innerHTML = acts.join('');
  var sel = document.getElementById('snapSel');
  if (sel) {
    sel.onchange = function () {
      SNAP_IDX[CUR] = Number(sel.value);
      delete VIEW[CUR];        // 换快照后重置该页表格状态（分页/展开行都失效了）
      renderChrome();
      renderPage();
    };
  }

  /* 给主区打上平台标记：CSS 里 var(--plat) 即当前平台色，
     省得各处写死某个平台的颜色（原先口径说明外链写死起点蓝，在晋江页不协调）。 */
  var mainEl = document.getElementById('main');
  if (mainEl && mainEl.setAttribute) mainEl.setAttribute('data-plat', cn.p);

  /* 子标签（仅平台内多页时显示） */
  var subs = subsOf(cn.p);
  var wrap = document.getElementById('subtabsWrap');
  if (subs.length < 2) { wrap.innerHTML = ''; wrap.style.display = 'none'; return; }
  wrap.style.display = '';
  wrap.innerHTML = '<div class="subtabs">' + subs.map(function (s) {
    var ssx = snapsOf(s.key);
    var sx = ssx.length ? ssx[Math.min(SNAP_IDX[s.key] || 0, ssx.length - 1)] : null;
    var cnt = sx ? (sx.rows_count || (sx.rows || []).length) : 0;
    return '<span class="subtab' + (s.key === CUR ? ' on' : '') + '" data-key="' + s.key + '">' +
           esc(s.title.replace(/^番茄|^起点|^晋江/, '').trim()) +
           (cnt ? ' <span style="color:var(--ink-3);font-weight:600">' + num(cnt) + '</span>' : '') +
           '</span>';
  }).join('') + '</div>';
  wrap.querySelectorAll('.subtab').forEach(function (n) {
    n.onclick = function () { go(n.getAttribute('data-key')); };
  });
}

/* ---------------- 公共片段 ---------------- */

/* 口径说明的一行：左侧标签 + 右侧内容（内容已是 HTML，调用方自行 esc） */
function noteRowHtml(label, bodyHtml) {
  return '<div class="note-row"><span class="lb">' + esc(label) + '</span>' + bodyHtml + '</div>';
}

/* 口径说明浮窗的外壳：页面上只露一个 ⓘ，hover / 键盘 focus / 点击后 focus 固定才展开。
   纯 CSS 展开，不挂任何事件 —— 口径卡虽然不在局部刷新范围内，
   但少一处事件绑定就少一处踩 IME/重建的坑。
   ⚠ 用户 2026-09-07 明确要求：ⓘ 旁边不许再带「完整统计方式」这类文字，
     全站所有口径说明类文案统一收进这个 ⓘ。要加提示文字请先问过用户。
   innerHtml 由调用方自行 esc；ariaLabel 在这里 esc。 */
function popKeHtml(innerHtml, ariaLabel) {
  if (!innerHtml) return '';
  return '<span class="pop" tabindex="0" role="button" aria-label="' +
         esc(ariaLabel || '查看口径说明') + '">' +
         '<b>ⓘ</b><span class="pop-bd">' + innerHtml + '</span></span>';
}

/* 统计方式·详情（长文）+ 可选阈值表 → 装进 ⓘ 浮窗 */
function tongJiPopHtml(xiang, biao) {
  var inner = (xiang || []).map(function (p) {
    return '<p class="pop-p">' + esc(p) + '</p>';
  }).join('');
  if (biao && biao.hang && biao.hang.length) {
    inner += (biao.biao_ti ? '<div class="pop-tt">' + esc(biao.biao_ti) + '</div>' : '') +
      '<table class="pop-tbl"><thead><tr>' +
      (biao.biao_tou || []).map(function (h) { return '<th>' + esc(h) + '</th>'; }).join('') +
      '</tr></thead><tbody>' +
      biao.hang.map(function (r) {
        return '<tr>' + (r || []).map(function (c) { return '<td>' + esc(c) + '</td>'; }).join('') + '</tr>';
      }).join('') + '</tbody></table>';
  }
  if (!inner) return '';
  return popKeHtml(inner, '查看完整统计方式');
}

/* ⭐ 取「当前快照的口径说明」，读不到才回退 page 级。
   番茄改编全库每期的分档阈值都不一样（实测 07-06 与 08-31 差 2~4%），
   后端已把 notes 挂到每个快照上；其余六页没有 snap.notes，自动走 page.notes 原路。
   ⛔ 别在调用点各写一遍 `page.notes || {}` —— notesHtml 有 3 个调用点，
      分散写必漏（这个根因已犯三次：榜单日 / 页头日期 / 浮窗阈值）。统一走本函数。 */
function pageNotes(page) {
  page = page || {};
  var snap = curSnap(page.key || CUR);      /* snapsOf(undefined) 返回 []，不会炸 */
  return (snap && snap.notes) || page.notes || {};
}

/* 口径说明卡。
   tongJiPopYiNuoZou = true 时，「统计方式」行只留摘要，详情浮窗不在这里出 ——
   给番茄改编全库用：它的详情讲的是「改编超预期/不及预期」判定，
   用户 2026-09-07 要求挪到「改编表现分布」指标卡上，见 renderWwds。 */
function notesHtml(page, tongJiPopYiNuoZou) {
  var n = pageNotes(page);
  var rows = '';
  if (n.source) rows += noteRowHtml('数据来源', esc(n.source));
  if (n.lei_xing) rows += noteRowHtml('改编类型枚举', esc(n.lei_xing));
  /* 统计方式：摘要行内显示，长文与阈值表收进 ⓘ 浮窗（用户 2026-09-04 明确要求） */
  var pop = tongJiPopYiNuoZou ? '' : tongJiPopHtml(n.tong_ji_xiang, n.tong_ji_biao);
  if (n.tong_ji_zhai || pop) {
    rows += noteRowHtml('统计方式', esc(n.tong_ji_zhai || '') + (pop ? ' ' + pop : ''));
  }
  if (page.extra_link) {
    /* 标题本身做超链接，不再另贴一串裸 URL（又长又不好看） */
    rows += '<div class="note-row"><span class="lb">' +
            '<a href="' + esc(page.extra_link.url) + '" target="_blank" rel="noopener">' +
            esc(page.extra_link.title) + ' ↗</a></span>' +
            esc(page.extra_link.desc) + '</div>';
  }
  if (!rows) return '';
  return '<div class="card notes"><div class="card-hd"><span class="h">口径说明</span>' +
         '<span class="s">读数前请先看这里</span></div><div class="card-bd">' + rows + '</div></div>';
}

/* 洞察专栏。用户 2026-09-07 要求：给洞察结论一个单独显眼的地方，全站 8 页统一，
   但**不要太大** —— 所以只加一条细标题带，条目本身反而比原来更紧凑。
   注意别在这里挂事件，专栏会随局部刷新整块重建。 */
function insightsHtml(list) {
  if (!list || !list.length) return '';
  return '<div class="ins-zhuanlan">' +
    '<div class="ins-hd">核心洞察<span class="ins-cnt">' + list.length + ' 条</span></div>' +
    '<div class="insights">' + list.map(function (i) {
      return '<div class="insight ' + esc(i.level || 'normal') + '">' +
             '<div class="t">' + esc(i.title) + '</div><div class="x">' + esc(i.text) + '</div></div>';
    }).join('') + '</div></div>';
}

/* 指标卡。
   labelHouZhui（可选）：紧跟在标题右边的 HTML，专门给 ⓘ 口径浮窗用。
   ⚠ 它**不走 esc()**（否则浮窗 HTML 会被转义成纯文本），
     只允许传本文件里生成的浮窗片段，绝不能直接塞外部数据。 */
function statCard(label, value, sub, subCls, labelHouZhui) {
  return '<div class="stat"><div class="l">' + esc(label) + (labelHouZhui || '') + '</div>' +
         '<div class="n">' + value + '</div>' +
         '<div class="s ' + (subCls || '') + '">' + (sub || '&nbsp;') + '</div></div>';
}

/* 图表/内容卡片。
   eWaiCls：可选的追加 class，用来给某几张卡开专属样式作用域
   （目前只有番茄改编全库页的 4 张图传：折线图传 ka-quxian、柱状图传 ka-zhuzhuang）。
   ⚠️ 必须 `(eWaiCls ? ... : '')` 兜底 —— 本函数有 10 个调用点，其中 6 个不传第 4 参，
   直接拼会变成 class="card undefined"（`miniColsHtml` 加第 5 参时已经踩过一次）。 */
function cardHtml(title, subtitle, body, eWaiCls) {
  return '<div class="card' + (eWaiCls ? ' ' + eWaiCls : '') +
         '" style="margin-bottom:16px"><div class="card-hd">' +
         '<span class="h">' + esc(title) + '</span>' +
         (subtitle ? '<span class="s">' + esc(subtitle) + '</span>' : '') +
         '</div><div class="card-bd">' + body + '</div></div>';
}

function barsHtml(rows, color, maxVal) {
  var max = maxVal || Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  return '<div class="bars">' + rows.map(function (r) {
    return '<div class="bar-row"><div class="cell dim" title="' + esc(r.k) + '">' + esc(r.k) + '</div>' +
           '<div class="bar-track"><div class="bar-fill" style="width:' +
           (r.v / max * 100).toFixed(1) + '%;background:' + color + '"></div></div>' +
           '<div class="bar-val">' + esc(r.t != null ? r.t : num(r.v)) + '</div></div>';
  }).join('') + '</div>';
}

/* 多系列折线图（内联 SVG，不引任何图表库）。
   用于「改编作品上线月度趋势」「热度天花板趋势」——多条线叠在一起，
   比原来那种「每月一根横条」更容易看出趋势与交叉点。
   series = [{name, color, vals: [数值...]}]，labels = X 轴文字（与 vals 等长）。
   danWei：tooltip 里的数值单位，默认「部」。热度天花板图要传「万」。

   ⚠️ vals 里的 null 表示「该月样本不足、无可比数值」，与 0 完全不同：
   补 0 会画出一条假的暴跌到底。null 的处理是断线 + 不画点 + tooltip 显示「样本不足」。 */
function lineChartHtml(labels, series, danWei) {
  if (!labels || labels.length < 2 || !series || !series.length) return '';
  var unit = danWei || '部';
  /* viewBox 尺寸决定长宽比。用户 2026-09-07 要求「改成原来 1/4 大小」，
     当时靠 viewBox 460×160 + CSS max-width:500px 实现。
     2026-09-07 后续：本图改为与右侧「热度天花板」并列（各占半宽），
     卡片本身已经只有半宽，max-width 已从 CSS 去掉 —— 再限死会让右侧又留白。
     PL 从 54 缩到 40 —— 图变小后 Y 轴刻度文字也短了，留 54 会空一大块。 */
  var W = 460, H = 160, PL = 40, PR = 10, PT = 10, PB = 24;
  var iw = W - PL - PR, ih = H - PT - PB;
  /* 数值是否有效（null / undefined / NaN 都算无效，0 是有效值）。
     不能写 if (v) —— 那会把真实的 0 也当成缺失。 */
  var youXiao = function (v) { return v != null && !isNaN(v); };
  var maxV = 0;
  series.forEach(function (s) {
    s.vals.forEach(function (v) { if (youXiao(v) && v > maxV) maxV = v; });
  });
  if (maxV <= 0) return '';
  /* Y 轴上界向上取整到「整」刻度，避免最大值顶格贴边 */
  var step = Math.pow(10, String(Math.floor(maxV)).length - 1);
  var top = Math.ceil(maxV / step) * step;
  var X = function (i) { return PL + i / (labels.length - 1) * iw; };
  var Y = function (v) { return PT + ih - v / top * ih; };

  var g = '';
  /* 横向网格线 + Y 轴刻度（4 等分） */
  for (var i = 0; i <= 4; i++) {
    var v = top / 4 * i, y = Y(v);
    g += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) +
         '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
         '<text x="' + (PL - 7) + '" y="' + (y + 3.5).toFixed(1) +
         '" text-anchor="end" font-size="10" fill="var(--ink-3)">' +
         num(Math.round(v)) + '</text>';
  }
  /* X 轴标签：月份多时隔几个显示，避免文字重叠 */
  var everyN = Math.ceil(labels.length / 8);
  labels.forEach(function (lb, i) {
    if (i % everyN !== 0 && i !== labels.length - 1) return;
    g += '<text x="' + X(i).toFixed(1) + '" y="' + (H - 9) +
         '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' + esc(lb) + '</text>';
  });
  /* 折线 + 数据点。null 处断线：把连续的有效点切成若干段，各画一条 polyline。
     不能整条 polyline 一把画 —— null 那一格会被跳过、两端直接连起来，
     视觉上等于「凭空插值」，把「没数据」画成了「平稳过渡」。 */
  series.forEach(function (s) {
    var duan = [], cur = [];
    s.vals.forEach(function (v, i) {
      if (youXiao(v)) cur.push(X(i).toFixed(1) + ',' + Y(v).toFixed(1));
      else { if (cur.length) duan.push(cur); cur = []; }
    });
    if (cur.length) duan.push(cur);
    duan.forEach(function (pts) {
      if (pts.length < 2) return;     // 孤立单点没法画线，靠下面的圆点表达
      g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color +
           '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    });
    s.vals.forEach(function (v, i) {
      if (!youXiao(v)) return;        // 缺失月份不画点
      g += '<circle class="dot" cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) +
           '" r="2.4" fill="' + s.color + '"/>';
    });
  });
  /* 悬停命中区：每个月份一条透明竖条，覆盖全图高度。
     原先把 <title> 挂在 r=2.6 的小圆点上，鼠标几乎命中不了（用户 2026-09-07 反馈
     「悬停数据点看不了具体数值」）；图缩小后圆点更小，只会更难命中。
     改成整列命中还顺带解决了另一个问题：多条线在后几个月几乎重合，
     逐点命中时互相遮挡；整列一次给出所有系列的数值，比单点更有用。
     必须放在折线之后，否则会被折线盖住。 */
  var colW = iw / (labels.length - 1);
  labels.forEach(function (lb, i) {
    var x0 = Math.max(PL, X(i) - colW / 2);
    var wCol = Math.min(W - PR, X(i) + colW / 2) - x0;
    var tip = lb + '\n' + series.map(function (s) {
      /* 缺失月份写明「样本不足」，不写 0 也不留空 ——
         留空会让人以为是渲染 bug，写 0 会被当成真的跌到 0。 */
      return s.name + ' ' + (youXiao(s.vals[i])
        ? num(s.vals[i]) + ' ' + unit : '样本不足');
    }).join('\n');
    g += '<rect class="hit" x="' + x0.toFixed(1) + '" y="' + PT + '" width="' + wCol.toFixed(1) +
         '" height="' + ih + '"><title>' + esc(tip) + '</title></rect>';
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="linechart" role="img">' + g + '</svg>' +
    '<div class="legend">' + series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
    }).join('') + '</div>';
}

/* 迷你竖向柱状图。用于「改编率随榜位分段」「改编形态分布」——
   这两处类目少、数值可比，竖柱比横向长条紧凑得多，也更像常规图表。
   rows = [{k: 类目, v: 数值, t: 显示文本}]，maxVal 传 100 表示百分比刻度。
   eWaiCls：可选的追加 class（如 'mcols-xiao' 把柱子压低）。默认不传保持原样，
   已有 4 处调用方一个字都不用改。 */
function miniColsHtml(rows, color, maxVal, unit, eWaiCls) {
  if (!rows || !rows.length) return '';
  var max = maxVal || Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  return '<div class="mcols' + (eWaiCls ? ' ' + eWaiCls : '') + '">' + rows.map(function (r) {
    var pctH = Math.max(2, r.v / max * 100);      // 至少 2% 高度，避免 0 值完全看不见
    return '<div class="mcol" title="' + esc(r.k) + '：' + esc(r.t != null ? r.t : r.v) + '">' +
           '<div class="mcol-v">' + esc(r.t != null ? r.t : num(r.v)) + '</div>' +
           '<div class="mcol-track"><div class="mcol-fill" style="height:' + pctH.toFixed(1) +
           '%;background:' + color + '"></div></div>' +
           '<div class="mcol-k">' + esc(r.k) + '</div>' +
           '</div>';
  }).join('') + '</div>' +
  (unit ? '<div class="mcols-unit">' + esc(unit) + '</div>' : '');
}

/* ---------------- 表格通用引擎 ---------------- */
/* 搜索 + 筛选 + 排序，tableHtml 与 tableBodyHtml 共用 */
function filterSortRows(cfg, st) {
  var rows = cfg.rows.slice();

  if (st.q) {
    var q = st.q.toLowerCase();
    rows = rows.filter(function (r) {
      return (cfg.searchKeys || ['name']).some(function (k) {
        return String(r[k] || '').toLowerCase().indexOf(q) >= 0;
      });
    });
  }
  if (st.filter && cfg.filterFn) rows = rows.filter(function (r) { return cfg.filterFn(r, st.filter); });

  var sc = cfg.cols.filter(function (c) { return c.k === st.sort; })[0];
  if (sc) {
    var d = st.dir === 'asc' ? 1 : -1;
    rows.sort(function (a, b) {
      var x = a[st.sort], y = b[st.sort];
      if (sc.type === 'text') return String(x || '').localeCompare(String(y || ''), 'zh') * d;
      return ((Number(x) || 0) - (Number(y) || 0)) * d;
    });
  }
  return rows;
}

/* 当前排序是否命中 cfg.sortOptions 里的某一项，返回其 value（"k:dir"）或 ''。 */
function sortOptValue(cfg, st) {
  var hit = '';
  (cfg.sortOptions || []).forEach(function (o) {
    if (st.sort === o.k && st.dir === o.dir) hit = o.k + ':' + o.dir;
  });
  return hit;
}

function tableHtml(cfg) {
  var st = VIEW[cfg.key];
  if (!st) {
    st = VIEW[cfg.key] = { q: '', filter: '', sort: cfg.defaultSort.k,
                           dir: cfg.defaultSort.dir, page: 1, size: 50, open: {} };
  }
  var total = filterSortRows(cfg, st).length;

  /* 工具栏只在整页渲染时生成一次 —— 里面的搜索框绝对不能被后续重建，
     否则 Windows 输入法会话会随旧 input 元素一起终止，中文打不出来。
     「共 N 条」是会变的，所以单独放一个 span 由 refreshTable 更新。 */
  var h = '<div class="toolbar">';
  h += '<input id="q_' + cfg.key + '" placeholder="搜索' + esc(cfg.searchHint || '书名 / 作者') +
       '" value="' + esc(st.q) + '">';
  if (cfg.filters && cfg.filters.length) {
    h += '<select id="f_' + cfg.key + '">' + cfg.filters.map(function (o) {
      return '<option value="' + esc(o.v) + '"' + (st.filter === o.v ? ' selected' : '') + '>' +
             esc(o.label) + '</option>';
    }).join('') + '</select>';
  }
  /* 排序下拉：给「常用排序维度」一个显式入口。表头点击排序依然可用，
     两者共享 st.sort/st.dir；表头排到预设之外时下拉落到 __custom 占位项。 */
  if (cfg.sortOptions && cfg.sortOptions.length) {
    h += '<select id="so_' + cfg.key + '">' + cfg.sortOptions.map(function (o) {
      var v = o.k + ':' + o.dir;
      return '<option value="' + esc(v) + '"' +
             (st.sort === o.k && st.dir === o.dir ? ' selected' : '') + '>' +
             esc(o.label) + '</option>';
    }).join('') +
    '<option value="__custom" disabled' + (sortOptValue(cfg, st) ? '' : ' selected') +
    '>其他（点表头排序）</option></select>';
  }
  h += '<div class="spacer"></div><span class="hint" id="cnt_' + cfg.key + '">共 ' +
       num(total) + ' 条</span>';
  /* 「每页 N 条」下拉按【数据源总量】决定是否渲染，不能用过滤后的 total ——
     否则在 Top1000 页搜索到 50 条以内时下拉会消失，用户再也改不回每页数量。
     各平台 Top50 页数据源本就 <= 50，下拉与分页条都不出现。 */
  if (cfg.rows.length > 50) {
    h += '<select id="sz_' + cfg.key + '">' + [50, 100, 1000].map(function (s) {
      return '<option value="' + s + '"' + (st.size === s ? ' selected' : '') + '>每页 ' + s + '</option>';
    }).join('') + '</select>';
  }
  h += '</div>';

  /* 表体单独一个容器，搜索/排序/翻页/展开都只重建它 */
  h += '<div id="tb_' + cfg.key + '">' + tableBodyHtml(cfg) + '</div>';
  return h;
}

/* 表体 + 分页条。可反复重建，不含任何输入框（跳页框在分页条里，
   但它是 number 类型不涉及输入法，重建无妨）。 */
function tableBodyHtml(cfg) {
  var st = VIEW[cfg.key];
  var rows = filterSortRows(cfg, st);
  var total = rows.length;
  var pages = Math.max(1, Math.ceil(total / st.size));
  if (st.page > pages) st.page = pages;
  var slice = rows.slice((st.page - 1) * st.size, st.page * st.size);
  var grid = cfg.cols.map(function (c) { return c.w; }).join(' ') + ' 24px';

  var h = '<div class="tbl"><div class="tr head" style="grid-template-columns:' + grid + '">';
  cfg.cols.forEach(function (c) {
    var on = st.sort === c.k;
    h += '<div class="cell' + (c.type === 'num' ? ' num' : '') +
         (c.sortable === false ? '' : ' sortable' + (on ? ' on' : '')) +
         '"' + (c.sortable === false ? '' : ' data-sort="' + c.k + '"') + '>' +
         esc(c.label) + (on ? (st.dir === 'asc' ? ' ↑' : ' ↓') : '') + '</div>';
  });
  h += '<div></div></div>';

  if (!slice.length) {
    h += '<div class="tr body" style="grid-template-columns:1fr"><div class="cell dim">无匹配数据</div></div>';
  }
  slice.forEach(function (r, i) {
    var rid = (st.page - 1) * st.size + i;
    var opened = !!st.open[cfg.rowId ? cfg.rowId(r) : r.name];
    h += '<div class="tr body' + (opened ? ' open' : '') + '" data-row="' + rid +
         '" style="grid-template-columns:' + grid + '">';
    cfg.cols.forEach(function (c) {
      var v = c.render ? c.render(r) : esc(r[c.k]);
      h += '<div class="cell' + (c.type === 'num' ? ' num' : '') + (c.dim ? ' dim' : '') +
           (c.cls ? ' ' + c.cls : '') +
           '" title="' + esc(c.title ? c.title(r) : (r[c.k] == null ? '' : r[c.k])) + '">' + v + '</div>';
    });
    h += '<div class="caret">' + (opened ? '▲' : '▼') + '</div></div>';
    if (opened && cfg.detail) {
      var dh = cfg.detail(r);
      if (dh) h += '<div class="detail-panel">' + dh + '</div>';
    }
  });
  h += '</div>';

  /* 只有一页时整条分页器都不显示；多页时额外给一个「跳转到第 N 页」输入框 */
  if (pages > 1) {
    h += '<div class="pager"><span class="info">第 ' + st.page + ' / ' + pages + ' 页</span>' +
         '<button data-pg="1"' + (st.page === 1 ? ' disabled' : '') + '>首页</button>' +
         '<button data-pg="' + (st.page - 1) + '"' + (st.page === 1 ? ' disabled' : '') + '>上一页</button>' +
         '<button data-pg="' + (st.page + 1) + '"' + (st.page === pages ? ' disabled' : '') + '>下一页</button>' +
         '<button data-pg="' + pages + '"' + (st.page === pages ? ' disabled' : '') + '>末页</button>' +
         '<span class="jump">跳至 <input id="jp_' + cfg.key + '" type="number" min="1" max="' +
         pages + '" placeholder="' + st.page + '"> 页' +
         ' <button id="jpgo_' + cfg.key + '" class="go">前往</button></span>' +
         '</div>';
  }

  cfg._slice = slice;
  cfg._total = total;
  return h;
}

/* 局部刷新：只重建表体 + 更新「共 N 条」，**不动工具栏**。
   这是中文输入能用的关键 —— 搜索框 input 元素从头到尾是同一个 DOM 节点，
   不会被销毁，Windows/macOS 输入法会话得以延续。
   搜索、排序、翻页、展开行全部走这里，只有切页/切快照才整页重渲染。 */
function refreshTable(cfg) {
  var box = document.getElementById('tb_' + cfg.key);
  if (!box) { renderPage(true); return; }      // 结构不在（切页了），退回整页
  box.innerHTML = tableBodyHtml(cfg);
  var cnt = document.getElementById('cnt_' + cfg.key);
  if (cnt) cnt.textContent = '共 ' + num(filterSortRows(cfg, VIEW[cfg.key]).length) + ' 条';
  /* 工具栏不重建，所以点表头排序后要手动把排序下拉拨到对应项；
     排到预设之外时落到 __custom 占位项，避免下拉显示成一个错的维度。 */
  var so2 = document.getElementById('so_' + cfg.key);
  if (so2) so2.value = sortOptValue(cfg, VIEW[cfg.key]) || '__custom';
  bindBody(cfg);                                // 表体内的事件要重新挂
}

/* 工具栏事件：整页渲染后绑一次。这里的 input / select 之后都不会被重建。 */
function bindTable(cfg) {
  var st = VIEW[cfg.key];

  var q = document.getElementById('q_' + cfg.key);
  if (q && !q._bound) {
    q._bound = 1;                        // 防止重复绑定（同一元素只绑一次）
    /* 只刷新表体，绝不重建这个 input —— 否则输入法会话中断，中文打不出来。
       IME 组合期间连表体也不刷（候选词还在变，刷了纯属浪费且可能闪烁）。 */
    q.addEventListener('compositionstart', function () { IME_ON = true; });
    q.addEventListener('compositionend', function () {
      IME_ON = false;
      st.q = q.value; st.page = 1;
      refreshTable(cfg);
    });
    q.addEventListener('input', function () {
      st.q = q.value;
      if (IME_ON) return;                // 组合中，等 compositionend
      st.page = 1;
      refreshTable(cfg);
    });
  }

  var f = document.getElementById('f_' + cfg.key);
  if (f && !f._bound) {
    f._bound = 1;
    f.onchange = function () { st.filter = f.value; st.page = 1; refreshTable(cfg); };
  }
  var sz = document.getElementById('sz_' + cfg.key);
  if (sz && !sz._bound) {
    sz._bound = 1;
    sz.onchange = function () { st.size = Number(sz.value); st.page = 1; refreshTable(cfg); };
  }
  var so = document.getElementById('so_' + cfg.key);
  if (so && !so._bound) {
    so._bound = 1;
    so.onchange = function () {
      var v = String(so.value || '').split(':');
      if (v.length !== 2) return;                // __custom 占位项，忽略
      st.sort = v[0]; st.dir = v[1]; st.page = 1;
      refreshTable(cfg);
    };
  }

  bindBody(cfg);
}

/* 表体内的事件：每次 refreshTable 都要重新挂（这些元素被重建了） */
function bindBody(cfg) {
  var st = VIEW[cfg.key];
  var box = document.getElementById('tb_' + cfg.key);
  if (!box) return;

  box.querySelectorAll('.tr.head .sortable').forEach(function (n) {
    n.onclick = function () {
      var k = n.getAttribute('data-sort');
      if (st.sort === k) st.dir = st.dir === 'asc' ? 'desc' : 'asc';
      else { st.sort = k; st.dir = 'desc'; }
      refreshTable(cfg);
    };
  });
  box.querySelectorAll('.pager button[data-pg]').forEach(function (b) {
    b.onclick = function () {
      if (b.disabled) return;
      st.page = Number(b.getAttribute('data-pg'));
      refreshTable(cfg);
    };
  });

  var jp = document.getElementById('jp_' + cfg.key);
  var jpgo = document.getElementById('jpgo_' + cfg.key);
  if (jp && jpgo) {
    var jump = function () {
      var n = Number(jp.value);
      if (!n || n < 1) return;
      var maxPage = Math.max(1, Math.ceil(cfg._total / st.size));
      st.page = Math.min(n, maxPage);
      refreshTable(cfg);
    };
    jpgo.onclick = jump;
    jp.onkeydown = function (e) { if (e.key === 'Enter') jump(); };
  }

  if (cfg.detail) {
    box.querySelectorAll('.tr.body[data-row]').forEach(function (n) {
      n.onclick = function () {
        var idx = Number(n.getAttribute('data-row')) - (st.page - 1) * st.size;
        var r = cfg._slice[idx];
        if (!r) return;
        var id = cfg.rowId ? cfg.rowId(r) : r.name;
        if (st.open[id]) delete st.open[id]; else st.open[id] = 1;
        refreshTable(cfg);
      };
    });
  }
}

/* 详情面板通用片段：题材标签（主 + 子）与作品简介。
   三个平台的下拉框都用它，避免各写一份导致样式与字段名漂移。 */
function bookInfoHtml(r) {
  var out = '';
  var tg = [];
  if (r.tag) tg.push('<span class="tag t-main">' + esc(r.tag) + '</span>');
  (r.sub_tags || []).forEach(function (t) {
    tg.push('<span class="tag">' + esc(t) + '</span>');
  });
  if (tg.length) {
    out += '<div class="dp-title" style="margin-top:12px">题材标签</div>' +
           '<div class="kv">' + tg.join('') + '</div>';
  }
  if (r.abstract) {
    out += '<div class="dp-title" style="margin-top:12px">作品简介</div>' +
           '<div class="kv abstract">' + esc(r.abstract) + '</div>';
  }
  return out;
}

/* ---------------- 页面：番茄榜单 ---------------- */
function renderFanqieBoard(page, snap) {
  var s = snap.stats || {}, m = page.meta || {}, parts = s.parts || {};
  var playlet = parts['短剧'] || 0, manju = parts['漫剧'] || 0, drama = playlet + manju;
  /* ⚠ 原先这里有 `var src = s.heat_src || {}`，供已删的「热度覆盖率」卡用。
     卡在 2026-09-11 删掉后此变量无引用，已移除。
     heat_src 本身仍在 ETL 侧计算，明细表（下方 d.heat_src）还要用来标「红果 / App」。 */

  var h = notesHtml(page);

  /* 告警框只留「本期数据异常」类（热度缺失），因为那是采集出了问题，
     藏进 ⓘ 会被误读成「真的没有热度」。
     而「X 本无对应记录」是分母口径说明，按用户 2026-09-07 要求收进「已改编书数」卡的 ⓘ。 */
  var warns = [];
  var covered = snap.covered != null ? snap.covered : s.book_total;
  var weiCaiJiPop = '';
  if (covered < s.book_total) {
    weiCaiJiPop = popKeHtml(
      '<p class="pop-p">本快照配对的榜单日为 <b>' + esc(snap.bangdan_ri || '—') +
      '</b>（取不晚于改编采集日 ' + esc(snap.date) + ' 的最近一期），共 Top' +
      num(s.book_total) + '。其中 ' + num(s.book_total - covered) +
      ' 本在该期改编数据里没有对应记录（多为该期采集未覆盖到），' +
      '表中显示为 0，不代表其没有改编。改编率按该期有数据的 ' + num(covered) + ' 本计算。</p>',
      '查看已改编书数与分母口径');
  }
  if (s.heat_total > 0 && s.heat_covered === 0) {
    warns.push('该快照日热度全部缺失（番茄 App 当期改版导致热度采集失效）。' +
               '短剧/漫剧部数仍然有效，但热度列不可用。');
  } else if (s.heat_total > 0 && s.heat_covered < s.heat_total) {
    warns.push('该快照日有 ' + num(s.heat_total - s.heat_covered) +
               ' 部短剧/漫剧未取到热度，热度相关指标按已取到的 ' + num(s.heat_covered) + ' 部计算。');
  }
  if (warns.length) {
    h += '<div class="warnbox">' + warns.map(function (w) {
      return '<div class="warn-row">' + w + '</div>';
    }).join('') + '</div>';
  }

  h += '<div class="stats">';
  h += statCard('已改编书数', num(s.adapted_books) + '<small> / ' + num(covered) + '</small>',
                '改编率 ' + pct(s.adapted_books, covered) +
                (covered < s.book_total ? '（按已采 ' + num(covered) + ' 本计）' : ''),
                '', weiCaiJiPop);
  /* Top10 改编率：用户 2026-09-11 指定放在「已改编书数」旁边，且口径与之一致
     （任意改编 total>0 即算，不限短剧/漫剧）。ETL 侧按榜单 rank<=10 统计。 */
  var t10 = s.top10_shu_shu || 0, t10Adapt = s.top10_yi_gaibian || 0;
  h += statCard('Top10 作品改编率', pct(t10Adapt, t10),
                'Top10 中 ' + num(t10Adapt) + ' / ' + num(t10) + ' 本已改编',
                '', popKeHtml(
                  '<p class="pop-p">分子＝榜单前 10 名里存在<b>任意类型</b>改编作品（短剧 / 漫剧 / 真人讲书等）的书数；' +
                  '分母＝前 10 名实际在榜书数。与左侧「已改编书数」<b>同口径</b>，只是把范围缩到头部 10 本。</p>',
                  '查看 Top10 改编率口径'));
  h += statCard('改编作品总数', num(s.parts_total),
                Object.keys(parts).sort(function (a, b) { return parts[b] - parts[a]; })
                  .map(function (k) { return esc(k) + ' ' + parts[k]; }).join(' · '));
  /* 平均改编作品数：用户 2026-09-11 定案 A1 —— 分母只算「有短剧或漫剧改编的书」，
     不是全部在榜书，也不是全部已改编书（后者含只有真人讲书的书，会摊薄影视化深度）。
     口径必须在前端可见（用户明确要求）。浮窗文案由用户 2026-09-11 亲自给定，改动前先问。 */
  var youJu = s.you_duanju_manju_shu || 0;
  h += statCard('平均改编作品数',
                youJu ? (drama / youJu).toFixed(1) : '—',
                '短剧+漫剧 ' + num(drama) + ' 部 / ' + num(youJu) + ' 本',
                '', popKeHtml(
                  '<p class="pop-p">只统计<b>短剧或漫剧</b>改编：分子＝短剧 ' + num(playlet) +
                  ' 部 ＋ 漫剧 ' + num(manju) + ' 部 ＝ ' + num(drama) + ' 部。</p>' +
                  '<p class="pop-p">分母＝<b>有短剧或漫剧改编的书</b>（' + num(youJu) +
                  ' 本），不含只有真人讲书 / 有声等其他形态的书。</p>',
                  '查看平均改编作品数口径'));
  h += '</div>';

  h += insightsHtml(snap.insights);

  var cfg = {
    key: page.key + '@' + (snap.date || ''),
    rows: snap.rows || [],
    defaultSort: { k: 'rank', dir: 'asc' },
    searchKeys: ['name', 'author', 'tag', 'sub_tags'],
    searchHint: '书名 / 作者 / 题材标签',
    rowId: function (r) { return r.name; },
    filters: [
      { v: '', label: '全部改编状态' },
      { v: 'drama', label: '有短剧或漫剧' },
      { v: 'playlet', label: '有真人短剧' },
      { v: 'manju', label: '有漫剧' },
      { v: 'none', label: '暂未跟踪到短剧/漫剧' }
    ],
    filterFn: function (r, f) {
      if (f === 'drama') return (r.playlet + r.manju) > 0;
      if (f === 'playlet') return r.playlet > 0;
      if (f === 'manju') return r.manju > 0;
      if (f === 'none') return (r.playlet + r.manju) === 0;
      return true;
    },
    cols: [
      { k: 'rank', label: '#', w: '38px', type: 'num',
        render: function (r) { return '<span class="rankno">' + r.rank + '</span>'; } },
      { k: 'name', label: '书名', w: 'minmax(0,2.6fr)', type: 'text', cls: 'name' },
      { k: 'tag', label: '题材', w: 'minmax(0,88px)', type: 'text', dim: true },
      { k: 'playlet', label: '短剧', w: '52px', type: 'num',
        render: function (r) { return r.playlet ? num(r.playlet) : '<span style="color:#c4c4ca">0</span>'; } },
      { k: 'manju', label: '漫剧', w: '52px', type: 'num',
        render: function (r) { return r.manju ? num(r.manju) : '<span style="color:#c4c4ca">0</span>'; } },
      { k: 'other', label: '其他', w: '52px', type: 'num', dim: true },
      { k: 'total', label: '改编合计', w: '68px', type: 'num' },
      { k: 'max_heat', label: '最高热度', w: '94px', type: 'num', cls: 'hot',
        render: function (r) { return r.max_heat ? wan(r.max_heat) : '<span style="color:#c4c4ca">—</span>'; } }
    ],
    detail: function (r) {
      if (!r.details || !r.details.length) {
        return '<div class="dp-title">未在番茄 App 改编板块中跟踪到任何改编作品</div>' +
               '<div class="kv">该结果仅代表番茄体系内未查到上线记录，不代表未授权或未改编。</div>' +
               bookInfoHtml(r);
      }
      var dg = 'minmax(0,2.4fr) 62px 86px 134px 100px 54px';
      var x = '<div class="dp-title">该书 ' + r.details.length + ' 部改编作品</div>';
      x += '<div class="dtr dhead" style="grid-template-columns:' + dg + '">' +
           '<div>作品名</div><div>类型</div><div>集数/章数</div><div>推荐值 / 在听</div>' +
           '<div class="cell num">热度</div><div>热度源</div></div>';
      r.details.forEach(function (d) {
        x += '<div class="dtr" style="grid-template-columns:' + dg + '">' +
             '<div class="cell" title="' + esc(d.drama_name) + '">' + esc(d.drama_name) + '</div>' +
             '<div><span class="tag t-' + esc(d.type) + '">' + esc(d.type) + '</span></div>' +
             '<div class="cell dim">' + esc(d.episodes) + '</div>' +
             '<div class="cell dim" title="' + esc(d.rec) + '">' + esc(d.rec) + '</div>' +
             '<div class="cell num' + (d.heat ? ' hot' : ' dim') + '">' + (d.heat ? wan(d.heat) : '—') + '</div>' +
             '<div>' + (d.heat_src ? '<span class="tag src">' + (d.heat_src === 'ext' ? '红果' : 'App') + '</span>' : '') + '</div>' +
             '</div>';
      });
      x += bookInfoHtml(r);
      return x;
    }
  };
  h += tableHtml(cfg);
  h += '<div class="footnote">热度源：「红果」= 采集时由网文大数据红果热度库按剧名+集数匹配命中；'
     + '「App」= 缓存未命中，由番茄 App 详情页兜底读取。真人讲书与漫画无热度概念，不参与热度统计。</div>';
  return { html: h, bind: function () { bindTable(cfg); } };
}

/* ---------------- 页面：番茄改编全库 ---------------- */
function renderWwds(page, snap) {
  var s = snap.stats || {}, t = s.totals || {};
  var perf = s.perf || {}, counts = perf.counts || {}, bands = perf.bands || [];
  /* 月度趋势：与 ETL 洞察同口径，只展示当月上线量达标的月份 */
  var monthly = (s.monthly || []).filter(function (x) { return (x.ai + x.real) >= 300; });

  /* 统计方式·详情讲的是「改编超预期/不及预期」判定 + 各档阈值，
     所以浮窗不放口径卡，挪到下面「改编表现分布」卡的标题右边（用户 2026-09-07 要求）。
     第二个参数 true = 让口径卡的「统计方式」行只留摘要、不出 ⓘ，避免同一份说明出现两次。 */
  /* ⭐ 走 pageNotes 取当期阈值表，不许直接读 page.notes（那是最新一期，切期不变） */
  var wwdsNotes = pageNotes(page);
  var biaoXianPop = tongJiPopHtml(wwdsNotes.tong_ji_xiang, wwdsNotes.tong_ji_biao);
  var h = notesHtml(page, true);

  h += '<div class="stats">';
  h += statCard('已改编小说', num(t.books), '至少 1 部改编作品上线');
  h += statCard('改编作品总数', num(t.dramas), '平均每本 ' + (t.parts_per_book || 0) + ' 部');
  h += statCard('有 AI 漫剧的书', num(t.ai_books), '有真人短剧的书 ' + num(t.real_books) + ' 本');
  /* 副标题带占比（用户 2026-09-11 要求）。
     ⚠ 这三档是等频分位算出来的，占比天然近似恒定（实测三期环比全是 +1.4%）——
       用户已知情并明确接受「就算占比一直不变也没关系」。不要再"优化"成环比。
     分母用三档计数之和，不用 t.books —— 参与判定的书数（有热度）少于已改编书数，
     用 t.books 会让三档占比加不到 100%。 */
  var perfSum = (counts['超预期'] || 0) + (counts['符合预期'] || 0) + (counts['不及预期'] || 0);
  h += statCard('改编表现分布',
                (counts['超预期'] || 0) + ' / ' + (counts['符合预期'] || 0) + ' / ' + (counts['不及预期'] || 0),
                perfSum
                  ? '超预期 ' + pct(counts['超预期'] || 0, perfSum) +
                    ' / 符合预期 ' + pct(counts['符合预期'] || 0, perfSum) +
                    ' / 不及预期 ' + pct(counts['不及预期'] || 0, perfSum)
                  : '超预期 / 符合预期 / 不及预期',
                '', biaoXianPop);
  h += '</div>';

  h += insightsHtml(snap.insights);

  /* 上排两张趋势图左右并列（用户 2026-09-07 要求：右侧原来全空、留白太多）。
     与下排「阈值图 × 题材效率图」共用 .grid2，四张图形成 2×2 网格、左右边界对齐。
     两张都在才并列，只剩一张时整宽输出（并列会被 auto-fit 拉成半宽显得残缺）。 */
  var quShiCharts = [];

  if (monthly.length >= 2) {
    /* 折线图：合计 / AI 漫剧 / 真人短剧 三条线。原先是「每月一根横条」，
       月份多了以后既高又看不出趋势，折线能直接看到交叉点（AI 何时超过真人）。 */
    var last12 = monthly.slice(-12);
    var body = lineChartHtml(
      last12.map(function (x) { return x.month; }),
      [
        { name: '合计', color: '#111114', vals: last12.map(function (x) { return x.ai + x.real; }) },
        { name: 'AI 漫剧', color: '#7c3aed', vals: last12.map(function (x) { return x.ai; }) },
        { name: '真人短剧', color: '#ea580c', vals: last12.map(function (x) { return x.real; }) }
      ]);
    quShiCharts.push(cardHtml('改编作品上线月度趋势',
                  '按上线月份统计当月新增作品数，纵轴为部数；鼠标悬停任一月份看三条线的具体数值',
                  body, 'ka-quxian'));
  }

  /* 热度天花板趋势：真人 vs AI 每月 top N 峰值热度均值，回答「改编剧能达到的
     热度上限是否在逐月升高、谁更高」。X 轴与左图同样取最近 12 个月，两图对齐。
     ⚠️ 副标题必须写明是「历史最高热度」口径：新上线的剧峰值可能还没爬到顶，
     不写清楚会被问「8 月的剧才上线怎么就有峰值」。 */
  var thb = (s.tianhuaban || []).filter(function (x) {
    return x.ai_avg != null || x.real_avg != null;    // 两类都缺的月份直接不入图
  }).slice(-12);
  if (thb.length >= 2) {
    var topN = s.tianhuaban_top_n || 10;
    var minJu = s.tianhuaban_min_ju || 10;
    /* 纵轴单位换成「万」，与页面其他热度展示一致（wan() 用的也是万）。
       null 必须原样透传给 lineChartHtml 走断线逻辑，不许 || 0 —— 补 0 会画出假暴跌。 */
    var toWan = function (v) { return v == null ? null : Math.round(v / 10000); };
    var body3 = lineChartHtml(
      thb.map(function (x) { return x.month; }),
      [
        { name: 'AI 漫剧', color: '#7c3aed', vals: thb.map(function (x) { return toWan(x.ai_avg); }) },
        { name: '真人短剧', color: '#ea580c', vals: thb.map(function (x) { return toWan(x.real_avg); }) }
      ], '万');
    quShiCharts.push(cardHtml('改编剧热度天花板月度趋势',
                  '按上线月份取该月峰值热度前 ' + topN + ' 部的均值，纵轴为热度（万）；' +
                  '热度为红果历史最高热度（非当月值），当月该类型不足 ' + minJu + ' 部则断线不画',
                  body3, 'ka-quxian'));
  }

  if (quShiCharts.length === 2) h += '<div class="grid2">' + quShiCharts.join('') + '</div>';
  else h += quShiCharts.join('');

  /* 阈值图与题材效率图左右并列（用户 2026-09-07 要求「都调小」）。
     复用已有的 .grid2（另一处平台页 charts.length===2 也是这么并的），
     窄屏时 auto-fit 会自动落回单列，不用额外写断点。
     只有两张都在时才并列；单张时并列会拉成半宽显得残缺。 */
  var wwdsCharts = [];

  if (bands.length) {
    /* 原先是一张 6 列阈值表，信息密但很丑。改成竖柱看各档中位热度，
       精确阈值用一行小字说明，需要精确数值的场景本来也不多。
       分位名（p90/p25）从数据里读，不写死 —— ETL 调阈值时页面自动跟随。 */
    var qHi = 'p' + Math.round((bands[0].over_q || 0.9) * 100);
    var qLo = 'p' + Math.round((bands[0].under_q || 0.25) * 100);
    var body1 = miniColsHtml(bands.map(function (x) {
      return { k: '档 ' + x.band, v: x.heat_mid, t: wan(x.heat_mid) };
    }), 'var(--fanqie)', null, '纵轴为该档「改编剧最高热度」中位数（万）', 'mcols-xiao');
    body1 += '<div class="thresh-note">' + bands.map(function (x, i) {
      /* 区间写成开/闭区间，不写「min–max」：用户 2026-09-07 指出
         「档3（1,022,869–55,013,047）」会让听众误以为最高档之外还有书。
         上界一律取「上一档的 cum_read_max」，而不是本档的 min —— 两者之间
         有采样空隙（如 1,022,658 vs 1,022,869），用 min 会让区间对不上。 */
      var qu = (i < bands.length - 1)
        ? '≤ ' + num(x.cum_read_max)
        : '> ' + num(bands[bands.length - 2].cum_read_max);
      return '<span><b>档 ' + x.band + '</b>　累计阅读 ' + qu +
             '　共 ' + num(x.books) + ' 本　超预期线（' + qHi + '） ' +
             wan(x.heat_over) + '　不及预期线（' + qLo + '） ' + wan(x.heat_under) + '</span>';
    }).join('') + '</div>';
    wwdsCharts.push(cardHtml('改编表现判定阈值（按累计阅读分 ' + bands.length + ' 档）',
                  '同档内比较：该书改编剧最高热度高于本档 ' + qHi + ' 记为超预期，低于 ' +
                  qLo + ' 记为不及预期，介于两者之间为符合预期',
                  body1, 'ka-zhuzhuang'));
  }

  var ce = s.cat_eff || [];
  if (ce.length) {
    /* 只画效率高的题材（用户要求）：看"表现最差的题材"没有决策价值，
       而且容易被读成对该题材的否定判断。原先是左右双栏横条，现在单张迷你竖柱。 */
    /* 全局基准 = 1 - 超预期分位（p90 → 约 10%）。不要写死数字，
       否则 ETL 调阈值后这里就变成错的。 */
    var overQ = (bands[0] && bands[0].over_q) || 0.9;
    var base = Math.round((1 - overQ) * 100);
    var body2 = miniColsHtml(ce.slice(0, 8).map(function (r) {
      return { k: r.category, v: r.over_pct, t: r.over_pct + '%' };
    }), 'var(--up)', null,
       '纵轴为该题材中改编表现「超预期」的书占比（%），全局基准约 ' + base + '%',
       'mcols-xiao');
    /* 副标题必须说清分母：全库题材上百个，图上只画 8 个，
       不写「从多少个里挑的」听众会以为只有这几个题材。数字从 stats 取，不写死。 */
    var ceTotal = s.cat_eff_total || ce.length;
    var ceBooks = s.cat_eff_books || 0;
    var fenMu = '共 ' + ceTotal + ' 个题材参与排名';
    if (ceBooks && s.totals && s.totals.books) {
      fenMu += '，覆盖全库 ' + (ceBooks / s.totals.books * 100).toFixed(1) + '% 的书';
    }
    wwdsCharts.push(cardHtml('题材改编效率（表现较好的题材）',
                  '超预期 = 该书改编剧最高热度高于同体量档 p' + Math.round(overQ * 100) +
                  '；仅统计样本 150 本以上的题材，' + fenMu + '，图上按超预期占比取前 8',
                  body2, 'ka-zhuzhuang'));
  }

  /* 两张都在才并列；只剩一张时并列会被 auto-fit 拉成半宽显得残缺，直接整宽输出。 */
  if (wwdsCharts.length === 2) h += '<div class="grid2">' + wwdsCharts.join('') + '</div>';
  else h += wwdsCharts.join('');

  var cfg = {
    key: page.key + '@' + (snap.date || ''),
    rows: snap.rows || [],
    defaultSort: { k: 'max_heat', dir: 'desc' },
    /* 排序维度显式给出：默认「改编剧最高热度」，但那个指标同时也是超预期判定依据，
       所以前几页必然全是超预期。想看「大 IP 的改编成绩如何」应切到「累计阅读」。 */
    sortOptions: [
      { k: 'max_heat', dir: 'desc', label: '按改编剧最高热度' },
      { k: 'cum_read', dir: 'desc', label: '按原著累计阅读' },
      { k: 'read14', dir: 'desc', label: '按原著 14 天在读' },
      { k: 'parts', dir: 'desc', label: '按改编部数' }
    ],
    searchKeys: ['name', 'author', 'category'],
    searchHint: '书名 / 作者 / 题材',
    rowId: function (r) { return r.name; },
    filters: [
      { v: '', label: '全部作品形态' },
      { v: 'real', label: '有真人短剧' },
      { v: 'ai', label: '有 AI 漫剧' },
      { v: 'both', label: '真人 + AI 都有' },
      { v: 'over', label: '改编表现超预期' },
      { v: 'under', label: '改编表现不及预期' }
    ],
    filterFn: function (r, f) {
      if (f === 'real') return r.real_cnt > 0;
      if (f === 'ai') return r.ai_cnt > 0;
      if (f === 'both') return r.real_cnt > 0 && r.ai_cnt > 0;
      if (f === 'over') return r.perf === '超预期';
      if (f === 'under') return r.perf === '不及预期';
      return true;
    },
    cols: [
      { k: 'max_heat', label: '最高热度', w: '94px', type: 'num', cls: 'hot',
        /* 该书全部改编剧中「红果最高热度」的最大值（峰值口径，非最新值） */
        render: function (r) { return r.max_heat ? wan(r.max_heat) : '—'; } },
      { k: 'name', label: '书名', w: 'minmax(0,2.4fr)', type: 'text', cls: 'name' },
      { k: 'category', label: '题材', w: 'minmax(0,86px)', type: 'text', dim: true },
      { k: 'cum_read', label: '累计阅读', w: '98px', type: 'num' },
      { k: 'read14', label: '14天在读', w: '88px', type: 'num', dim: true },
      { k: 'real_cnt', label: '真人短剧', w: '68px', type: 'num' },
      { k: 'ai_cnt', label: 'AI 漫剧', w: '66px', type: 'num' },
      { k: 'perf', label: '改编表现', w: '82px', type: 'text', sortable: false,
        render: function (r) { return r.perf ? '<span class="tag perf-' + esc(r.perf) + '">' + esc(r.perf) + '</span>' : '—'; } }
    ],
    detail: function (r) {
      var d = r.top_drama;
      if (!d) return '<div class="dp-title">该书暂无改编作品明细</div>';
      var x = '<div class="dp-title">热度最高的 1 部改编作品' +
              (r.parts > 1 ? '（该书共 ' + num(r.parts) + ' 部，本页仅存最高热度那部）' : '') + '</div>';
      x += '<div class="kv"><b>' + esc(d.drama_name) + '</b> ' +
           '<span class="tag t-' + esc(d.type) + '">' + esc(d.type === 'AI' ? 'AI 漫剧' : '真人短剧') + '</span> ' +
           esc(d.episodes) + ' 集 · 上线 ' + esc(d.online || '—') + '</div>';
      /* 历史最高放前面并加粗：列表的「最高热度」列就是这个值，两者必须一眼对得上。
         最新热度会随时间衰减，只作参考放后面。 */
      /* ⛔ 「总收藏」已删（用户 2026-09-14）：上游 xlsx 的「红果总收藏」整列
         59,260 行**全部为 None**（实测，不是我们取错列），展示出来恒为「总收藏 0」，
         会被读成"这部剧零收藏"。该字段若上游恢复供数，再加回来并先核实分布。 */
      x += '<div class="kv" style="margin-top:5px">历史最高热度 <b style="color:var(--up)">' +
           wan(d.heat_max || d.heat) + '</b>（榜单排序依据）· 最新热度 ' + wan(d.heat) +
           ' · 追剧 ' + num(d.follow) + ' · 趋势 ' + esc(d.trend || '—') + '</div>';
      if (d.tags) x += '<div class="kv" style="margin-top:5px">题材标签 ' + esc(d.tags) + '</div>';
      return x;
    }
  };
  h += tableHtml(cfg);
  return { html: h, bind: function () { bindTable(cfg); } };
}

/* ---------------- 页面：起点 / 晋江 ---------------- */
function renderCopyrightBoard(page, snap) {
  var s = snap.stats || {}, m = page.meta || {};
  var plat = page.platform;
  var isJJ = plat === 'jjwxc';
  var baseBooks = s.books_with_detail || s.books || 0;
  var tags = s.tag_counts || [];

  var h = notesHtml(page);

  /* 「未采集」说明：书单取「<= 本快照日的最近榜单日」的 TopN（2026-09-08 起按快照配对），
     该期采集时若个别书刚上榜、或采集未覆盖到，就会出现「该期无数据」。
     这不是采集失败，是分母口径，需要如实解释避免误读。
     用户 2026-09-07 要求：这类口径说明不再占一整条告警框，收进「在榜作品」卡的 ⓘ 浮窗。 */
  var covered = snap.covered != null ? snap.covered : baseBooks;
  var weiCaiJiPop = '';
  if (covered < s.books) {
    weiCaiJiPop = popKeHtml(
      '<p class="pop-p">本快照配对的榜单日为 <b>' + esc(snap.bangdan_ri || '—') +
      '</b>（取不晚于改编采集日 ' + esc(snap.date) + ' 的最近一期），共 Top' +
      num(s.books) + '。其中 ' + num(s.books - covered) +
      ' 本在该期改编数据里没有对应记录（多为该期采集未覆盖到），' +
      '表中显示为「未采集」。改编率按该期有数据的 ' + num(covered) + ' 本计算。</p>',
      '查看在榜作品与未采集口径');
  }
  var denom = covered || baseBooks;

  h += '<div class="stats stats-3">';
  /* 副标题统一写「榜单 TopN」。
     ⛔ 不要给 qidian_coll 单独写成「N 本有改编数据」（2026-09-09 用户明确删除）：
     那个 N 是 books_with_detail = 改编字段**已采到**的书数（含平台明确写「无」的，
     如《圣墟》adaptation_raw='无'），极易被读成「N 本有改编」，与右边
     「已披露改编 403」当场矛盾（实测 960 在榜 / 919 已采 / 403 有改编）。
     已采与未采的差额由上面 weiCaiJiPop 的 ⓘ 浮窗解释，不塞进副标题。 */
  h += statCard('在榜作品', num(s.books), '榜单 Top' + num(m.top_n || s.books),
                '', weiCaiJiPop);
  h += statCard('已披露改编', num(s.adapted), '改编率 ' + pct(s.adapted, denom) +
                (covered < s.books ? '（按已采 ' + num(covered) + ' 本计）' : ''));
  /* ⛔ 2026-09-08 用户明确删掉「改编形态种类」指标卡：与下方「改编形态分布」柱图
     信息冗余（卡里 slice(0,3) 还只能显示前 3 类，晋江积分榜实际有 30 类，看着像漏数据）。
     不要再加回来。`tags` 变量必须保留 —— 下方柱图还在用（tags.slice(0, 8)）。 */
  if (isJJ && s.depth && s.depth.max_types) {
    h += statCard('单本最多签约类型', num(s.depth.max_types),
                  '《' + esc(s.depth.max_book) + '》· 中位 ' + num(s.depth.median_types) + ' 类');
  } else if (s.buckets && s.buckets.length) {
    var b0 = s.buckets[0], bl = s.buckets[s.buckets.length - 1];
    h += statCard('头部 / 尾部改编率', pct(b0.adapted, b0.books) + ' → ' + pct(bl.adapted, bl.books),
                  b0.label + ' vs ' + bl.label, 'down');
  } else {
    h += statCard('样本题材数', num((s.cat_rows || []).length), '按平台主题材归类');
  }
  h += '</div>';

  h += insightsHtml(snap.insights);

  /* 两张图并排：类目都不多，用迷你竖柱比横向长条紧凑得多 */
  var charts = [];
  if (s.buckets && s.buckets.length > 1) {
    charts.push(cardHtml('改编率随榜位分段', '已披露改编的书数占该段书数的比例',
      miniColsHtml(s.buckets.map(function (b) {
        var v = b.books ? b.adapted / b.books * 100 : 0;
        return { k: b.label, v: Math.round(v * 10) / 10,
                 t: (Math.round(v * 10) / 10) + '%' };
      }), 'var(--' + plat + ')', 100, '纵轴为改编率（0–100%）')));
  }
  if (tags.length) {
    charts.push(cardHtml('改编形态分布', '按书数统计，同一本书可有多种形态',
      miniColsHtml(tags.slice(0, 8).map(function (x) {
        return { k: x.tag, v: x.books, t: num(x.books) };
      }), 'var(--' + plat + ')', null, '纵轴为书数（本）')));
  }
  if (charts.length === 2) h += '<div class="grid2">' + charts.join('') + '</div>';
  else if (charts.length === 1) h += charts.join('');
  /* ⛔ 2026-09-09 用户明确删掉「整榜零签约时的空状态图卡」，charts 为空就什么都不渲染。
     背景：晋江积分月榜 Top50 四期 adapted 恒为 0（已核实**不是 bug**——月榜是当月新热文，
     平台版权状态全部为「尚未出版（联系出版）」；同一批书在积分榜 Top1000 库里取值一致，
     两库交集 50/50 关联正确），所以这张卡在该页是**常驻**空卡，毫无信息量。
     「整榜零签约」这件事已由 lib_insight.no_signing_insight() 的洞察卡完整解释。
     不要再加回来。 */

  var cols = [
    { k: 'rank', label: '#', w: '40px', type: 'num',
      render: function (r) { return '<span class="rankno">' + r.rank + '</span>'; } },
    { k: 'name', label: '书名', w: 'minmax(0,2.4fr)', type: 'text', cls: 'name' },
    { k: 'author', label: '作者', w: 'minmax(0,98px)', type: 'text', dim: true },
    { k: 'tag', label: '题材', w: 'minmax(0,94px)', type: 'text', dim: true }
  ];
  if (isJJ) {
    cols.push({ k: 'word_count', label: '字数', w: '76px', type: 'text', dim: true, sortable: false });
    cols.push({ k: 'tag_cnt', label: '签约类型数', w: '86px', type: 'num' });
  } else {
    cols.push({ k: 'word_count', label: '字数', w: '78px', type: 'text', dim: true, sortable: false });
    cols.push({ k: 'total_rec_num', label: '总推荐', w: '88px', type: 'num',
      render: function (r) { return esc(r.total_rec || '—'); } });
  }
  cols.push({ k: 'adaptation_raw', label: '改编情况', w: 'minmax(0,2.2fr)', type: 'text', sortable: false,
    render: function (r) {
      if (!r.tags || !r.tags.length) {
        return '<span class="tag none">' + esc(r.adaptation_raw === '未采集' ? '未采集' : '未披露改编') + '</span>';
      }
      return r.tags.slice(0, 4).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') +
             (r.tags.length > 4 ? '<span class="tag none">+' + (r.tags.length - 4) + '</span>' : '');
    },
    title: function (r) { return r.adaptation_raw; } });

  var cfg = {
    key: page.key + '@' + (snap.date || ''),
    rows: snap.rows || [],
    defaultSort: { k: 'rank', dir: 'asc' },
    searchKeys: ['name', 'author', 'tag', 'sub_tags', 'adaptation_raw'],
    searchHint: '书名 / 作者 / 题材标签 / 改编类型',
    rowId: function (r) { return r.rank + '_' + r.name; },
    filters: [
      { v: '', label: '全部改编状态' },
      { v: 'yes', label: '已披露改编' },
      { v: 'no', label: '未披露改编' }
    ],
    filterFn: function (r, f) {
      if (f === 'yes') return r.adapted;
      if (f === 'no') return !r.adapted;
      return true;
    },
    cols: cols,
    detail: function (r) {
      /* 改编版权：只展示拆解后的类型 chip。原先还有一行「平台披露原文」，
         内容与 chip 完全重复（如「影视，漫画，出版」vs 三个 chip），已去掉。 */
      var x = '<div class="dp-title">改编与版权信息</div>';
      if (r.tags && r.tags.length) {
        x += '<div class="kv">已披露 ' + r.tags.length + ' 类：' +
             r.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') + '</div>';
      } else {
        x += '<div class="kv">该书在平台未公开任何改编版权信息。'
           + '显示为未披露仅表示平台未公开，不代表未授权或未改编。</div>';
      }

      var kv = [];
      if (r.novel_type) kv.push('分类 ' + r.novel_type);
      if (r.progress) kv.push('进度 ' + r.progress);
      if (r.status) kv.push('状态 ' + r.status);
      if (r.word_count) kv.push('字数 ' + r.word_count);
      if (r.total_rec) kv.push('总推荐 ' + r.total_rec);
      if (r.week_rec) kv.push('周推荐 ' + r.week_rec);
      if (r.sign_status) kv.push('签约 ' + r.sign_status);
      if (kv.length) x += '<div class="kv" style="margin-top:8px">' + esc(kv.join(' · ')) + '</div>';

      x += bookInfoHtml(r);      /* 题材标签 + 作品简介 */
      if (r.book_url) {
        x += '<div class="kv" style="margin-top:8px"><a href="' + esc(r.book_url) +
             '" target="_blank" rel="noopener">打开原书页 ↗</a></div>';
      }
      return x;
    }
  };
  h += tableHtml(cfg);
  if (page.key === 'qidian_coll') {
    /* ⛔ 这里原来只写「919 本有改编数据」（2026-09-09 用户明确要求删掉）：
       "有改编数据" 指的是"改编字段已采到"，被读成"有改编"，与「已披露改编 403」矛盾。
       现在把 960 → 919 → 403 三层漏斗和 41 本的成因一次说清，不留歧义。
       41 本的真实原因（已核实）：起点书页详情抓取失败被跳过，
       07-09 那轮失败 41 本、07-10 续跑再试同一批仍全部失败（222 待抓 - 181 成功 = 41），
       与书的状态/题材无关，属该 41 本书页稳定抓不到。 */
    h += '<div class="footnote">在榜 ' + num(s.books) + ' 本中，已采到改编字段的 ' +
         num(baseBooks) + ' 本（含平台明确标注「无」的），其中 ' + num(s.adapted) +
         ' 本有改编披露，改编率即 ' + num(s.adapted) + '/' + num(baseBooks) + '。另有 ' +
         num(s.books - baseBooks) + ' 本因书页详情抓取失败未采到改编字段（表中显示「未采集」），' +
         '不计入分母，也不代表它们没有改编。该榜目前只采集过一期' +
         '（改编详情分 2 天跑完，属同一期），因此暂无历史快照可切换。</div>';
  }
  return { html: h, bind: function () { bindTable(cfg); } };
}

/* ---------------- 页面：概览 ----------------
   2026-09-14 用户定案的四块结构，改动前必读这段注释：

   ① 头部改编速览  六榜各 Top10 **逐本明细**（不是改编率！草稿做成百分比卡被驳回）。
                   短期榜在左、长期榜在右，按平台分三行。
                   ⛔ 每张卡**必须满 10 行**，未改编/无签约的书要露出空行。
   ② 三平台改编分布 **统一用三个长期榜**（巅峰榜 Top30 / 收藏榜 Top1000 / 积分榜 Top1000）。
                   ⛔ 绝不是"哪个榜数据多挑哪个"——番茄短期榜数据更丰富，
                     但混着用就成了挑数据（2026-09-14 已被用户驳回一次）。
                   横条（用户指定，非饼图），三张独立卡各自标口径行与日期。
   ③ 本期新增      C1（全库 parts_per_book 逐期趋势）+ C3（头部个别书部数增长）。
                   ⛔ 不出 C2「榜单头部平均改编部数」，也**不解释它为什么下降**
                     （用户 2026-09-14 明确）。想加请先问过用户。
   ④ 概览洞察      文案全部由 ETL 侧 lib_insight.gailan_insights() 生成。

   ⛔ 已删且不要写回来的两块：
      - 「各数据集概览」入口表（用户：一点信息量没有）
      - 「各榜单改编率横向对比」横条（用户：这几个平台不可横向对比）
        随之 [data-goto] 跳转也没了，bind 里不必再绑。 */

/* 类型名简称表（用户 2026-09-14 定：去掉末尾「签约」两字，节省列宽）。
   ⚠ 晋江有 32 种类型，全名最长 11 字（「中国大陆出版最新签约」），
     横排根本排不下。但**只在展示层做简称**，数据层保留全名：
       · 列宽按简称算，不会因换期类型名变长而崩；
       · 鼠标悬停 title 仍是全名，不丢信息。
   两个特例按用户原话单独映射，其余统一去掉末尾「签约」。 */
var G10_LEI_JIANCHENG = {
  '中国大陆出版最新签约': '中国大陆出版',
  '繁体出版(港/台)签约': '繁体出版(港/台)'
};

function gailanJianCheng(t) {
  if (G10_LEI_JIANCHENG[t]) return G10_LEI_JIANCHENG[t];
  return String(t || '').replace(/签约$/, '') || t;
}

/* ① 取「该榜 Top10 内实际出现过的改编类型」，作为表头列。
   ⚠ 不用全榜类型集：晋江全榜有 32 种，Top10 内只出现十几种，
     用全榜的会撑出一屏表头 + 一排空列。Top10 内有出现的才有信息量。
   并且两期榜单同名同 rank，表头在两期之间稳定 —— 不存在"换期列宽跳变"。 */
function gailanLeiBiao(b) {
  var seen = {}, out = [];
  (b.rows || []).forEach(function (r) {
    (r.qianyue_leixing || []).forEach(function (t) {
      if (!seen[t]) { seen[t] = true; out.push(t); }
    });
  });
  return out;
}

/* ① 单个榜的 Top10 明细卡。
   番茄：短剧/漫剧/其他 三列直接给部数（用户 2026-09-14 定案）。
   起点/晋江：**模仿番茄做成「一类型一列」**，有就 √、没有留空
     （用户 2026-09-14 明确：不要一行一个改编）。
     ⚠ 列是「平台自己的签约类型」，番茄列是「改编形态」，两者语义不同，
       卡片副标题与脚注必须各自写明，不能并排比数值。

   ⚠ 横向对齐（用户 2026-09-14 要求在「模块之间」左右上下都要对齐）：
     同一行两张卡的列宽规则必须一致 —— 否则起点卡的第一列标签
     和晋江卡的第一列标签会错开，看起来就是没对齐。
     做法：① 用同一个 `gridTemplateColumns()` 生成器；② # / 书名 /
     类型列都用**同样的 px 宽度**；③ 书名列吃 1fr，把前面几张表
     压成等宽（这是对齐的前提，不是巧合）；④ 副标题固定在最后写。 */

/* 列宽规则。
   ⚠ 每个 `.g10-tr` 是**独立的一个 grid**，列宽必须定死 px ——
     用 auto 会各行按自己的内容解析，行与行立刻错位（竖排时代列宽固定 20/24px
     没暴露这个问题，改横排后字宽不一，必须重算）。
   类型列宽 = 本卡内**最长简称**折算的 px，类型之间等宽（行才对得齐）。
   书名列给 110px 下限，表再窄也不会把书名挤没。
   总宽超卡片时由外层 `.g10-scroll` 横向滚动（用户 2026-09-14：容不下就加滚动条）。 */
var G10_SHUMING_KUAN = 110;
var G10_LIE_JIANXI = 8;        // 必须与 .g10-tr 的 gap 一致，否则 min-width 算少、最后一列被裁

function gailanLeiKuan(ge) {
  var m = 2;
  (ge || []).forEach(function (t) {
    var n = gailanJianCheng(t).length;
    if (n > m) m = n;
  });
  return Math.min(96, Math.round(m * 11.5 + 10));
}

function gailanGrid(plat, ge) {
  if (plat === 'fanqie') {
    return '28px minmax(' + G10_SHUMING_KUAN + 'px,1fr) 46px 46px 46px';
  }
  var w = gailanLeiKuan(ge);
  return '28px minmax(' + G10_SHUMING_KUAN + 'px,1fr)' +
         new Array(ge.length + 1).join(' ' + w + 'px');
}

/* 表格最小宽度：卡片比它窄就出现横向滚动条。
   ⚠ 必须把列间距算进去 —— 少算 (k+1)*8 会让最后一列被裁掉一点。 */
function gailanZuiXiao(plat, ge) {
  var k = plat === 'fanqie' ? 3 : ge.length;
  var w = plat === 'fanqie' ? 46 : gailanLeiKuan(ge);
  return 28 + G10_SHUMING_KUAN + k * w + (k + 1) * G10_LIE_JIANXI;
}

/* ① 表头：书名那一格右边带一个小注（番茄「单位：部」/ 起晋「签约」）。 */
function gailanHeadHtml(b, ge, grid) {
  var isFanqie = b.platform === 'fanqie';
  var h = '<div>#</div>' +
          '<div class="g10-shu">书名<i>' + (isFanqie ? '单位：部' : '签约') + '</i></div>';
  if (isFanqie) {
    ['短剧', '漫剧', '其他'].forEach(function (t) {
      h += '<div class="g10-lei">' + t + '</div>';
    });
  } else {
    ge.forEach(function (t) {
      /* 显示用简称、title 保留全名 —— 简称只是省列宽，不能把信息弄丢 */
      h += '<div class="g10-lei" title="' + esc(t) + '">' + esc(gailanJianCheng(t)) + '</div>';
    });
  }
  return '<div class="g10-tr g10-head" style="grid-template-columns:' +
         grid + '">' + h + '</div>';
}

function gailanTop10Card(b) {
  var isFanqie = b.platform === 'fanqie';
  var qiXianTxt = b.qi_xian === 'duan' ? '短期榜' : '长期榜';
  var head = cardHtml(b.label, qiXianTxt + ' · Top10',
    '<div class="empty-box">' + esc(b.wu_fa_xianshi) + '</div>');
  if (b.wu_fa_xianshi) return head;

  var rows = b.rows || [];
  var ge = isFanqie ? [] : gailanLeiBiao(b);
  var grid = gailanGrid(b.platform, ge);

  /* 长类型名改横排后总宽可能超过卡片（晋江 Top10 实测 14 列 ≈ 1.3k px），
     外层 .g10-scroll 给横向滚动条，表本身用 min-width 撑住不被压扁。 */
  var body = '<div class="g10-scroll"><div class="g10-tbl" style="min-width:' +
             gailanZuiXiao(b.platform, ge) + 'px">' + gailanHeadHtml(b, ge, grid);
  rows.forEach(function (r) {
    var cells = isFanqie
      ? ['duanju', 'manju', 'qita'].map(function (k) {
          var v = r[k] || 0;
          /* 0 值压灰而不是留空 —— 留空会被当成"没采到"，0 是真的 0 */
          return '<div class="g10-num' + (v ? '' : ' z') + '">' + v + '</div>';
        }).join('')
      : ge.map(function (t) {
          /* √ = 平台在本期公开披露了这一签约类型；空 = 没披露。
             ⚠ 空 ≠ 没签约，脚注里必须写清（原来是「未采集 / 无签约」两种态，
               现在统一成"空"，所以脚注要把两件事都覆盖到）。 */
          var you = (r.qianyue_leixing || []).indexOf(t) >= 0;
          return '<div class="g10-lei g10-gou">' + (you ? '√' : '') + '</div>';
        }).join('');
    body += '<div class="g10-tr" style="grid-template-columns:' + grid + '">' +
            '<div><span class="rankno">' + (r.rank || '—') + '</span></div>' +
            '<div class="cell name" title="' + esc(r.name) + '">' + esc(r.name) + '</div>' +
            cells + '</div>';
  });
  body += '</div></div>';

  /* 脚注：口径 + 两个日期。番茄巅峰榜实测榜单日与改编采集日能差 9 天，
     只标一个会让读者以为是同一天的数据。 */
  var foot = isFanqie
    ? '数字为番茄 App 改编板块内已上线的作品部数（可有多部）。'
    : '每列是平台公开披露的一种版权签约类型，√ 表示该书被标注了该类型，'
      + '空表示本期页面未披露——空不等于未签约，更不代表未改编；'
      + '一本书可以同时被标注多种类型，所以一行可以有多个 √。';
  foot += '榜单日 ' + esc(b.bangdan_ri || '—') + '，改编采集日 ' + esc(b.caiji_ri || '—');
  if (b.bangdan_ri && b.caiji_ri && b.bangdan_ri !== b.caiji_ri) foot += '（两者不同期）';
  foot += '。';
  if (rows.length < 10) {
    foot += ' ⚠ 该榜当期仅取到 ' + rows.length + ' 行（预期 10 行）。';
  }
  body += '<div class="g10-foot">' + esc(foot) + '</div>';
  return cardHtml(b.label, qiXianTxt + ' · Top10', body);
}

/* ② 单个长期榜的分布卡 */
function gailanFenbuCard(f) {
  if (f.wu_fa_xianshi) {
    return cardHtml(f.label, '改编分布',
      '<div class="empty-box">' + esc(f.wu_fa_xianshi) + '</div>');
  }
  var xiang = f.xiang || [];
  if (!xiang.length) {
    return cardHtml(f.label, '改编分布',
      '<div class="empty-box">该榜当期没有任何改编/签约标注，无分布可画。</div>');
  }
  var color = 'var(--' + (f.platform || 'overview') + ')';
  if (f.platform !== 'fanqie' && f.platform !== 'qidian' && f.platform !== 'jjwxc') {
    color = 'var(--ink)';
  }
  var rows = xiang.map(function (x) {
    return { k: x.k, v: x.v, t: num(x.v) + ' ' + (f.dan_wei || '') };
  });
  var body = barsHtml(rows, color);
  var foot = f.kou_jing + '。';
  if (f.lei_mu_zong > xiang.length) {
    foot += '共 ' + f.lei_mu_zong + ' 类，图示数量前 ' + xiang.length + ' 类。';
  }
  foot += '榜单日 ' + esc(f.bangdan_ri || '—') + '，改编采集日 ' + esc(f.caiji_ri || '—') + '。';
  if (f.qi_shu < 2) foot += '该榜目前仅 ' + f.qi_shu + ' 期，暂无法与历史对比。';
  body += '<div class="g10-foot">' + esc(foot) + '</div>';
  return cardHtml(f.label, '长期榜 · 改编分布（单位：' + (f.dan_wei || '') + '）', body);
}

/* ③ 全库改编深度逐期（C1）。
   ⚠ 刻意用横条不用折线：只有 6 期、且量级差只有 0.2 部，折线会把 2.1→2.3
      画成陡坡，视觉上夸大变化。横条按绝对值等比，读者自己看得出"缓慢上升"。 */
function gailanPpbHtml(ppb) {
  if (!ppb || !ppb.length) {
    return '<div class="g-xz-none">番茄改编全库暂无可用期次，无法显示深度趋势。</div>';
  }
  var max = Math.max.apply(null, ppb.map(function (x) { return x.ppb; }).concat([1]));
  var h = '<div class="g-ppb">' + ppb.map(function (x, i) {
    return '<div class="g-ppb-row' + (i === ppb.length - 1 ? ' now' : '') + '">' +
      '<div class="rq">' + esc((x.ri || '').slice(5)) + '</div>' +
      '<div class="bar-track"><div class="bar-fill" style="width:' +
      (x.ppb / max * 100).toFixed(1) + '%;background:var(--fanqie)"></div></div>' +
      '<div class="vv">' + x.ppb + ' 部/本</div></div>';
  }).join('') + '</div>';
  var tou = ppb[0], wei = ppb[ppb.length - 1];
  h += '<div class="g10-foot">' + esc(
    '平均每本改编部数 = 该期改编作品总部数 / 入库小说数。' +
    tou.ri + ' 共 ' + num(tou.books) + ' 本 / ' + num(tou.dramas) + ' 部，' +
    wei.ri + ' 共 ' + num(wei.books) + ' 本 / ' + num(wei.dramas) + ' 部。' +
    '该口径覆盖番茄改编全库（非榜单头部）。') + '</div>';
  return h;
}

/* ── ③·五 番茄全库「热度分层分布」趋势（2026-09-14 新增）──────────────
   每月两根柱（AI 漫剧 / 真人短剧），柱内按三档堆叠：
     <3000 万（最浅）/ 3000-6000 万（中间）/ ≥6000 万（最深，同色系）。
   ⚠ 柱高 = 该月新上线部数，AI 与真人**共用同一纵轴**，谁多谁少一眼可见。
     真人柱在近月很矮是真实形态（AI 已占绝对多数），压成等高反而是在撒谎。

   ⚠⚠ ⛔ 柱高必须**严格等于当月真实部数**（用户 2026-09-14 明确：原实现把高档段
     「抬高柱顶」补高度，总高与部数对不上，失真）。
     ≥6000 万档实测只占 0.19%（全库 109 部），等比画出来确实是发丝，
     所以允许**在柱内做守恒微调**：从紧邻的 3000-6000 万段匀出 ≤ RF_GAO_BU 像素
     给 ≥6000 万段 —— **mid 减多少、high 加多少，三段之和与柱顶高度完全不变**。
     ⛔ 不许再抬高柱顶、不许给任何段加保底高度（那都会让总高对不上部数）。
     ⛔ 匀的量**双封顶**（≤3px 且 ≤ 柱高 10%）：真人柱近月只有 7px 高，
        匀 3px 会让高档占 41% 而真实仅 2.7% —— 那是把图改错，比发丝更糟。
     ⛔ 不许反过来改切点让高档变粗 —— 切点是用户定的业务口径，
        改切点等于改结论（MEMORY 第 5 条铁律）。
     ⛔ 高档段不再画 ▲ 与柱顶数字：悬停提示已给出每档精确部数（用户 2026-09-14）。 */
var RF_GAO_BU = 3;             // ≥6000 万段最多从 3000-6000 万段匀出的像素（守恒，不改总高）
var RF_GAO_BU_PCT = 0.10;      // 高档段**最终高度**不超过本柱总高的 10%（矮柱上 3px 就是 40%，那是改错图）
var RF_SE = {                  // 三档同色系，浅 → 深；AI 紫系、真人橙系
  ai:   { low: '#C4B5FD', mid: '#7C3AED', high: '#3B0764' },
  real: { low: '#FED7AA', mid: '#EA580C', high: '#7C2D12' }
};

function reduFencengHtml(rf) {
  var rows = (rf && rf.rows) || [];
  if (rf && rf.wu_fa_xianshi) {
    return '<div class="empty-box">' + esc(rf.wu_fa_xianshi) + '</div>';
  }
  if (rows.length < 2) {
    return '<div class="empty-box">番茄改编全库可归月的改编作品不足 2 个月，无法画趋势。</div>';
  }
  var W = 680, H = 210, PL = 46, PR = 14, PT = 30, PB = 26;
  var iw = W - PL - PR, ih = H - PT - PB;
  var gw = iw / rows.length;                 // 每月一组（两根柱）
  var bw = 19, bgap = 3;                     // 柱宽 / 两柱间距
  var pairW = bw * 2 + bgap;

  /* 共用纵轴上界：取 AI 与真人**所有月份**的最大值。
     不能各自缩放 —— 那会让「AI 占绝对多数」这个事实消失。 */
  var maxV = 1;
  rows.forEach(function (r) {
    if (r.ai.total > maxV) maxV = r.ai.total;
    if (r.real.total > maxV) maxV = r.real.total;
  });
  var step = Math.pow(10, String(Math.floor(maxV)).length - 1);
  var top = Math.ceil(maxV / step) * step;
  var Y = function (v) { return PT + ih - v / top * ih; };
  var X = function (i, k) {                  // 第 i 月第 k 根柱（0=AI,1=真人）的左边界
    return PL + i * gw + (gw - pairW) / 2 + k * (bw + bgap);
  };

  var g = '';
  /* 横向网格线 + Y 轴刻度（4 等分） */
  for (var t = 0; t <= 4; t++) {
    var v = top / 4 * t, y = Y(v);
    g += '<line x1="' + PL + '" y1="' + y.toFixed(1) + '" x2="' + (W - PR) +
         '" y2="' + y.toFixed(1) + '" stroke="var(--line)" stroke-width="1"/>' +
         '<text x="' + (PL - 7) + '" y="' + (y + 3.5).toFixed(1) +
         '" text-anchor="end" font-size="10" fill="var(--ink-3)">' +
         num(Math.round(v)) + '</text>';
  }

  /* 柱体：自下而上 low → mid → high。
     ⛔ 三段高度之和必须 == 该月真实部数的等比高度，柱顶 = 真实值（用户 2026-09-14）。 */
  rows.forEach(function (r, i) {
    ['ai', 'real'].forEach(function (lei, k) {
      var d = r[lei], x = X(i, k);
      var h = ['low', 'mid', 'high'].map(function (dang) {
        return (d[dang] || 0) / top * ih;              // 纯等比，不加任何保底
      });
      /* 守恒微调：≥6000 万段太细看不见，从紧邻的 3000-6000 万段匀出一点点。
         mid 减多少、high 加多少 ⇒ 总和不变、柱顶不动。
         ⚠ 封顶是**高档段最终高度**的上限（不是"匀出多少"的上限）——
           约束匀出量的话，最终高度 = 真实 + 匀出，仍会突破比例（实测 12.6%）。
         ⚠ 三重封顶，缺一不可（少一条就会在矮柱上严重失真）：
           · 绝对值 ≤ RF_GAO_BU px（真实高度已够就不匀）；
           · 不超过**本柱总高**的 RF_GAO_BU_PCT —— 真人柱近月只有 7px 高，
             匀到 3px 会让高档占 41%（真实仅 2.7%），那是把图改错；
           · mid 至少留 1px，不许把中档扣没。 */
      if (h[2] > 0 && h[1] > 0) {
        var zhuGao = h[0] + h[1] + h[2];
        var xian = Math.min(RF_GAO_BU, zhuGao * RF_GAO_BU_PCT);
        var bu = Math.min(Math.max(0, xian - h[2]), Math.max(0, h[1] - 1));
        h[1] -= bu;
        h[2] += bu;
      }
      var y = PT + ih;                                 // 从底部往上堆
      ['low', 'mid', 'high'].forEach(function (dang, j) {
        if ((d[dang] || 0) <= 0 || h[j] <= 0) return;
        y -= h[j];
        g += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) +
             '" width="' + bw + '" height="' + h[j].toFixed(1) +
             '" fill="' + RF_SE[lei][dang] + '"/>';
      });
    });
  });

  /* X 轴月份 + 悬停命中区（与折线图同款：整月一条竖条，鼠标好命中） */
  rows.forEach(function (r, i) {
    g += '<text x="' + (PL + i * gw + gw / 2).toFixed(1) + '" y="' + (H - 9) +
         '" text-anchor="middle" font-size="10" fill="var(--ink-3)">' + esc(r.month) + '</text>';
    var tip = r.month + '\nAI 漫剧 ' + num(r.ai.total) + ' 部（低 ' + num(r.ai.low) +
              ' / 中 ' + num(r.ai.mid) + ' / 高 ' + num(r.ai.high) + '）\n真人短剧 ' +
              num(r.real.total) + ' 部（低 ' + num(r.real.low) + ' / 中 ' +
              num(r.real.mid) + ' / 高 ' + num(r.real.high) + '）';
    g += '<rect class="hit" x="' + (PL + i * gw).toFixed(1) + '" y="' + PT +
         '" width="' + gw.toFixed(1) + '" height="' + ih + '"><title>' +
         esc(tip) + '</title></rect>';
  });

  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="linechart" role="img">' + g + '</svg>';

  /* 图例：两个系列 × 三档，共 6 个色块。分两行写，一行 6 个会挤到换行错位。 */
  var dangMing = ['<3000万', '3000-6000万', '≥6000万'];
  function lie(lei, ming) {
    return '<span>' + ming + '：' + dangMing.map(function (t, j) {
      var c = RF_SE[lei][['low', 'mid', 'high'][j]];
      return '<i style="background:' + c + '"></i>' + t;
    }).join('') + '</span>';
  }
  var legend = '<div class="legend">' + lie('ai', 'AI 漫剧') + lie('real', '真人短剧') +
               '<span>鼠标悬停可看当月各档精确部数</span></div>';

  /* 脚注：口径 + 保底声明。少了这两句，上面那张图就是在误导。 */
  var dang = (rf.dang || []).map(function (v) { return wan(v); });
  var foot = '按改编作品上线月份统计当月新上线的作品部数；' +
    '热度取红果历史最高热度（非当月值，最近上线的作品峰值可能尚未爬到顶）。' +
    '三档切点为业务口径：' + (dang[0] ? '<' + dang[0] : '') +
    (dang[1] ? ' / ' + dang[0] + '-' + dang[1] + ' / ≥' + dang[1] : '') + '。' +
    'AI 与真人共用同一纵轴，柱高严格等于当月部数。';
  if (rf.you_redu_zong && rf.gao_zong) {
    foot += ' ≥' + (dang[1] || '6000万') + ' 档在最近 ' + rows.length +
      ' 个月里共 ' + num(rf.gao_zong) + ' 部，占有热度作品 ' +
      num(rf.you_redu_zong) + ' 部的 ' +
      (rf.gao_zong / rf.you_redu_zong * 100).toFixed(2) +
      '%，等比绘制仅为发丝，故从同柱 3000-6000 万档匀出不超过 ' + RF_GAO_BU +
      'px（且不超过柱高 ' + Math.round(RF_GAO_BU_PCT * 100) +
      '%）显示，柱高不变、仍等于当月真实部数，各档数量以悬停提示为准。';
  }
  foot += '热度缺失的作品不计入任何一档。';
  /* ⚠ 在途月（数据截止月）只采了不到整月，整月剔除 —— 不补 0、不按天数折算
     （折算会假设上线节奏均匀，那是编数据）。必须写明，否则读者以为漏了最新一个月。 */
  if (rf.yi_ti_yue) {
    foot += '数据截止月 ' + rf.yi_ti_yue + ' 尚未采满整月，已整月剔除（不做天数折算）。';
  }
  return svg + legend + '<div class="g10-foot">' + esc(foot) + '</div>';
}

/* ③ 番茄头部个别书部数增长（C3） */
function gailanTopZengHtml(list) {
  if (!list || !list.length) {
    return '<div class="g-xz-none">本期两个番茄榜单的 Top10 内，没有作品的短剧+漫剧部数增加。</div>';
  }
  var h = '<div class="g-xz-list">' + list.map(function (x) {
    return '<div class="g-xz-item">' +
      '<div><span class="rankno">' + x.rank + '</span></div>' +
      '<div class="cell name" title="' + esc(x.name) + '">' + esc(x.name) +
      ' <span class="cell dim" style="font-weight:400">· ' + esc(x.bang) + '</span></div>' +
      '<div class="bs">' + x.before + ' → ' + x.after + ' 部 (+' + x.delta + ')</div>' +
      '</div>';
  }).join('') + '</div>';
  var qj = list[0] || {};
  h += '<div class="g10-foot">' + esc(
    '「部数」= 番茄 App 改编板块内已上线的短剧+漫剧部数。' +
    '对比基准为各榜自己的上一期（' + (qj.shang_qi_ri || '—') + ' → ' +
    (qj.ben_qi_ri || '—') + '），只统计两期都在榜的书。') + '</div>';
  return h;
}

/* ③ 起点 / 晋江的新增签约。
   ⚠ 展示上不再出现任何「TopN 头部」字样（用户 2026-09-14：
     晋江长期榜本来就是 Top1000，写 Top50 是基础错误）。
     名次范围如果真有截断，由 ETL 的 label 说明，不由前端拼。 */
function gailanXinzengQianyueHtml(x, plat) {
  var xin = plat === 'jjwxc' ? '新增签约类型' : '新增签约';
  if (!x || x.wu_fa_xianshi) {
    return '<div class="g-xz-none">' + esc((x && x.wu_fa_xianshi) || '暂无数据。') + '</div>';
  }
  var rows = x.rows || [];
  if (!rows.length) {
    /* 用户 2026-09-14 明确：0 本也要保留该行写「本期无新增」，
       不能整块隐藏 —— 隐藏会让读者以为这个平台没被跟踪。
       ⚠ 免责句这里也必须带上：「本期无新增」很容易被读成「这批书没有版权动作」，
         而实际含义只是"平台本期没有新公开标注"。两个分支的免责文案要一致。 */
    var txt = '本期无新增。全榜连续在榜的作品中，没有新公开的签约类型' +
              '（对比上期 ' + (x.shang_qi_ri || '—') + '）。';
    txt += '签约类型由平台主动披露，无新增仅代表本期页面上没有出现新标注，' +
           '不代表此前未授权，也不代表作品已开始制作或上线。';
    return '<div class="g-xz-none">' + esc(txt) + '</div>';
  }
  /* 列表也做成「一类型一列打 √」的表格，与 ① 的列头表风格统一
     （用户 2026-09-14：不要一行一个改编）。列 = 本卡内出现过的类型。 */
  var ge = [];
  var seen = {};
  rows.forEach(function (r) {
    (r.xinzeng_leixing || []).forEach(function (t) {
      if (!seen[t]) { seen[t] = true; ge.push(t); }
    });
  });
  var grid = gailanGrid(plat, ge);
  var h = '<div class="g10-scroll"><div class="g10-tbl" style="min-width:' +
          gailanZuiXiao(plat, ge) + 'px"><div class="g10-tr g10-head" ' +
          'style="grid-template-columns:' + grid + '"><div>#</div>' +
          '<div class="g10-shu">书名<i>' + esc(xin) + '</i></div>' +
          ge.map(function (t) {
            /* 与 ① 同一套简称：显示简称、title 全名 */
            return '<div class="g10-lei" title="' + esc(t) + '">' +
                   esc(gailanJianCheng(t)) + '</div>';
          }).join('') + '</div>';
  rows.forEach(function (r) {
    var tags = r.xinzeng_leixing || [];
    h += '<div class="g10-tr" style="grid-template-columns:' + grid + '">' +
         '<div><span class="rankno">' + (r.rank || '—') + '</span></div>' +
         '<div class="cell name" title="' + esc(r.name) + '">' + esc(r.name) + '</div>' +
         ge.map(function (t) {
           return '<div class="g10-lei g10-gou">' +
                  (tags.indexOf(t) >= 0 ? '√' : '') + '</div>';
         }).join('') + '</div>';
  });
  h += '</div></div>';
  h += '<div class="g10-foot">' + esc(
    '统计范围：该榜全榜，且两期都在榜的书（新进榜作品的签约不算本期新增）。' +
    '对比上期 ' + (x.shang_qi_ri || '—') + ' → 本期 ' + (x.caiji_ri || '—') + '。' +
    '签约类型由平台主动披露，新增仅代表本期页面上新出现该标注，' +
    '不代表此前未授权，也不代表作品已开始制作或上线。') + '</div>';
  return h;
}

function renderOverview() {
  var ov = DATA.overview || {};
  var h = '';

  /* ── ① 头部改编速览：按平台分三行，每行左短期右长期 ── */
  var t10 = ov.top10 || [];
  if (t10.length) {
    h += '<div class="card-hd" style="padding:0 0 10px"><span class="h">头部改编速览</span>' +
         '<span class="s">六个榜单各取 Top10 逐本明细；短期榜在左、长期榜在右</span></div>';
    ['fanqie', 'qidian', 'jjwxc'].forEach(function (plat) {
      var bang = t10.filter(function (b) { return b.platform === plat; });
      if (!bang.length) return;
      h += '<div class="g10-grid" style="margin-bottom:16px">' +
           bang.map(gailanTop10Card).join('') + '</div>';
    });
  }

  /* ── ② 三平台改编分布（统一长期榜） ── */
  var fb = ov.fenbu || [];
  if (fb.length) {
    h += '<div class="card-hd" style="padding:0 0 10px"><span class="h">三平台改编分布</span>' +
         '<span class="s">统一取各平台的长期榜；三家口径与单位不同，各卡分别标注，不做横向比较</span></div>';
    h += '<div class="g-fenbu-grid" style="margin-bottom:16px">' +
         fb.map(gailanFenbuCard).join('') + '</div>';
  }

  /* ── ③ 本期新增 ── */
  var xz = ov.xinzeng || {};
  h += '<div class="card-hd" style="padding:0 0 10px"><span class="h">本期新增</span>' +
       '<span class="s">番茄看已上线部数的增加，起点/晋江看新公开的签约类型；两者不同源，不可合并计数</span></div>';
  h += '<div class="g-xz-grid" style="margin-bottom:16px">' +
       cardHtml('番茄全库改编深度', '平均每本改编部数逐期变化',
                gailanPpbHtml(xz.quan_ku_ppb)) +
       cardHtml('番茄头部本期追加改编', '两个榜单 Top10 内短剧+漫剧部数上升的作品',
                gailanTopZengHtml(xz.fanqie_toubu_zengzhang)) +
       '</div>';
  /* ⚠ 副标题不许写名次范围（原「长期榜 · Top50 头部」是错的：
     晋江长期榜就是 Top1000，Top50 是我们自己截断出来的）。
     也不许写「前几期如何」这类需要额外核实的话 —— 期数由 ETL 给，写死会过期。 */
  h += '<div class="g-xz-grid" style="margin-bottom:16px">' +
       cardHtml('起点收藏榜本期新增签约', '全榜 · 两期都在榜的书',
                gailanXinzengQianyueHtml(xz.qidian_xinzeng, 'qidian')) +
       cardHtml('晋江积分榜本期新增签约', '全榜 · 两期都在榜的书',
                gailanXinzengQianyueHtml(xz.jjwxc_xinzeng, 'jjwxc')) +
       '</div>';

  /* ── ③·五 番茄全库热度分层分布趋势（2026-09-14 新增，插在洞察之前）──
     副标题把口径一次说清：单位、分档、共轴。脚注里还有「高档已放大」的声明，
     那句是这张图诚实的代价，不许删。 */
  var rf = ov.redu_fenceng;
  if (rf) {
    h += '<div style="margin-bottom:16px">' + cardHtml('番茄全库热度分层分布趋势',
                  '按上线月份统计当月新上线作品部数，AI 漫剧与真人短剧共用同一纵轴；' +
                  '热度取红果历史最高热度（非当月值）',
                  reduFencengHtml(rf)) + '</div>';
  }

  /* ── ④ 概览洞察 ── */
  h += cardHtml('概览洞察', '跨平台结论',
    insightsHtml(ov.insights) ||
    '<div class="empty-box">' + esc(ov.placeholder || '概览文案待补充。') + '</div>');

  /* 概览页全是静态内容，没有表格/搜索/排序，bind 无需做任何事。
     原先这里绑 [data-goto]（「各数据集概览」卡的「查看」按钮），该卡已删。 */
  return { html: h, bind: function () {} };
}

/* ---------------- 大表懒加载 ----------------
   番茄改编全库单期 2.2 万行（~9MB），4 期共 37MB。ETL 已把这类大表拆到
   shuju/rows/*.json，主 JSON 只留 stats/insights/meta。这里在真正要渲染时才去拉，
   拉过一次就挂回 snap.rows 缓存住。 */
function ensureRows(snap, cb) {
  if (!snap.rows_url || (snap.rows && snap.rows.length)) { cb(); return; }
  if (snap._loading) return;             // 同一分片避免并发重复请求
  snap._loading = true;
  document.getElementById('main').innerHTML =
    '<div class="empty-box">正在加载 ' + num(snap.rows_count || 0) + ' 行数据…</div>';
  fetch(snap.rows_url)
    .then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    })
    .then(function (rows) { snap.rows = rows; snap._loading = false; cb(); })
    .catch(function (e) {
      snap._loading = false;
      document.getElementById('main').innerHTML =
        '<div class="empty-box">数据分片加载失败：' + esc(e.message) +
        '<br><code>' + esc(snap.rows_url) + '</code></div>';
    });
}

/* ---------------- 路由 ---------------- */
function renderPage(keepScroll) {
  var y = keepScroll ? window.scrollY : 0;
  var main = document.getElementById('main');

  if (CUR === 'overview') {
    var ov = renderOverview();
    main.innerHTML = ov.html;
    ov.bind();
    if (keepScroll) window.scrollTo(0, y);
    return;
  }

  var page = (DATA.pages || {})[CUR];
  if (!page) { main.innerHTML = '<div class="empty-box">该页面无数据。</div>'; return; }
  if (page.error) {
    main.innerHTML = '<div class="empty-box">该数据集构建失败：' + esc(page.error) + '</div>';
    return;
  }
  var snap = curSnap(CUR);
  if (!snap) {
    main.innerHTML = '<div class="empty-box">该数据集暂无可用快照。</div>';
    return;
  }

  var key = CUR;
  ensureRows(snap, function () {
    if (CUR !== key) return;            // 加载期间用户已切走，丢弃这次渲染
    var out;
    if (key === 'fanqie_hot' || key === 'fanqie_peak') out = renderFanqieBoard(page, snap);
    else if (key === 'fanqie_wwds') out = renderWwds(page, snap);
    else out = renderCopyrightBoard(page, snap);
    main.innerHTML = out.html;
    out.bind();
    if (keepScroll) window.scrollTo(0, y);
  });
}

/* ---------------- 启动 ---------------- */
fetch('shuju/track_data.json')
  .then(function (r) {
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function (d) { DATA = d; renderChrome(); renderPage(); })
  .catch(function (e) {
    document.getElementById('main').innerHTML =
      '<div class="empty-box">数据加载失败：' + esc(e.message) +
      '<br><br>请刷新页面重试。</div>';
  });
