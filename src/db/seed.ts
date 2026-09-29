import "dotenv/config";
import { db, sql, schema } from "./index";
import { encrypt } from "../lib/crypto";

const fortniteAttrs: schema.AttributeDef[] = [
  { key: "skins", label: "Skins", type: "number", filterable: true },
  { key: "vbucks", label: "V-Bucks", type: "number", filterable: true },
  { key: "platform", label: "Platform", type: "select", options: ["PC", "PlayStation", "Xbox", "Switch", "Mobile"], filterable: true },
  { key: "og", label: "OG (Season 1-5)", type: "boolean", filterable: true },
  { key: "fullAccess", label: "Full access (email change)", type: "boolean" },
];

async function main() {
  const [game] = await db
    .insert(schema.games)
    .values({ slug: "fortnite", name: "Fortnite", attributeSchema: fortniteAttrs })
    .onConflictDoUpdate({ target: schema.games.slug, set: { attributeSchema: fortniteAttrs } })
    .returning();

  const samples = [
    { title: "OG Account · Renegade Raider + 120 skins", priceCents: 24900, attributes: { skins: 120, vbucks: 800, platform: "PC", og: true, fullAccess: true }, stock: 2 },
    { title: "Starter Pack · 25 skins · 1500 V-Bucks", priceCents: 1900, attributes: { skins: 25, vbucks: 1500, platform: "PlayStation", og: false, fullAccess: true }, stock: 5 },
    { title: "Stacked · 300+ skins · Black Knight", priceCents: 59900, attributes: { skins: 312, vbucks: 3200, platform: "PC", og: true, fullAccess: true }, stock: 1 },
  ];
  for (const s of samples) {
    const [p] = await db.insert(schema.products).values({
      gameId: game.id, title: s.title, priceCents: s.priceCents, attributes: s.attributes,
      description: "Sample listing (demo data). Full access, warranty included.",
    }).returning();
    await db.insert(schema.inventoryItems).values(
      Array.from({ length: s.stock }, (_, i) => ({
        productId: p.id,
        credentialsEnc: encrypt(`email: demo${i}@example.com\npassword: demo-password-${i}`),
        supplier: "demo",
        costCents: Math.round(s.priceCents * 0.6),
      })),
    );
  }
  console.log("seeded");
  await sql.end();
}
main();
