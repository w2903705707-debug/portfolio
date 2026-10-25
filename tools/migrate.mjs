/**
 * 一次性迁移脚本：把 app.js 里写死的 CONFIG 抽成 CMS 可编辑的 JSON。
 * 产物：
 *   content/site.json   —— 个人信息 / 联系方式 / Showreel / 分类 / 工具链 / 工作方式
 *   content/works.json  —— 作品数组（含 hidden / order / featured / bilibili）
 * 并且把 app.js 顶部的 CONFIG 字面量替换成「读取构建产物」的加载器。
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1")));
const APP = path.join(ROOT, "app.js");
const CONTENT_DIR = path.join(ROOT, "content");
fs.mkdirSync(CONTENT_DIR, { recursive: true });

const src = fs.readFileSync(APP, "utf8");

/* ---------- 1. 在沙箱里取出 CONFIG ---------- */
const stubDoc = {
  addEventListener() {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getElementById: () => null,
  documentElement: {},
  body: { style: {} },
  images: [],
};
const sandbox = {
  document: stubDoc,
  window: {},
  location: { hash: "" },
  console,
  Date,
  URLSearchParams,
  KeyboardEvent: class {},
  IntersectionObserver: class { observe() {} },
  setTimeout,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
vm.runInContext(src + "\n;globalThis.__C = CONFIG;", sandbox);
const C = sandbox.__C;
if (!C) throw new Error("没能从 app.js 里取到 CONFIG");

/* ---------- 2. 组装 site.json ---------- */
const me = C.me || {};
const head = Array.isArray(me.headline) ? me.headline : [];
const line1 = head[0] || "把故事";
const line2 = (head[1] || "剪进节奏里").replace(/<[^>]+>/g, "");
const accent = (head[1] || "").match(/<span class="accent">([^<]*)<\/span>/)?.[1] || "节奏";
const line2Plain = line2.replace(accent, "");

const site = {
  me: {
    name: me.name || "",
    en: me.en || "",
    role: me.role || "",
    units: (me.units || []).join(" / "),
    headlineTop: line1,
    headlineBottom: line2,
    headlineAccent: accent,
    tagline: String(me.tagline || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
    status: me.status || "",
    email: me.email || "",
    wechat: me.wechat || "",
    bilibili: me.bilibili || "",
    feishu: me.feishu || "",
  },
  showreel: {
    title: C.showreel?.title || "SHOWREEL",
    note: C.showreel?.note || "",
    cover: "",
    bilibili: C.showreel?.bilibili || "",
    video: C.showreel?.video || "",
  },
  categories: (C.categories || []).map((c) => ({
    id: c.id,
    name: c.name,
    note: c.note || "",
    coverImage: "",
  })),
  tools: (C.tools || []).join(", "),
  workflow: C.workflow || "",
};

/* ---------- 3. 组装 works.json ---------- */
const works = (C.works || []).map((w, i) => ({
  id: w.id,
  title: w.title || "",
  client: w.client || "",
  year: String(w.year || ""),
  cat: w.cat,
  role: w.role || "",
  dur: w.dur || "",
  tags: (w.tags || []).join(" / "),
  featured: !!w.featured,
  hidden: false,
  order: i + 1,
  desc: w.desc || "",
  cover: "",
  bilibili: w.bilibili || "",
  video: w.video || "",
}));

fs.writeFileSync(path.join(CONTENT_DIR, "site.json"), JSON.stringify(site, null, 2) + "\n", "utf8");
fs.writeFileSync(path.join(CONTENT_DIR, "works.json"), JSON.stringify({ items: works }, null, 2) + "\n", "utf8");
console.log(`✓ content/site.json  (${Object.keys(site).length} 个区块)`);
console.log(`✓ content/works.json (${works.length} 个作品，${works.filter((w) => w.featured).length} 个精选)`);

/* ---------- 4. 把 app.js 的 CONFIG 字面量换成加载器 ---------- */
const LOADER = `/* =========================================================================
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
  return {
    me: { ...me, units: splitList(me.units) },
    showreel: site.showreel || {},
    categories: (site.categories || []).filter((c) => c && c.id),
    tools: splitList(site.tools),
    workflow: site.workflow || "",
    works: normalizeWorks(raw.works || []),
  };
})();
`;

const replaced = src.replace(
  /\/\* =+\n \*  剪辑师作品集 · 深色新拟态[\s\S]*?const CONFIG = \{[\s\S]*?\n\};\n/,
  LOADER
);
if (replaced === src) {
  // 兜底：从 `const CONFIG = {` 开始匹配
  const alt = src.replace(/const CONFIG = \{[\s\S]*?\n\};\n/, LOADER);
  if (alt === src) throw new Error("没找到 CONFIG 字面量，替换失败");
  fs.writeFileSync(APP, alt, "utf8");
} else {
  fs.writeFileSync(APP, replaced, "utf8");
}
console.log("✓ app.js 的 CONFIG 已替换为加载器");
