import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

// ── Auth ─────────────────────────────────────────────────────────────────────
// Set DEALS_API_KEY in your environment variables (Vercel / .env.local).
// Call this endpoint with:  Authorization: Bearer <your-key>

function authorized(req: NextRequest): boolean {
  const apiKey = process.env.DEALS_API_KEY
  if (!apiKey) return false // key not configured → deny all
  const header = req.headers.get("authorization") ?? ""
  return header === `Bearer ${apiKey}`
}

// ── Types ─────────────────────────────────────────────────────────────────────
type UpdateLine = {
  sku: string
  qty_total: number
}

// ── Handler ───────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  // Accept either a single object or an array
  const updates: UpdateLine[] = Array.isArray(body) ? body : [body as UpdateLine]

  // Basic validation
  const invalid = updates.filter(
    u => typeof u.sku !== "string" || !u.sku.trim() || typeof u.qty_total !== "number" || u.qty_total < 0
  )
  if (invalid.length) {
    return NextResponse.json(
      { error: "Each update must have a non-empty sku (string) and qty_total (non-negative number)", invalid },
      { status: 400 }
    )
  }

  // Use the service-role client so we can write without RLS restrictions
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const results: { sku: string; status: "updated" | "removed" | "closed" | "not_found" | "error"; message?: string }[] = []

  for (const { sku, qty_total } of updates) {
    const trimmedSku = sku.trim()

    // Check if a deal with this SKU exists
    const { data: existing } = await supabase
      .from("deals")
      .select("id, qty_total")
      .eq("sku", trimmedSku)
      .single()

    if (!existing) {
      results.push({ sku, status: "not_found" })
      continue
    }

    // Quantity of 0 means the product should be removed.
    // Attempt a hard delete; if FK references prevent it (e.g. the deal is
    // already attached to sheets), fall back to closing the deal so it
    // disappears from active listings.
    if (qty_total === 0) {
      const { error: deleteError } = await supabase
        .from("deals")
        .delete()
        .eq("id", existing.id)

      if (!deleteError) {
        results.push({ sku, status: "removed" })
        continue
      }

      const { error: closeError } = await supabase
        .from("deals")
        .update({ status: "closed", updated_at: new Date().toISOString() })
        .eq("id", existing.id)

      if (closeError) {
        results.push({ sku, status: "error", message: closeError.message })
      } else {
        results.push({ sku, status: "closed" })
      }
      continue
    }

    const { error } = await supabase
      .from("deals")
      .update({ qty_total, updated_at: new Date().toISOString() })
      .eq("id", existing.id)

    if (error) {
      results.push({ sku, status: "error", message: error.message })
    } else {
      results.push({ sku, status: "updated" })
    }
  }

  const updated   = results.filter(r => r.status === "updated").length
  const removed   = results.filter(r => r.status === "removed").length
  const closed    = results.filter(r => r.status === "closed").length
  const not_found = results.filter(r => r.status === "not_found").map(r => r.sku)
  const errors    = results.filter(r => r.status === "error")

  return NextResponse.json({
    ok: errors.length === 0,
    updated,
    removed,
    closed,
    not_found,
    errors: errors.length ? errors : undefined,
    results,
  })
}
