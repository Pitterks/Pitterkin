import { z } from "zod";
import type { AttributeDef } from "@/db/schema";

/** Turn raw form fields into typed attributes according to the game's schema. Unknown keys are dropped. */
export function parseAttributes(defs: AttributeDef[], form: FormData): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const d of defs) {
    const raw = form.get(`attr_${d.key}`);
    if (d.type === "boolean") { out[d.key] = raw === "on"; continue; }
    const v = typeof raw === "string" ? raw.trim() : "";
    if (v === "") continue;
    if (d.type === "number") {
      const n = Number(v);
      if (!Number.isFinite(n) || n < 0 || n > 1e9) throw new Error(`${d.label}: invalid number`);
      out[d.key] = n;
    } else if (d.type === "select") {
      if (!d.options?.includes(v)) throw new Error(`${d.label}: invalid option`);
      out[d.key] = v;
    } else out[d.key] = v.slice(0, 200);
  }
  return out;
}

const attributeDefSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]{0,30}$/),
  label: z.string().min(1).max(60),
  type: z.enum(["number", "text", "select", "boolean"]),
  options: z.array(z.string().min(1).max(60)).max(50).optional(),
  filterable: z.boolean().optional(),
}).refine((d) => d.type !== "select" || (d.options && d.options.length > 0), "select needs options");

export const attributeSchemaJson = z.string().transform((s, ctx) => {
  try { return JSON.parse(s); } catch { ctx.addIssue({ code: "custom", message: "Invalid JSON" }); return z.NEVER; }
}).pipe(z.array(attributeDefSchema).max(30));

const url = z.string().url().refine((u) => /^https:\/\//.test(u), "images must be https URLs");

export const productSchema = z.object({
  gameId: z.string().uuid(),
  title: z.string().trim().min(3).max(140),
  description: z.string().trim().max(5000).default(""),
  priceUsd: z.coerce.number().min(0.5).max(100000),
  warrantyDays: z.coerce.number().int().min(0).max(365),
  active: z.boolean(),
  images: z.array(url).max(12),
});

export const parseImages = (raw: FormDataEntryValue | null): string[] =>
  String(raw ?? "").split("\n").map((l) => l.trim()).filter(Boolean);

export function parseDraft(raw?: string): Record<string, string> | undefined {
  if (!raw) return undefined;
  try {
    const v = JSON.parse(Buffer.from(raw, "base64url").toString());
    return v && typeof v === "object" ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x === "string")) as Record<string, string> : undefined;
  } catch { return undefined; }
}
