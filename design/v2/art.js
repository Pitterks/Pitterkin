// Procedural "locker" mosaic: our own abstract cosmetics, coloured by rarity. No third-party assets.
(() => {
  const R = [ // [top, bottom, glow]
    ["#6B7590", "#2C3244", "#9AA4BF"],  // common
    ["#49B073", "#1B4A32", "#8CF0B0"],  // uncommon
    ["#4F86F0", "#1B3877", "#9CC0FF"],  // rare
    ["#A466EC", "#43217F", "#D7B0FF"],  // epic
    ["#F5A93A", "#7D4212", "#FFE0A0"],  // legendary
  ];
  const rng = (seed) => { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };

  const glyph = (kind, r, hi) => {
    const f = `fill="${hi}" fill-opacity=".92"`, d = `fill="#0b0d14" fill-opacity=".38"`;
    switch (kind) {
      case 0: return `<circle cx="32" cy="24" r="9.5" ${d}/><path d="M12 62c0-13 9-21 20-21s20 8 20 21z" ${d}/><circle cx="32" cy="22" r="8" ${f}/><path d="M14 60c0-11 8-18 18-18s18 7 18 18z" ${f}/>`;
      case 1: return `<circle cx="32" cy="24" r="9.5" ${d}/><path d="M13 62c0-13 8-20 19-20s19 7 19 20z" ${d}/><path d="M22 24a10 10 0 0 1 20 0v3H22z" ${f}/><rect x="21" y="26" width="22" height="5" rx="2.5" ${f}/><path d="M15 60c0-11 7-17 17-17s17 6 17 17z" ${f}/>`;
      case 2: return `<path d="M44 8 20 52l5 3 24-44z" ${d} transform="translate(2 2)"/><path d="M42 8 18 52l5 3 24-44z" ${f}/><path d="M26 44l-10 10 4 4 10-10z" ${f}/>`;
      case 3: return `<path d="M6 30a26 22 0 0 1 52 0z" ${d} transform="translate(0 2)"/><path d="M6 28a26 22 0 0 1 52 0z" ${f}/><path d="M32 30 22 56M32 30l10 26M32 30v26" stroke="${hi}" stroke-width="2" stroke-opacity=".8" fill="none"/>`;
      case 4: return `<path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" ${d} transform="translate(0 2)"/><path d="M32 6l7 16 17 2-13 11 4 17-15-9-15 9 4-17L8 24l17-2z" ${f}/>`;
      default: return `<rect x="18" y="16" width="28" height="36" rx="7" ${d} transform="translate(0 2)"/><rect x="18" y="14" width="28" height="36" rx="7" ${f}/><rect x="26" y="22" width="12" height="12" rx="3" fill="#0b0d14" fill-opacity=".3"/>`;
    }
  };

  /** mix = [common, uncommon, rare, epic, legendary] weights; returns an SVG string */
  window.locker = (seed, mix, { cols = 8, rows = 5, w = 640, h = 400 } = {}) => {
    const rand = rng(seed), total = mix.reduce((a, b) => a + b, 0), n = cols * rows;
    // rarity per tile, legendary/epic first so the best items land top-left like a real locker
    const tiles = [];
    mix.forEach((v, k) => { const c = Math.max(v ? 1 : 0, Math.round((v / total) * n)); for (let i = 0; i < c; i++) tiles.push(k); });
    // best items drift toward the top-left, but rarities are mixed like a real locker
    tiles.map((k, i) => [k + rand() * 2.4 - (i % cols) * 0.02, k]).sort((a, b) => b[0] - a[0]).forEach((t, i) => { tiles[i] = t[1]; });
    tiles.length = n;
    for (let i = tiles.length; i < n; i++) tiles[i] = 0;
    const gap = 3, tw = (w - gap * (cols + 1)) / cols, th = (h - gap * (rows + 1)) / rows;
    let defs = "", body = "";
    R.forEach(([a, b], k) => { defs += `<linearGradient id="g${seed}_${k}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`; });
    defs += `<radialGradient id="v${seed}" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>`;
    tiles.forEach((k, i) => {
      const x = gap + (i % cols) * (tw + gap), y = gap + Math.floor(i / cols) * (th + gap);
      const kind = Math.floor(rand() * 6), s = Math.min(tw, th) / 64;
      body += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><rect width="${tw.toFixed(1)}" height="${th.toFixed(1)}" rx="4" fill="url(#g${seed}_${k})"/>` +
        `<rect width="${tw.toFixed(1)}" height="${th.toFixed(1)}" rx="4" fill="url(#v${seed})"/>` +
        `<g transform="translate(${((tw - 64 * s) / 2).toFixed(1)} ${((th - 64 * s) / 2 - 3).toFixed(1)}) scale(${s.toFixed(3)})">${glyph(kind, k, R[k][2])}</g>` +
        `<rect x="0" y="${(th - 7).toFixed(1)}" width="${tw.toFixed(1)}" height="7" rx="0" fill="#05060a" fill-opacity=".45"/>` +
        `<rect x="${(tw * 0.18).toFixed(1)}" y="${(th - 4.5).toFixed(1)}" width="${(tw * (0.35 + rand() * 0.4)).toFixed(1)}" height="2" rx="1" fill="#fff" fill-opacity=".55"/></g>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid slice"><defs>${defs}</defs><rect width="${w}" height="${h}" fill="#0a0c12"/>${body}</svg>`;
  };
  window.RAR = R.map((r) => r[0]);
  window.RARN = ["Common", "Uncommon", "Rare", "Epic", "Legendary"];
  window.rarBar = (mix) => { const t = mix.reduce((a, b) => a + b, 0); return `<div class="rbar">${mix.map((v, i) => `<i style="flex:${v / t};background:${R[i][0]}"></i>`).join("")}</div>`; };
})();
