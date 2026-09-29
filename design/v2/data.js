// Sample data for mockups only. Not real inventory.
window.$ = (s, r = document) => r.querySelector(s);
window.$$ = (s, r = document) => [...r.querySelectorAll(s)];
window.usd = (n) => "$" + n.toLocaleString("en-US");
window.LIST = [
  { id: 1, seed: 11, t: "OG account · early seasons · full access", skins: 120, vb: 800,  plat: "PC",          price: 249, stock: 2, og: true,  mix: [40, 34, 26, 14, 6],  tag: "OG" },
  { id: 2, seed: 22, t: "Starter account · 25 skins · 1,500 V-Bucks", skins: 25, vb: 1500, plat: "PlayStation", price: 19,  stock: 5, og: false, mix: [12, 7, 4, 2, 0],  tag: "Starter" },
  { id: 3, seed: 33, t: "Stacked · 300+ skins · rare emotes",        skins: 312, vb: 3200, plat: "PC",          price: 599, stock: 1, og: true,  mix: [110, 90, 62, 34, 16], tag: "Stacked" },
  { id: 4, seed: 44, t: "Mid account · 60 skins · Xbox",             skins: 60,  vb: 0,    plat: "Xbox",        price: 39,  stock: 4, og: false, mix: [24, 18, 11, 5, 2],  tag: "" },
  { id: 5, seed: 55, t: "Season pass collector · 90 skins",          skins: 90,  vb: 450,  plat: "PC",          price: 79,  stock: 3, og: false, mix: [30, 26, 20, 10, 4], tag: "Popular" },
  { id: 6, seed: 66, t: "Rare set · 45 skins · mobile",              skins: 45,  vb: 2000, plat: "Mobile",      price: 29,  stock: 6, og: false, mix: [18, 12, 9, 4, 2],   tag: "" },
  { id: 7, seed: 77, t: "Legendary hunter · 150 skins · PC",         skins: 150, vb: 1200, plat: "PC",          price: 189, stock: 2, og: false, mix: [44, 40, 36, 20, 10], tag: "" },
  { id: 8, seed: 88, t: "Budget starter · 12 skins · Switch",        skins: 12,  vb: 300,  plat: "Switch",      price: 9,   stock: 8, og: false, mix: [7, 3, 2, 0, 0],   tag: "" },
];
