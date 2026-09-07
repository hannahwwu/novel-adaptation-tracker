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
  /* 总览：三色堆叠方块 */
  return head +
    '<rect x="3" y="3" width="8" height="8" rx="2" fill="#ea580c"/>' +
    '<rect x="13" y="3" width="8" height="8" rx="2" fill="#2563eb"/>' +
    '<rect x="3" y="13" width="8" height="8" rx="2" fill="#db2777"/>' +
    '<rect x="13" y="13" width="8" height="8" rx="2" fill="#111114"/>' +
    '</svg>';
}

/* ---------------- 导航配置 ---------------- */
var NAV = [
  { key: 'overview', label: '总览', p: 'overview',
    title: '总览驾驶舱', sub: '三平台横向对比' },
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
    line1.push('榜单数据 <b>' + esc(m.rank_date || '—') + '</b>');
    line1.push('改编明细 <b>' + esc(m.detail_date || '—') + '</b>');
    line1.push('收录 <b>' + num(rowN) + '</b> 本');
  } else {
    /* 不再显示「在榜 N 本」—— 子标签上已经带了同一个数字，重复 */
    line1.push('榜单日 <b>' + esc(m.board_date || '—') + '</b>');
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

/* 「完整统计方式 ⓘ」浮窗。
   纯 CSS 展开（hover / 键盘 focus / 点击后 focus 固定），不挂任何事件 ——
   口径卡虽然不在局部刷新范围内，但少一处事件绑定就少一处踩 IME/重建的坑。 */
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
  return '<span class="pop" tabindex="0" role="button" aria-label="查看完整统计方式">' +
         '完整统计方式<b>ⓘ</b><span class="pop-bd">' + inner + '</span></span>';
}

