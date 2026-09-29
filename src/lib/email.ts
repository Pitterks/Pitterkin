import { eq, sql as dsql } from "drizzle-orm";
import { db, schema, type Tx } from "@/db";

const { emailOutbox } = schema;

/** Queue inside the caller's transaction so an email exists iff the change committed. */
export async function queueEmail(tx: Pick<Tx, "insert">, msg: { to: string; subject: string; body: string }) {
  await tx.insert(emailOutbox).values(msg);
}

async function deliver(msg: { to: string; subject: string; body: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    // dev: no provider configured, the outbox row itself is the record
    console.log(`[email] to=${msg.to} subject=${msg.subject}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Pitterkin <orders@localhost>", to: msg.to, subject: msg.subject, text: msg.body }),
  });
  if (!res.ok) throw new Error(`email provider ${res.status}`);
}

/** Send pending mail; safe to call often and concurrently (rows are claimed with SKIP LOCKED). */
export async function flushOutbox(limit = 20) {
  return db.transaction(async (tx) => {
    const rows = await tx.execute<{ id: string; to: string; subject: string; body: string }>(dsql`
      SELECT id, "to", subject, body FROM email_outbox
      WHERE sent_at IS NULL AND attempts < 5
      ORDER BY created_at LIMIT ${limit} FOR UPDATE SKIP LOCKED`);
    let sent = 0;
    for (const r of rows) {
      try {
        await deliver(r);
        await tx.update(emailOutbox).set({ sentAt: new Date() }).where(eq(emailOutbox.id, r.id));
        sent++;
      } catch {
        await tx.update(emailOutbox).set({ attempts: dsql`attempts + 1` }).where(eq(emailOutbox.id, r.id));
      }
    }
    return sent;
  });
}

export const appUrl = () => process.env.APP_URL ?? "http://localhost:3000";
