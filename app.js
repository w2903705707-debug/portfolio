/* =========================================================================
 *  剪辑师作品集 · 应用脚本
 *  ── 只需修改 CONFIG，全站内容同步 ──
 * ========================================================================= */

/* =========================================================================
 *  内容数据
 *  —— 不要在这里手写内容。内容在 content/site.json 与 content/works.json，
 *     由后台 /admin 编辑，再经 build.mjs 编译成 data/content.js。
 *     改完 JSON 后请执行：node build.mjs
 * ========================================================================= */

const splitList = (v) =>
  Array.isArray(v)
    ? v
    : String(v ?? "")
        .split(/[,，、/|]/)
        .map((s) => s.trim())
        .filter(Boolean);

/* 隐藏的作品直接不进入视图；按 order 升序，order 相同则按 id */
function normalizeWorks(list) {
  return list
    .map((w, i) => ({ ...w, tags: splitList(w.tags), _idx: i }))
    .filter((w) => !w.hidden)
    .sort((a, b) => {
      const oa = Number.isFinite(+a.order) && a.order !== "" ? +a.order : 1e6 + a._idx;
      const ob = Number.isFinite(+b.order) && b.order !== "" ? +b.order : 1e6 + b._idx;
      return oa - ob || String(a.id).localeCompare(String(b.id));
    });
}

const CONFIG = (() => {
  const raw = typeof window !== "undefined" ? window.__CONTENT__ : null;
  if (!raw) return null;
  const site = raw.site || {};
  const me = site.me || {};
  const works = normalizeWorks(raw.works || []);

  /* 精选清单（有序）优先；清单为空时回落到每条作品的 featured 开关 */
  const featuredIds = (Array.isArray(site.featured) ? site.featured : [])
    .map((x) => (typeof x === "string" ? x : x && (x.work || x.id)))
    .filter(Boolean);
  if (featuredIds.length) {
    const set = new Set(featuredIds);
    works.forEach((w) => { w.featured = set.has(w.id); });
  }

  return {
    me: { ...me, units: splitList(me.units) },
    showreel: site.showreel || {},
    categories: (site.categories || []).filter((c) => c && c.id),
    brands: Array.isArray(site.brands) ? site.brands : [],
    card: site.card || {},
    featuredIds,
    tools: splitList(site.tools),
    workflow: site.workflow || "",
    texts: site.texts || {},
    works,
  };
})();

/* =========================================================================
 *  以下为实现，一般不需要改动
 * ========================================================================= */

const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));

/* 文案取值：点路径从 content/texts.json 里取，取不到就用页面内置的 fallback */
const T = (path, fallback = "") => {
  const src = (CONFIG && CONFIG.texts) || {};
  const val = String(path).split(".").reduce((o, k) => (o == null ? undefined : o[k]), src);
  return val == null || val === "" ? fallback : String(val);
};

const CAT      = Object.fromEntries(CONFIG.categories.map((c) => [c.id, c]));
const WORK_MAP = Object.fromEntries(CONFIG.works.map((w) => [w.id, w]));
/* 媒体路径：外链原样、站内绝对路径去掉前导斜杠，保证 file:// 也能看 */
const mediaPath = (p) => {
  const v = String(p || "").trim();
  if (!v) return "";
  if (/^(https?:|data:)/i.test(v)) return v;
  return v.replace(/^\/+/, "");
};

const coverOf  = (w) => mediaPath(w.cover) || `assets/covers/${w.id}.jpg`;
const catCover = (c) => {
  if (mediaPath(c.coverImage)) return mediaPath(c.coverImage);
  const first = CONFIG.works.find((w) => w.cat === c.id) || CONFIG.works[0];
  return first ? coverOf(first) : "assets/covers/w01.jpg";
};
const catOf    = (w) => CAT[w.cat] || { name: "未分类", id: "none" };

let currentFilter = "all";
let currentList   = [];
let currentIndex  = -1;
let lastFocused   = null;

