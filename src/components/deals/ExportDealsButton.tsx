"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Download } from "lucide-react"

function escapeCSV(val: unknown): string {
  if (val == null) return ""
  const s = String(val)
  return s.includes(",") || s.includes('"') || s.includes("\n")
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

export default function ExportDealsButton() {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    const supabase = createClient()

    const { data: deals } = await supabase
      .from("deal_availability")
      .select("*")
      .order("lp_name")

    if (!deals?.length) { setLoading(false); return }

    const headers = [
      "sku", "product_name", "brand", "lp_name", "format", "thc",
      "minor_cannabinoids", "regular_price", "sale_price",
      "units_per_case", "qty_available", "qty_reserved",
      "qty_accepted", "qty_fulfilled", "qty_total",
      "expiry_date", "credit_description", "notes", "status",
    ]

    const rows = deals.map(d => [
      d.sku,
      d.product_name,
      (d as any).brand ?? "",
      d.lp_name,
      (d as any).format ?? "",
      (d as any).thc ?? "",
      (d as any).minor_cannabinoids ?? "",
      (d as any).list_price ?? "",
      (d as any).sale_price ?? "",
      (d as any).units_per_case ?? "",
      d.qty_available,
      d.qty_reserved,
      d.qty_accepted,
      (d as any).qty_fulfilled ?? 0,
      d.qty_total,
      (d as any).deal_expiry ?? "",
      d.credit_description ?? "",
      (d as any).notes ?? "",
      d.status,
    ].map(escapeCSV).join(","))

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv" })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement("a")
    a.href     = url
    a.download = `deals-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setLoading(false)
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 px-4 py-2 rounded-lg hover:bg-zinc-50 disabled:opacity-50 transition-colors"
    >
      <Download size={14} />
      {loading ? "Exporting…" : "Export CSV"}
    </button>
  )
}