function notesHtml(page) {
  var n = page.notes || {};
  var rows = '';
  if (n.source) rows += noteRowHtml('数据来源', esc(n.source));
  if (n.lei_xing) rows += noteRowHtml('改编类型枚举', esc(n.lei_xing));
  /* 统计方式：摘要行内显示，长文与阈值表收进浮窗（用户 2026-09-04 明确要求） */
  var pop = tongJiPopHtml(n.tong_ji_xiang, n.tong_ji_biao);
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

function insightsHtml(list) {
  if (!list || !list.length) return '';
  return '<div class="insights">' + list.map(function (i) {
    return '<div class="insight ' + esc(i.level || 'normal') + '">' +
           '<div class="t">' + esc(i.title) + '</div><div class="x">' + esc(i.text) + '</div></div>';
  }).join('') + '</div>';
}

function statCard(label, value, sub, subCls) {
  return '<div class="stat"><div class="l">' + esc(label) + '</div>' +
         '<div class="n">' + value + '</div>' +
         '<div class="s ' + (subCls || '') + '">' + (sub || '&nbsp;') + '</div></div>';
}

function cardHtml(title, subtitle, body) {
  return '<div class="card" style="margin-bottom:16px"><div class="card-hd">' +
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
   用于「改编作品上线月度趋势」——三条线（合计 / AI 漫剧 / 真人短剧）叠在一起，
   比原来那种「每月一根横条」更容易看出趋势与交叉点。
   series = [{name, color, vals: [数值...]}]，labels = X 轴文字（与 vals 等长）。 */
function lineChartHtml(labels, series) {
  if (!labels || labels.length < 2 || !series || !series.length) return '';
  var W = 720, H = 212, PL = 54, PR = 14, PT = 12, PB = 30;
  var iw = W - PL - PR, ih = H - PT - PB;
  var maxV = 0;
  series.forEach(function (s) {
    s.vals.forEach(function (v) { if (v > maxV) maxV = v; });
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
  /* 折线 + 数据点（点上挂 title，鼠标悬停看具体数值） */
  series.forEach(function (s) {
    var pts = s.vals.map(function (v, i) { return X(i).toFixed(1) + ',' + Y(v).toFixed(1); });
    g += '<polyline points="' + pts.join(' ') + '" fill="none" stroke="' + s.color +
         '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
    s.vals.forEach(function (v, i) {
      g += '<circle cx="' + X(i).toFixed(1) + '" cy="' + Y(v).toFixed(1) +
           '" r="2.6" fill="' + s.color + '"><title>' + esc(labels[i]) + ' · ' +
           esc(s.name) + ' ' + num(v) + ' 部</title></circle>';
    });
  });

  return '<svg viewBox="0 0 ' + W + ' ' + H + '" class="linechart" role="img">' + g + '</svg>' +
    '<div class="legend">' + series.map(function (s) {
      return '<span><i style="background:' + s.color + '"></i>' + esc(s.name) + '</span>';
    }).join('') + '</div>';
}

/* 迷你竖向柱状图。用于「改编率随榜位分段」「改编形态分布」——
   这两处类目少、数值可比，竖柱比横向长条紧凑得多，也更像常规图表。
   rows = [{k: 类目, v: 数值, t: 显示文本}]，maxVal 传 100 表示百分比刻度。 */
function miniColsHtml(rows, color, maxVal, unit) {
  if (!rows || !rows.length) return '';
  var max = maxVal || Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
  return '<div class="mcols">' + rows.map(function (r) {
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
  var src = s.heat_src || {};

  var h = notesHtml(page);

  /* 数据完整度提示：该快照没跑完 / 热度采集失效时明确告知，避免误读为「真的没有改编」 */
  var warns = [];
  var covered = snap.covered != null ? snap.covered : s.book_total;
  if (covered < s.book_total) {
    warns.push('本页书单固定为最新榜单日（' + esc(m.board_date || '—') + '）的 Top' +
               num(s.book_total) + '。在 ' + esc(snap.date) + ' 这期改编数据中，其中 ' +
               num(s.book_total - covered) + ' 本没有对应记录（可能当期尚未上榜，' +
               '或该期采集未覆盖到），表中显示为 0，不代表其没有改编。' +
               '改编率按该期有数据的 ' + num(covered) + ' 本计算。');
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
                (covered < s.book_total ? '（按已采 ' + num(covered) + ' 本计）' : ''));
  h += statCard('改编作品总数', num(s.parts_total),
                Object.keys(parts).sort(function (a, b) { return parts[b] - parts[a]; })
                  .map(function (k) { return esc(k) + ' ' + parts[k]; }).join(' · '));
  h += statCard('漫剧占影视化比例', pct(manju, drama),
                '漫剧 ' + num(manju) + ' 部 / 短剧 ' + num(playlet) + ' 部');
  h += statCard('热度覆盖率', pct(s.heat_covered, s.heat_total),
                '短剧+漫剧 ' + num(s.heat_covered) + '/' + num(s.heat_total) +
                ' · 红果 ' + num(src.ext || 0) + ' / App ' + num(src.ui || 0));
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

  var h = notesHtml(page);

  h += '<div class="stats">';
  h += statCard('已改编小说', num(t.books), '至少 1 部改编作品上线');
  h += statCard('改编作品总数', num(t.dramas), '平均每本 ' + (t.parts_per_book || 0) + ' 部');
  h += statCard('有 AI 漫剧的书', num(t.ai_books), '有真人短剧的书 ' + num(t.real_books) + ' 本');
  h += statCard('改编表现分布',
                (counts['超预期'] || 0) + ' / ' + (counts['符合预期'] || 0) + ' / ' + (counts['不及预期'] || 0),
                '超预期 / 符合 / 不及预期');
  h += '</div>';

  h += insightsHtml(snap.insights);

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
    h += cardHtml('改编作品上线月度趋势',
                  '按上线月份统计当月新增作品数，纵轴为部数；鼠标悬停数据点看具体数值', body);
  }

  if (bands.length) {
    /* 原先是一张 6 列阈值表，信息密但很丑。改成竖柱看各档中位热度，
       精确阈值用一行小字说明，需要精确数值的场景本来也不多。
       分位名（p90/p25）从数据里读，不写死 —— ETL 调阈值时页面自动跟随。 */
    var qHi = 'p' + Math.round((bands[0].over_q || 0.9) * 100);
    var qLo = 'p' + Math.round((bands[0].under_q || 0.25) * 100);
    var body1 = miniColsHtml(bands.map(function (x) {
      return { k: '档 ' + x.band, v: x.heat_mid, t: wan(x.heat_mid) };
    }), 'var(--fanqie)', null, '纵轴为该档「改编剧最高热度」中位数（万）');
    body1 += '<div class="thresh-note">' + bands.map(function (x) {
      return '<span><b>档 ' + x.band + '</b>　累计阅读 ' + num(x.cum_read_min) + '–' +
             num(x.cum_read_max) + '　共 ' + num(x.books) + ' 本　超预期线（' + qHi + '） ' +
             wan(x.heat_over) + '　不及预期线（' + qLo + '） ' + wan(x.heat_under) + '</span>';
    }).join('') + '</div>';
    h += cardHtml('改编表现判定阈值（按累计阅读分 ' + bands.length + ' 档）',
                  '同档内比较：该书改编剧最高热度高于本档 ' + qHi + ' 记为超预期，低于 ' +
                  qLo + ' 记为不及预期，介于两者之间为符合预期',
                  body1);
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
       '纵轴为该题材中改编表现「超预期」的书占比（%），全局基准约 ' + base + '%');
    h += cardHtml('题材改编效率（表现较好的题材）',
                  '超预期 = 该书改编剧最高热度高于同体量档 p' + Math.round(overQ * 100) +
                  '；仅统计样本 150 本以上的题材',
                  body2);
  }

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
      x += '<div class="kv" style="margin-top:5px">历史最高热度 <b style="color:var(--up)">' +
           wan(d.heat_max || d.heat) + '</b>（榜单排序依据）· 最新热度 ' + wan(d.heat) +
           ' · 总收藏 ' + num(d.collect) +
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

  /* 历史快照说明：书单固定用最新榜单日的 TopN，而历史快照采集时部分新书尚未上榜，
     因此会有「该期无数据」的书。这不是采集失败，需要如实解释，避免误读。 */
  var covered = snap.covered != null ? snap.covered : baseBooks;
  if (covered < s.books) {
    h += '<div class="warnbox"><div class="warn-row">' +
         '本页书单固定为最新榜单日（' + esc(m.board_date || '—') + '）的 Top' + num(s.books) +
         '。在 ' + esc(snap.date) + ' 这期改编数据中，其中 ' + num(s.books - covered) +
         ' 本尚未上榜（多为近期新上榜作品），因此没有对应记录，表中显示为「未采集」。' +
         '改编率按该期有数据的 ' + num(covered) + ' 本计算。</div></div>';
  }
  var denom = covered || baseBooks;

  h += '<div class="stats">';
  h += statCard('在榜作品', num(s.books), page.key === 'qidian_coll'
                ? num(baseBooks) + ' 本有改编数据' : '榜单 Top' + num(m.top_n || s.books));
  h += statCard('已披露改编', num(s.adapted), '改编率 ' + pct(s.adapted, denom) +
                (covered < s.books ? '（按已采 ' + num(covered) + ' 本计）' : ''));
  h += statCard('改编形态种类', num(tags.length),
                tags.length ? tags.slice(0, 3).map(function (x) { return esc(x.tag) + ' ' + x.books; }).join(' · ')
                            : '暂无已披露的改编');
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
  else {
    /* 整榜零签约（如晋江积分月榜）时两张图都无数据可画，
       给一句空状态说明，避免读者以为图表加载失败。 */
    h += cardHtml('改编形态分布', '按书数统计，同一本书可有多种形态',
      '<div class="empty-box">该榜在榜作品均未公开任何改编版权信息，暂无形态分布可展示。</div>');
  }

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
    h += '<div class="footnote">' + num(baseBooks) +
         ' 本有改编数据，改编率按这部分作品计算。该榜目前只采集过一期' +
         '（改编详情分 2 天跑完，属同一期），因此暂无历史快照可切换。</div>';
  }
  return { html: h, bind: function () { bindTable(cfg); } };
}

/* ---------------- 页面：总览驾驶舱 ---------------- */
function renderOverview() {
  var ov = DATA.overview || {};
  var pages = DATA.pages || {};
  var order = ['fanqie_wwds', 'fanqie_hot', 'fanqie_peak',
               'qidian_sales', 'qidian_coll', 'jjwxc_month', 'jjwxc_score'];

  /* 数据集入口卡 */
  var g = 'minmax(0,1.5fr) 80px 104px 104px 62px 66px';
  var b = '<div class="dtr dhead" style="grid-template-columns:' + g + '">' +
          '<div>数据集</div><div class="cell num">条数</div><div>榜单日</div>' +
          '<div>改编采集日</div><div class="cell num">快照数</div><div></div></div>';
  order.forEach(function (k) {
    var p = pages[k]; if (!p) return;
    var m = p.meta || {}, cn = navOf(k);
    var ss = p.snapshots || [];
    var first = ss[0] || {};
    var src = m.board_src || {};
    var nameCell = '<span style="display:inline-flex;align-items:center;gap:6px">' +
                   logoSvg(cn.p, 15) + esc(p.label || k) + '</span>';
    if (src.source_url) {
      nameCell += ' <a href="' + esc(src.source_url) + '" target="_blank" rel="noopener" ' +
                  'title="打开原站：' + esc(src.source || '') + '" ' +
                  'style="color:var(--' + cn.p + ');font-size:11.5px;font-weight:600">↗</a>';
    }
    b += '<div class="dtr" style="grid-template-columns:' + g + '">' +
         '<div class="cell">' + nameCell + '</div>' +
         '<div class="cell num">' + num(first.rows_count || (first.rows || []).length) + '</div>' +
         '<div class="cell dim">' + esc(m.board_date || m.rank_date || '—') + '</div>' +
         '<div class="cell dim">' + esc(first.date || m.detail_date || '—') + '</div>' +
         '<div class="cell num' + (ss.length > 1 ? '' : ' dim') + '">' + ss.length + '</div>' +
         '<div><span class="pill pill-ghost" style="height:24px;padding:0 10px;font-size:12px" ' +
         'data-goto="' + k + '">查看</span></div></div>';
  });
  var h = cardHtml('各数据集概览',
    '7 个数据集采集节奏不同，横向比较时请注意时间差；「快照数」>1 的数据集可在对应页面切换历史改编快照',
    b);

  /* 改编率横向对比 */
  var cmp = [
    { k: 'fanqie_hot', label: '番茄最热榜 Top50' },
    { k: 'fanqie_peak', label: '番茄巅峰榜 Top30' },
    { k: 'qidian_sales', label: '起点畅销榜 Top50' },
    { k: 'qidian_coll', label: '起点收藏榜 Top1000' },
    { k: 'jjwxc_month', label: '晋江积分月榜 Top50' },
    { k: 'jjwxc_score', label: '晋江积分榜 Top1000' }
  ].map(function (c) {
    var st = ((pages[c.k] || {}).snapshots || [{}])[0].stats || {};
    var tot = st.book_total || st.books_with_detail || st.books || 0;
    var ad = st.adapted_books != null ? st.adapted_books : (st.adapted || 0);
    return { k: c.label, v: tot ? Math.round(ad / tot * 1000) / 10 : 0,
             t: pct(ad, tot) + ' · ' + num(ad) + '/' + num(tot) };
  });
  h += cardHtml('各榜单改编率横向对比',
    '番茄为 App 改编板块实际上线作品；起点/晋江为平台公开披露的版权签约，口径不同，不宜直接等同',
    barsHtml(cmp, 'var(--ink)', 100));

  /* 洞察区（文案待补） */
  h += cardHtml('总览洞察', '跨平台结论文案待补充',
    insightsHtml(ov.insights) ||
    '<div class="empty-box">' + esc(ov.placeholder || '总览文案待补充。') + '</div>');

  return {
    html: h,
    bind: function () {
      document.querySelectorAll('#main [data-goto]').forEach(function (n) {
        n.onclick = function () { go(n.getAttribute('data-goto')); };
      });
    }
  };
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