/* ---------------- 视频源解析 ---------------- */
function videoMarkup(item) {
  const bili = (item.bilibili || "").trim();
  const mp4  = (item.video || "").trim();

  if (bili) {
    const bv = bili.match(/BV[0-9A-Za-z]{10}/);
    const src = bv
      ? `https://player.bilibili.com/player.html?bvid=${bv[0]}&page=1&high_quality=1&danmaku=0&autoplay=1`
      : bili;
    return `<iframe src="${esc(src)}" allow="autoplay; fullscreen" allowfullscreen scrolling="no" title="作品视频"></iframe>`;
  }
  if (mp4) {
    return `<video src="${esc(mp4)}" controls playsinline preload="metadata"></video>`;
  }
  return `<div class="ph">
      <div class="ring"></div>
      <b>${esc(T("modal.videoPending", "视频待上传"))}</b>
      <span>${esc(T("modal.videoPendingHint", "在后台「作品库」里给这条作品填上 B 站链接，或填一个本地 mp4 路径，这里就会变成播放器。"))}</span>
    </div>`;
}

/* ---------------- 页面文案 ---------------- */
function applyTexts() {
  // 静态节点：index.html 里带 data-t 的元素
  $$("[data-t]").forEach((el) => {
    const v = T(el.dataset.t);
    if (v) el.textContent = v;
  });

  // 精选区说明里嵌着作品总数
  const aside = $("#featuredAside");
  if (aside) {
    const tpl = T("featured.aside", "先看这几支。完整作品库按分类展开，共 {count} 支。");
    aside.innerHTML = esc(tpl).replace("{count}", `<b id="worksCount">${CONFIG.works.length}</b>`);
  }

  // 浏览器标签页标题
  document.title = `${CONFIG.me.name} · ${CONFIG.me.role}作品集`;
}

/* ---------------- Hero ---------------- */
/* 大标题：优先用 headlineTop / headlineBottom / headlineAccent（后台三个纯文本字段），
   兼容旧版 headline 数组写法 */
function headlineHTML(me) {
  if (Array.isArray(me.headline) && me.headline.length) {
    return me.headline.map((l) => `<span class="line">${l}</span>`).join("<br>");
  }
  const top = esc(me.headlineTop || "");
  const bottom = esc(me.headlineBottom || "");
  const accent = esc(me.headlineAccent || "");
  const bottomHTML =
    accent && bottom.includes(accent)
      ? bottom.replace(accent, `<span class="accent">${accent}</span>`)
      : bottom;
  return `<span class="line">${top}</span><br><span class="line">${bottomHTML}</span>`;
}

function renderHero() {
  const { me, showreel } = CONFIG;

  document.title = `${me.name} · ${me.role}作品集`;
  $("#brandName").textContent = me.en || me.name;
  $("#brandRole").textContent = "/ " + me.role;
  $("#heroTitle").innerHTML = headlineHTML(me);
  $("#heroTagline").innerHTML = String(me.tagline || "")
    .split(/\n+/)
    .map((l) => esc(l))
    .join("<br>");
  $("#statusBadge").innerHTML = `<b></b>${esc(me.status)}`;

  const brandCount = new Set(CONFIG.works.map((w) => (w.client || "").trim()).filter(Boolean)).size;
  $("#heroStats").innerHTML = [
    { n: CONFIG.works.length, u: "支", t: T("hero.stat1", "成片作品") },
    { n: CONFIG.categories.length, u: "类", t: T("hero.stat2", "能力方向") },
    { n: brandCount, u: "+", t: T("hero.stat3", "合作主体") }
  ].map((s) => `<div class="stat"><b>${s.n}<i>${s.u}</i></b><span>${s.t}</span></div>`).join("");

  $("#reelImg").src = mediaPath(showreel.cover) || "assets/covers/reel.jpg";
  $("#reelImg").alt = `${me.name} Showreel 封面`;
  $("#reelCap").textContent = showreel.title;
  $("#reelNote").textContent = showreel.note || "";

  const openReel = () => openModal({ __reel: true });
  $("#reelCard").addEventListener("click", openReel);
  $("#reelCard").addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); openReel(); }
  });
  $("#btnReel").addEventListener("click", openReel);
}

