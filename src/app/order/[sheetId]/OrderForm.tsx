"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Check } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

export default function OrderForm({ sheet, sheetDeals }: {
  sheet: any
  sheetDeals: any[]
}) {
  const [storeName, setStoreName] = useState("")
  const [requestedShipDate, setRequestedShipDate] = useState("")
  const [notes, setNotes] = useState("")
  const [qtys, setQtys] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setQty(sheetDealId: string, val: string) {
    setQtys(prev => ({ ...prev, [sheetDealId]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!storeName.trim()) { setError("Please enter your store name."); return }

    const lines = sheetDeals
      .filter(sd => parseInt(qtys[sd.id] ?? "0", 10) > 0)
      .map(sd => ({
        deal_id: sd.deal_id,
        alloc_qty: parseInt(qtys[sd.id], 10),
        units_per_case: (sd.deals as any)?.units_per_case ?? null,
        product_name: (sd.deals as any)?.product_name ?? "",
      }))

    if (!lines.length) { setError("Please enter a quantity for at least one product."); return }

    // Validate case multiples
    for (const line of lines) {
      if (line.units_per_case && line.alloc_qty % line.units_per_case !== 0) {
        setError(
          `"${line.product_name}" must be ordered in multiples of ${line.units_per_case} (cases of ${line.units_per_case}). You entered ${line.alloc_qty}.`
        )
        return
      }
    }

    setSubmitting(true)
    const supabase = createClient()

    const { error: rpcError } = await supabase.rpc("submit_order", {
      p_sheet_id:            sheet.id,
      p_retailer_id:         null,
      p_retailer_name:       storeName.trim(),
      p_requested_ship_date: requestedShipDate || null,
      p_retailer_notes:      notes || null,
      p_lines:               lines,
    })

    if (rpcError) { setError(rpcError.message); setSubmitting(false) }
    else { setSubmitted(true) }
  }

  if (submitted) {
    return (
      <div className="bg-white border border-zinc-100 rounded-2xl p-10 text-center">
        <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4">
          <Check size={20} className="text-emerald-600" />
        </div>
        <h2 className="font-serif text-xl text-zinc-900 mb-2">Order submitted</h2>
        <p className="text-sm text-zinc-400">Our team will be in touch to confirm your order. It will ship with your next available order.</p>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={e => {
        if (e.key === "Enter" && (e.target as HTMLElement).tagName !== "BUTTON") {
          e.preventDefault()
        }
      }}
      className="space-y-6"
    >

      {/* Store info */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-700">Your store</h2>

        <div>
          <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">Store name</label>
          <input className={input} value={storeName} onChange={e => setStoreName(e.target.value)} placeholder="Green Cannabis Co." required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">Requested ship date</label>
            <input type="date" className={input} value={requestedShipDate} onChange={e => setRequestedShipDate(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs text-zinc-500 mb-1.5 uppercase tracking-wide font-medium">Notes (optional)</label>
            <input className={input} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any special instructions…" />
          </div>
        </div>
      </div>

      {/* Product table */}
      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-50">
          <h2 className="text-sm font-medium text-zinc-700">Products — enter quantities below</h2>
          <p className="text-xs text-zinc-400 mt-0.5">Enter quantities in full cases. Leave blank to skip a product.</p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-50 bg-zinc-50/50">
              <th className="text-left text-xs text-zinc-400 font-medium px-6 py-3">Product</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 hidden sm:table-cell">Format / THC</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Price</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3 hidden sm:table-cell">Units/case</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-6 py-3 w-28">Qty</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {sheetDeals.map(sd => {
              const d = sd.deals as any
              return (
                <tr key={sd.id} className="hover:bg-zinc-50/40 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-zinc-900">{d?.product_name}</p>
                    <p className="text-xs text-zinc-400 mt-0.5">{d?.lp_name}{d?.brand ? ` · ${d.brand}` : ""}</p>
                    {d?.minor_cannabinoids && <p className="text-xs text-zinc-400">{d.minor_cannabinoids}</p>}
                    {sd.visible_qty > 0 && (
                      <p className="text-xs text-zinc-400 mt-1">
                        <span className="font-medium text-zinc-500">{sd.visible_qty.toLocaleString()}</span> units available
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-zinc-500 text-xs hidden sm:table-cell">
                    <p>{d?.format ?? "—"}</p>
                    {d?.thc && <p className="text-zinc-400">{d.thc} THC</p>}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {d?.sale_price != null ? (
                      <div>
                        <p className="font-medium text-emerald-600">${Number(d.sale_price).toFixed(2)}</p>
                        <p className="text-xs text-zinc-400 line-through">${Number(d.list_price).toFixed(2)}</p>
                      </div>
                    ) : d?.list_price != null ? (
                      <p className="text-zinc-700">${Number(d.list_price).toFixed(2)}</p>
                    ) : (
                      <p className="text-zinc-300">—</p>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right text-zinc-500 text-xs hidden sm:table-cell">
                    {d?.units_per_case ?? "—"}
                  </td>
                  <td className="px-6 py-4">
                    {(() => {
                      const upc: number | null = d?.units_per_case ?? null
                      const qty = parseInt(qtys[sd.id] ?? "0", 10)
                      const cases = upc && qty > 0 ? qty / upc : null
                      const overQty = qty > 0 && sd.visible_qty > 0 && qty > sd.visible_qty
                      return (
                        <div className="space-y-1">
                          <input
                            type="number"
                            min="0"
                            step={upc ?? 1}
                            placeholder="0"
                            value={qtys[sd.id] ?? ""}
                            onChange={e => setQty(sd.id, e.target.value)}
                            className={`w-full text-right px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 tabular-nums ${
                              overQty
                                ? "border-amber-300 focus:ring-amber-400"
                                : "border-zinc-200 focus:ring-zinc-900"
                            }`}
                          />
                          {overQty && (
                            <p className="text-right text-xs text-amber-600 font-medium">
                              ⚠ Exceeds available ({sd.visible_qty.toLocaleString()} units) — rep will review
                            </p>
                          )}
                          {!overQty && upc && (
                            <p className="text-right text-xs text-zinc-400 tabular-nums">
                              {cases !== null && Number.isInteger(cases)
                                ? <span className="text-emerald-600 font-medium">{cases} case{cases !== 1 ? "s" : ""}</span>
                                : cases !== null
                                ? <span className="text-red-500">not a full case</span>
                                : `cases of ${upc}`}
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-zinc-900 text-white text-sm font-medium py-3 rounded-xl hover:bg-zinc-800 disabled:opacity-50 transition-colors"
      >
        {submitting ? "Submitting…" : "Submit order"}
      </button>

      <p className="text-center text-xs text-zinc-400">
        By submitting you confirm this is an incremental order that will ship with your next available delivery.
      </p>
    </form>
  )
}
