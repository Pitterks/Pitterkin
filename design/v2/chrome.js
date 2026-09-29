// shared header/sub-nav/footer
window.header = (active = "Fortnite") => `
<div class="top"><div class="wrap">
  <a class="logo" href="#"><b>P</b>Pitterkin</a>
  <div class="search">${ic("search", 18)}<span>Search accounts, skins, platforms…</span><kbd>/</kbd></div>
  <div class="row gap12"><div class="icon-btn">${ic("user-round", 19)}</div><div class="icon-btn">${ic("shopping-cart", 19)}<i>2</i></div></div>
</div></div>
<div class="sub"><div class="wrap">
  <a class="${active === "Fortnite" ? "on" : ""}" href="#">Fortnite</a><a href="#">Valorant <span class="chip" style="height:18px;padding:0 6px;font-size:10px">Soon</span></a><a href="#">Roblox <span class="chip" style="height:18px;padding:0 6px;font-size:10px">Soon</span></a><a href="#">How it works</a><a href="#">Warranty</a>
  <div class="r"><span class="row gap8">${ic("headset", 15)} Support</span><span class="row gap8">${ic("globe", 15)} English · USD</span></div>
</div></div>`;

window.footer = () => `
<div class="foot"><div class="wrap"><div class="cols">
  <div><a class="logo" href="#"><b>P</b>Pitterkin</a><p class="mut" style="margin-top:12px;max-width:300px;font-size:13px">Game accounts with full access, instant delivery and a replacement warranty on every order.</p>
    <div class="pay"><span>USDC</span><span>USDT</span><span>Polygon</span></div></div>
  <div><h5>Shop</h5><ul><li>Fortnite accounts</li><li>OG accounts</li><li>Under $50</li><li>All games</li></ul></div>
  <div><h5>Help</h5><ul><li>How it works</li><li>Warranty</li><li>Paying with crypto</li><li>Contact support</li></ul></div>
  <div><h5>Legal</h5><ul><li>Terms of service</li><li>Refund policy</li><li>Privacy policy</li></ul></div>
</div><div class="fine">Mockup with sample data · Not affiliated with, endorsed by or sponsored by Epic Games. Fortnite is a trademark of Epic Games, Inc.</div></div></div>`;

window.card = (d) => `
<a class="card acct" href="#"><div class="img">${locker(d.seed, d.mix, { cols: 8, rows: 5 })}
  <div class="tl"><span class="tagp">${d.plat}</span>${d.og ? '<span class="tagp acc">OG</span>' : ""}</div>
  <div class="br"><span class="tagp">${ic("layers", 12)} ${d.skins} skins</span></div></div>
  <div class="b"><h3>${d.t}</h3>
    <div class="stats"><span>${ic("gem", 14)}<b>${d.skins}</b> skins</span><span>${ic("coins", 14)}<b>${d.vb.toLocaleString("en-US")}</b> V-Bucks</span></div>
    ${rarBar(d.mix)}
    <div class="pr"><div class="p">${usd(d.price)}</div><div class="s ${d.stock < 3 ? "warn" : "ok"}">${d.stock < 3 ? "Only " + d.stock + " left" : d.stock + " in stock"}</div></div>
    <div class="perks"><span>${ic("zap", 13)} Instant</span><span>${ic("shield-check", 13)} 7d warranty</span><span>${ic("key-round", 13)} Full access</span></div></div></a>`;