/* ---------------- 能力速览 ---------------- */
function renderAbilities() {
  const counts = CONFIG.works.reduce((acc, w) => ((acc[w.cat] = (acc[w.cat] || 0) + 1), acc), {});

  $("#abilityGrid").innerHTML = CONFIG.categories.map((c) => {
    const n = counts[c.id] || 0;
    const src = catCover(c);
    return `<button class="abil" data-cat="${esc(c.id)}">
        <span class="n">${n} 支</span>
        <div class="thumb"><img src="${esc(src)}" alt="${esc(c.name)} 封面" loading="lazy"></div>
        <h3>${esc(c.name)}</h3>
        <p>${esc(c.note)}</p>
      </button>`;
  }).join("");

  $$("#abilityGrid .abil").forEach((el) => {
    el.addEventListener("click", () => {
      setFilter(el.dataset.cat);
      $("#works").scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

/* ---------------- 作品卡 ---------------- */
function cardHTML(w, big = false) {
  const c = catOf(w);
  const maxTags = Number(big ? (CONFIG.card.featuredTags ?? 3) : (CONFIG.card.libraryTags ?? 2));
  const tags = (w.tags || []).slice(0, Number.isFinite(maxTags) ? maxTags : (big ? 3 : 2));
  const sub = [w.client, w.year].filter(Boolean).join(" · ");
  const subOverride = String(w.cardSubtitle || "").trim();

  return `<button class="card" data-id="${esc(w.id)}" aria-label="查看作品：${esc(w.title)}">
      <div class="frame">
        <img src="${esc(coverOf(w))}" alt="${esc(w.title)} 封面" loading="lazy" onerror="this.classList.add('img-missing')">
        ${w.featured ? `<span class="badge badge-tl">${esc(T("works.badgeFeatured", "精选"))}</span>` : ""}
        ${w.dur ? `<span class="badge badge-tr">${esc(w.dur)}</span>` : ""}
        <div class="play"><i></i></div>
      </div>
      <div class="body">
        <h3>${esc(w.title)}</h3>
        <div class="sub">
          ${subOverride
            ? `<span>${esc(subOverride)}</span>`
            : `<span>${esc(c.name)}</span><i></i><span>${esc(sub || "—")}</span>`}
        </div>
        <div class="tags">${tags.map((t) => `<span>${esc(t)}</span>`).join("")}</div>
      </div>
    </button>`;
}

function bindCards(root) {
  $$(".card", root).forEach((el) => {
    el.addEventListener("click", () => {
      const idx = currentList.indexOf(el.dataset.id);
      openModal({ id: el.dataset.id, fromList: currentList, index: idx });
    });
  });
}

function renderFeatured() {
  // 顺序以后台「精选清单」为准；清单为空时回落到 featured 开关；全都没有则用前 6 个兜底
  const picked = (CONFIG.featuredIds || []).map((id) => WORK_MAP[id]).filter(Boolean);
  let list = picked.length ? picked : CONFIG.works.filter((w) => w.featured);
  if (!list.length) list = CONFIG.works.slice(0, 6).map((w) => ({ ...w, featured: true }));
  list = list.slice(0, 12);

  const grid = $("#featuredGrid");
  // 数量跟清单走：≤6 张用 2 列，7 张以上自动切 3 列
  grid.style.setProperty("--feat-cols", list.length >= 7 ? "3" : "2");
  grid.innerHTML = list.map((w) => cardHTML(w, true)).join("");
  currentList = list.map((w) => w.id);
  bindCards(grid);
}

/* ---------------- 筛选 + 全库 ---------------- */
function countsByCat() {
  return CONFIG.works.reduce((acc, w) => ((acc[w.cat] = (acc[w.cat] || 0) + 1), acc), {});
}

function renderFilters() {
  const counts = countsByCat();
  const items = [{ id: "all", name: T("works.filterAll", "全部"), n: CONFIG.works.length }].concat(
    CONFIG.categories.map((c) => ({ id: c.id, name: c.name, n: counts[c.id] || 0 }))
  );

  $("#filters").innerHTML = items.map(
    (it) => `<button class="filter${it.id === currentFilter ? " on" : ""}" role="tab"
        aria-selected="${it.id === currentFilter}" data-cat="${esc(it.id)}">
        ${esc(it.name)}<b>${it.n}</b>
      </button>`
  ).join("");

  $$("#filters .filter").forEach((el) => el.addEventListener("click", () => setFilter(el.dataset.cat)));
}

function setFilter(cat) {
  currentFilter = cat || "all";
  $$("#filters .filter").forEach((el) => {
    const on = el.dataset.cat === currentFilter;
    el.classList.toggle("on", on);
    el.setAttribute("aria-selected", String(on));
  });
  renderLibrary();
}

function renderLibrary() {
  const list = currentFilter === "all"
    ? CONFIG.works
    : CONFIG.works.filter((w) => w.cat === currentFilter);

  const grid = $("#libraryGrid");
  const libCols = Number(CONFIG.card.libraryColumns);
  if (Number.isFinite(libCols) && libCols > 0) grid.style.setProperty("--lib-cols", String(libCols));
  currentList = list.map((w) => w.id);

  if (!list.length) {
    grid.innerHTML = `<div class="empty" style="grid-column:1/-1">这个分类下还没有作品。</div>`;
    return;
  }
  grid.innerHTML = list.map((w) => cardHTML(w)).join("");
  bindCards(grid);
}

/* ---------------- 关于 ---------------- */
function renderAbout() {
  const counts = countsByCat();
  const max = Math.max(1, ...Object.values(counts));

  /* 某类填了百分比就按百分比画，没填的回落到「按作品数」 */
  $("#skillList").innerHTML = CONFIG.categories.map((c) => {
    const n = counts[c.id] || 0;
    const raw = c.level;
    const hasLevel = raw !== null && raw !== undefined && String(raw).trim() !== "" && !Number.isNaN(Number(raw));
    const pct = hasLevel ? Math.max(0, Math.min(100, Math.round(Number(raw)))) : null;
    const width = pct !== null ? pct : Math.round((n / max) * 100);
    const val = pct !== null ? `${pct}%` : String(n);
    return `<div class="skill">
        <span class="k">${esc(c.name)}</span>
        <span class="bar"><i style="width:${width}%"></i></span>
        <span class="v">${val}</span>
      </div>`;
  }).join("");

  $("#brandList").innerHTML = brandListHTML();

  $("#toolList").innerHTML = CONFIG.tools.map((t) => `<span class="chip">${esc(t)}</span>`).join("");
  $("#workflowText").textContent = CONFIG.workflow;
}

/* 合作方：后台手动列表优先（支持 logo / 链接 / 隐藏），列表为空时回落到从作品客户名自动提取 */
function brandListHTML() {
  const manual = (CONFIG.brands || []).filter((b) => b && String(b.name || "").trim() && !b.hidden);

  if (manual.length) {
    return manual
      .map((b) => {
        const logo = mediaPath(b.logo);
        const name = esc(b.name);
        const inner = logo
          ? `<img src="${esc(logo)}" alt="${name}" loading="lazy" />`
          : `<span class="brand-txt">${name}</span>`;
        const cls = logo ? "brand-item has-logo" : "brand-item";
        return b.url
          ? `<a class="${cls}" href="${esc(b.url)}" target="_blank" rel="noopener">${inner}</a>`
          : `<span class="${cls}">${inner}</span>`;
      })
      .join("");
  }

  const derived = [...new Set(CONFIG.works.map((w) => (w.client || "").trim()).filter(Boolean))];
  return (
    derived.map((b) => `<span class="brand-item">${esc(b)}</span>`).join("") ||
    `<span class="brand-item">${esc(T("about.brandsEmpty", "待补充"))}</span>`
  );
}

/* ---------------- 联系 ---------------- */
function renderContact() {
  const { me } = CONFIG;
  const items = [
    { ic: "✉", label: T("contact.labelEmail", "Email"), val: me.email, href: `mailto:${me.email}` },
    { ic: "微", label: T("contact.labelWechat", "WeChat"), val: me.wechat, href: "" },
    { ic: "B",  label: T("contact.labelBilibili", "Bilibili"), val: me.bilibili.replace(/^https?:\/\//, ""), href: me.bilibili },
    { ic: "飞", label: T("contact.labelFeishu", "Feishu"), val: T("contact.feishuValue", "在线作品集"), href: me.feishu }
  ];

  $("#contactGrid").innerHTML = items.map((it) => {
    const inner = `<span class="ic">${it.ic}</span>
      <span>${esc(it.label)}</span>
      <strong>${esc(it.val)}</strong>`;
    return it.href
      ? `<a class="contact-item" href="${esc(it.href)}" target="_blank" rel="noopener">${inner}</a>`
      : `<div class="contact-item">${inner}</div>`;
  }).join("");

  $("#footYear").textContent = new Date().getFullYear();
  $("#footName").textContent = `${me.name} · ${me.role}`;
}

/* ---------------- 弹层 ---------------- */
const modal    = $("#modal");
const panel    = $("#modalPanel");

function openModal({ id, fromList, index, __reel }) {
  lastFocused = document.activeElement;

  if (__reel) {
    const r = CONFIG.showreel;
    $("#modalTitle").textContent = `${CONFIG.me.name} · ${r.title}`;
    $("#modalDesc").textContent = T("modal.reelDesc", "精选片段：剪辑、动效包装与 AIGC 的合集。");
    $("#modalTags").innerHTML = CONFIG.me.units.map((t) => `<span>${esc(t)}</span>`).join("");
    $("#modalMeta").innerHTML = [
      [T("modal.reelLabelType", "类型"), T("modal.reelType", "Showreel")],
      [T("modal.reelLabelContent", "内容"), CONFIG.me.units.join(" / ")],
      [T("modal.reelLabelNote", "说明"), r.note || "—"]
    ].map(([k, v]) => `<div class="meta-row"><span>${k}</span><b>${esc(v)}</b></div>`).join("");
    $("#modalStage").innerHTML = videoMarkup(r);
    $("#modalNav").hidden = true;
    showModal();
    return;
  }

  const w = WORK_MAP[id];
  if (!w) return;

  const list = fromList && fromList.length ? fromList : CONFIG.works.map((x) => x.id);
  currentList = list;
  currentIndex = Math.max(0, index ?? list.indexOf(id));

  fillModal(w);
  $("#modalNav").hidden = list.length < 2;
  showModal();
}

function fillModal(w) {
  const c = catOf(w);
  $("#modalTitle").textContent = w.title;
  $("#modalDesc").textContent = w.desc || "暂无简介。";
  $("#modalTags").innerHTML = (w.tags || []).map((t) => `<span>${esc(t)}</span>`).join("");
  $("#modalStage").innerHTML = videoMarkup(w);

  $("#modalMeta").innerHTML = [
    [T("modal.metaCat", "分类"), c.name],
    [T("modal.metaClient", "客户"), w.client || "—"],
    [T("modal.metaYear", "年份"), w.year || "—"],
    [T("modal.metaRole", "职责"), w.role || "—"],
    [T("modal.metaDur", "时长"), w.dur || T("modal.durationFallback", "待补")]
  ].map(([k, v]) => `<div class="meta-row"><span>${k}</span><b>${esc(v)}</b></div>`).join("");

  $("#modalCount").textContent = `${currentIndex + 1} / ${currentList.length}`;

  const prev = $("#prevWork"), next = $("#nextWork");
  const pi = (currentIndex - 1 + currentList.length) % currentList.length;
  const ni = (currentIndex + 1) % currentList.length;
  prev.disabled = currentList.length < 2;
  next.disabled = currentList.length < 2;
  $("span", prev).textContent = WORK_MAP[currentList[pi]]?.title || "";
  $("span", next).textContent = WORK_MAP[currentList[ni]]?.title || "";
}

function showModal() {
  modal.classList.add("open");
  document.body.style.overflow = "hidden";
  const closeBtn = $("#modalClose");
  closeBtn.focus({ preventScroll: true });
  panel.scrollTop = 0;
}

function closeModal() {
  modal.classList.remove("open");
  document.body.style.overflow = "";
  $("#modalStage").innerHTML = "";
  if (lastFocused && lastFocused.focus) lastFocused.focus({ preventScroll: true });
}

function step(dir) {
  if (!currentList.length) return;
  currentIndex = (currentIndex + dir + currentList.length) % currentList.length;
  fillModal(WORK_MAP[currentList[currentIndex]]);
  panel.scrollTop = 0;
}

function initModal() {
  $("#modalClose").addEventListener("click", closeModal);
  $("#prevWork").addEventListener("click", () => step(-1));
  $("#nextWork").addEventListener("click", () => step(1));

  modal.addEventListener("mousedown", (e) => { if (e.target === modal) closeModal(); });

  document.addEventListener("keydown", (e) => {
    if (!modal.classList.contains("open")) return;

    if (e.key === "Escape") { e.preventDefault(); closeModal(); return; }
    if (e.key === "ArrowLeft")  { e.preventDefault(); step(-1); return; }
    if (e.key === "ArrowRight") { e.preventDefault(); step(1);  return; }

    // 焦点锁在弹层内
    if (e.key === "Tab") {
      const focusables = $$('button, a[href], iframe, video, [tabindex]:not([tabindex="-1"])', panel)
        .filter((el) => !el.disabled && el.offsetParent !== null);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
}

/* ---------------- 导航 ---------------- */
function initNav() {
  const nav = $("#nav");
  $("#navToggle").addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    $("#navToggle").setAttribute("aria-expanded", String(open));
  });
  $$(".nav-links a", nav).forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("open");
    $("#navToggle").setAttribute("aria-expanded", "false");
  }));

  const links = $$(".nav-links a");
  const map = new Map(links.map((a) => [a.getAttribute("href").replace("#", ""), a]));
  const targets = ["featured", "works", "about", "contact"]
    .map((id) => document.getElementById(id)).filter(Boolean);

  const io = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        links.forEach((l) => l.classList.remove("on"));
        const a = map.get(en.target.id);
        if (a) a.classList.add("on");
      }
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
  targets.forEach((t) => io.observe(t));

  $("#toTop").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
}

/* ---------------- 启动 ---------------- */
function boot() {
  if (!CONFIG) {
    // 内容没生成时给出可操作的提示，而不是白屏
    document.body.insertAdjacentHTML(
      "afterbegin",
      `<div style="max-width:720px;margin:16vh auto;padding:32px;border-radius:22px;background:#2a2e36;color:#eaedf2;font:15px/1.8 system-ui;box-shadow:14px 14px 34px #15181c,-14px -14px 34px #39404c">
        <h1 style="font-size:20px;margin:0 0 12px">内容还没生成</h1>
        <p style="color:#9ba2ae;margin:0 0 14px">站点内容来自 <code>content/*.json</code>，需要先编译成 <code>data/content.js</code>。</p>
        <p style="margin:0 0 8px">在项目目录执行：</p>
        <pre style="background:#24272d;padding:12px 14px;border-radius:12px;overflow:auto;margin:0 0 14px">node build.mjs</pre>
        <p style="color:#9ba2ae;margin:0">或者在 <code>你的域名/admin</code> 登录后台修改内容（会自动重新构建）。</p>
      </div>`
    );
    return;
  }

  applyTexts();
  renderHero();
  renderAbilities();
  const wc = document.getElementById("worksCount");
  if (wc) wc.textContent = CONFIG.works.length;
  renderFeatured();
  renderFilters();
  renderLibrary();
  renderAbout();
  renderContact();
  initModal();
  initNav();

  // 深度链接：index.html#w04 直接打开该作品
  const hash = decodeURIComponent(location.hash.replace("#", "")).trim();
  if (hash && WORK_MAP[hash]) {
    openModal({ id: hash, fromList: CONFIG.works.map((w) => w.id) });
  }
}

document.addEventListener("DOMContentLoaded", boot);
