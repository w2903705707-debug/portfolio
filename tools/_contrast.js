(() => {
  const parse = (c) => {
    const m = c.match(/[\d.]+/g);
    if (!m) return null;
    const [r, g, b, a = 1] = m.map(Number);
    if (a === 0) return null;
    return [r, g, b, a];
  };
  const lum = (rgb) => {
    const f = (v) => {
      v = v / 255;
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * f(rgb[0]) + 0.7152 * f(rgb[1]) + 0.0722 * f(rgb[2]);
  };
  const ratio = (fg, bg) => {
    const l1 = lum(fg), l2 = lum(bg);
    const hi = Math.max(l1, l2), lo = Math.min(l1, l2);
    return ((hi + 0.05) / (lo + 0.05));
  };
  const bgOf = (el) => {
    let node = el;
    while (node && node !== document.documentElement) {
      const c = parse(getComputedStyle(node).backgroundColor);
      if (c && c[3] > 0.5) return c;
      node = node.parentElement;
    }
    return parse(getComputedStyle(document.body).backgroundColor) || [36, 39, 45, 1];
  };
  const check = (label, sel, need) => {
    const el = document.querySelector(sel);
    if (!el) return { label, error: "not found" };
    const fg = parse(getComputedStyle(el).color);
    const bg = bgOf(el);
    if (!fg) return { label, error: "no color" };
    const r = ratio(fg, bg);
    return { label, ratio: +r.toFixed(2), need, pass: r >= need };
  };

  const out = [
    check("正文/H1", ".hero h1", 7),
    check("简介 tagline", ".tagline", 4.5),
    check("卡片标题", ".card .body h3", 7),
    check("卡片副信息", ".card .body .sub", 4.5),
    check("橙底按钮文字", ".btn-solid", 4.5),
    check("选中筛选", ".filter.on", 4.5),
    check("页脚", ".foot span", 4.5),
    check("能力卡说明", ".abil p", 4.5),
    check("关于·工作方式", ".panel-note", 4.5),
    check("精选标签", ".badge-tl", 4.5)
  ];
  const fails = out.filter((o) => o.pass === false);
  return JSON.stringify({ all: out, failCount: fails.length });
})()
