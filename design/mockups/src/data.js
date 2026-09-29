// Sample listing data for mockups only. Not real inventory.
window.DATA = [
  { t: "OG account · early seasons · full access", skins: 120, vb: "800",   plat: "PC",          price: 249, stock: 2, og: true,  r: [40, 34, 26, 14, 6] },
  { t: "Starter account · 25 skins",               skins: 25,  vb: "1,500", plat: "PlayStation", price: 19,  stock: 5, og: false, r: [12, 7, 4, 2, 0] },
  { t: "Stacked · 300+ skins · rare emotes",       skins: 312, vb: "3,200", plat: "PC",          price: 599, stock: 1, og: true,  r: [110, 90, 62, 34, 16] },
  { t: "Mid account · 60 skins · Xbox",            skins: 60,  vb: "0",     plat: "Xbox",        price: 39,  stock: 4, og: false, r: [24, 18, 11, 5, 2] },
  { t: "Season pass collector · 90 skins",         skins: 90,  vb: "450",   plat: "PC",          price: 79,  stock: 3, og: false, r: [30, 26, 20, 10, 4] },
  { t: "Rare set · 45 skins · mobile",             skins: 45,  vb: "2,000", plat: "Mobile",      price: 29,  stock: 6, og: false, r: [18, 12, 9, 4, 2] },
];
window.$ = (s, r = document) => r.querySelector(s);
window.usd = (n) => "$" + n;
