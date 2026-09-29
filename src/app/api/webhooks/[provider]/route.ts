import { NextResponse } from "next/server";
import { getProvider } from "@/lib/payments";
import { handlePaymentEvent } from "@/lib/orders";

export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: id } = await params;
  const provider = getProvider(id);
  if (!provider) return NextResponse.json({ error: "unknown provider" }, { status: 404 });

  const raw = await req.text(); // raw body: signatures are computed over it
  let ev;
  try {
    ev = await provider.parseWebhook(raw, req.headers);
  } catch {
    return NextResponse.json({ error: "invalid" }, { status: 400 });
  }
  const outcome = await handlePaymentEvent(id, ev);
  return NextResponse.json({ outcome });
}
