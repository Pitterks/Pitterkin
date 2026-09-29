import { describe, expect, it } from "vitest";
import { attributeSchemaJson, parseAttributes, parseImages, productSchema } from "@/lib/catalog";
import type { AttributeDef } from "@/db/schema";

const defs: AttributeDef[] = [
  { key: "skins", label: "Skins", type: "number" },
  { key: "platform", label: "Platform", type: "select", options: ["PC", "Xbox"] },
  { key: "og", label: "OG", type: "boolean" },
  { key: "note", label: "Note", type: "text" },
];
const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.set(k, v); return f; };

describe("parseAttributes", () => {
  it("types values by schema, treats unchecked booleans as false, skips blanks and unknown keys", () => {
    expect(parseAttributes(defs, fd({ attr_skins: "120", attr_platform: "PC", attr_og: "on", attr_note: "", attr_evil: "x" })))
      .toEqual({ skins: 120, platform: "PC", og: true });
    expect(parseAttributes(defs, fd({}))).toEqual({ og: false });
  });
  it("rejects bad numbers and options outside the list", () => {
    expect(() => parseAttributes(defs, fd({ attr_skins: "abc" }))).toThrow();
    expect(() => parseAttributes(defs, fd({ attr_skins: "-5" }))).toThrow();
    expect(() => parseAttributes(defs, fd({ attr_platform: "Switch" }))).toThrow();
  });
});

describe("attribute schema JSON", () => {
  it("accepts valid, rejects broken JSON, bad keys and select without options", () => {
    expect(attributeSchemaJson.safeParse('[{"key":"rank","label":"Rank","type":"select","options":["A"]}]').success).toBe(true);
    expect(attributeSchemaJson.safeParse("nope").success).toBe(false);
    expect(attributeSchemaJson.safeParse('[{"key":"1bad","label":"x","type":"text"}]').success).toBe(false);
    expect(attributeSchemaJson.safeParse('[{"key":"rank","label":"Rank","type":"select"}]').success).toBe(false);
  });
});

describe("product input", () => {
  const ok = { gameId: "6d0b0a1e-3b8e-4a53-9c0e-1a2b3c4d5e6f", title: "Nice account", description: "", priceUsd: "19.99", warrantyDays: "7", active: true, images: [] };
  it("accepts a sane product", () => expect(productSchema.safeParse(ok).success).toBe(true));
  it("rejects tiny/huge prices and non-https or malformed image URLs", () => {
    expect(productSchema.safeParse({ ...ok, priceUsd: "0" }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, priceUsd: "9999999" }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, images: ["http://x.com/a.png"] }).success).toBe(false);
    expect(productSchema.safeParse({ ...ok, images: ["javascript:alert(1)"] }).success).toBe(false);
  });
  it("splits image lines", () => expect(parseImages("https://a/1.png\n\n  https://a/2.png \n")).toEqual(["https://a/1.png", "https://a/2.png"]));
});
