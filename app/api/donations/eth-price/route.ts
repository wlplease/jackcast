import { NextResponse } from "next/server";

export const revalidate = 60;

export async function GET() {
  try {
    const response = await fetch("https://api.coinbase.com/v2/prices/ETH-USD/spot", {
      next: { revalidate: 15 },
      signal: AbortSignal.timeout(5000),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return NextResponse.json({ error: "Price unavailable" }, { status: 503 });
    const body = await response.json() as { data?: { amount?: string } };
    const ethUsd = Number(body.data?.amount);
    if (!Number.isFinite(ethUsd) || ethUsd <= 0) return NextResponse.json({ error: "Price unavailable" }, { status: 503 });
    return NextResponse.json({ ethUsd, updatedAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Price temporarily unavailable" }, { status: 503 });
  }
}
