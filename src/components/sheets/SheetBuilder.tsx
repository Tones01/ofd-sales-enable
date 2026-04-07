"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, Send, Copy, Check, Archive } from "lucide-react"

const input = "w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  rejected:  "bg-red-50 text-red-500",
  fulfilled: "bg-blue-50 text-blue-700",
}

type Deal = Record<string, any>
type Retailer = Record<string, any>
type SheetDeal = Record<string, any>
type SheetRetailer = Record<string, any>

export default function SheetBuilder({
  sheet, allDeals, allRetailers, sheetDeals: initialSheetDeals,
  sheetRetailers: initialSheetRetailers, orderUrl,
}: {
  sheet: any
  allDeals: Deal[]
  allRetailers: Retailer[]
  sheetDeals: SheetDeal[]
  sheetRetailers: SheetRetailer[]
  orderUrl: string
}) {
  const [sheetDeals, setSheetDeals] = useState(initialSheetDeals)
  const [sheetRetailers, setSheetRetailers] = useState(initialSheetRetailers)
  const [status, setStatus] = useState(sheet.status)
  const [shipDate, setShipDate] = useState((sheet as any).ship_date ?? "")

  // Deal picker state
  const [lpFilter, setLpFilter] = useState("")
  const [formatFilter, setFormatFilter] = useState("")
  const [saleOnly, setSaleOnly] = useState(false)
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())

  // Retailer picker
  const [selectedRetailerIds, setSelectedRetailerIds] = useState<Set<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isDraft = status === "draft"
  const isSent = status === "sent"

  // Deals already on the sheet
  const dealIdsOnSheet = new Set(sheetDeals.map(sd => sd.deal_id))

  // Unique LP names for filter
  const lpNames = Array.from(new Set(allDeals.map(d => d.lp_name))).sort()
  const formats = Array.from(new Set(allDeals.map(d => d.format).filter(Boolean))).sort()

  // Filtered deals (not already on sheet)
  const filteredDeals = allDeals.filter(d => {
    if (dealIdsOnSheet.has(d.id)) return false
    if (lpFilter && d.lp_name !== lpFilter) return false
    if (formatFilter && d.format !== formatFilter) return false
    if (saleOnly && !d.sale_price) return false
    return true
  })

  // Retailers already on sheet
  const retailerIdsOnSheet = new Set(sheetRetailers.map(sr => sr.retailer_id).filter(Boolean))

  async function addDeals() {
    if (!selectedDealIds.size) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const rows = Array.from(selectedDealIds).map(deal_id => ({
      sheet_id: sheet.id, deal_id, visible_qty: allDeals.find(d => d.id === deal_id)?.qty_available ?? 0,
    }))
    const { data, error } = await supabase.from("sheet_deals").insert(rows).select("*, deals(lp_name, brand, product_name, sku, format, thc, list_price, sale_price, units_per_case)")
    if (error) { setError(error.message) }
    else { setSheetDeals(prev => [...prev, ...(data ?? [])]); setSelectedDealIds(new Set()) }
    setSaving(false)
  }

  async function removeDeal(sheetDealId: string) {
    const supabase = createClient()
    await supabase.from("sheet_deals").delete().eq("id", sheetDealId)
    setSheetDeals(prev => prev.filter(sd => sd.id !== sheetDealId))
  }

  async function addRetailers() {
    if (!selectedRetailerIds.size) return
    setSaving(true); setError(null)
    const supabase = createClient()
    const rows = Array.from(selectedRetailerIds).map(retailer_id => {
      const retailer = allRetailers.find(r => r.id === retailer_id)
      return { sheet_id: sheet.id, retailer_id, retailer_name: retailer?.name ?? "", status: "pending", alloc_qty: 0 }
    })
    const { data, error } = await supabase.from("sheet_retailers").insert(rows).select("id, retailer_id, retailer_name, alloc_qty, status, requested_ship_date, retailers(name)")
    if (error) { setError(error.message) }
    else { setSheetRetailers(prev => [...prev, ...(data ?? [])]); setSelectedRetailerIds(new Set()) }
    setSaving(false)
  }

  async function removeRetailer(id: string) {
    const supabase = createClient()
    await supabase.from("sheet_retailers").delete().eq("id", id)
    setSheetRetailers(prev => prev.filter(sr => sr.id !== id))
  }

  async function saveShipDate() {
    const supabase = createClient()
    await supabase.from("sheets").update({ ship_date: shipDate || null }).eq("id", sheet.id)
  }

  async function sendSheet() {
    if (!sheetDeals.length) { setError("Add at least one deal before sending."); return }
    if (!sheetRetailers.length) { setError("Add at least one retailer before sending."); return }
    setSaving(true); setError(null)
    const supabase = createClient()
    if (shipDate) await saveShipDate()
    const { error } = await supabase.from("sheets").update({ status: "sent" }).eq("id", sheet.id)
    if (error) { setError(error.message) }
    else { setStatus("sent") }
    setSaving(false)
  }

  async function archiveSheet() {
    setSaving(true)
    const supabase = createClient()
    await supabase.from("sheets").update({ status: "archived" }).eq("id", sheet.id)
    setStatus("archived")
    setSaving(false)
  }

  function copyLink() {
    navigator.clipboard.writeText(orderUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      {/* Ship date + actions row */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <label className="text-xs text-zinc-500 font-medium uppercase tracking-wide whitespace-nowrap">Ship date</label>
          <input
            type="date"
            value={shipDate}
            onChange={e => setShipDate(e.target.value)}
            onBlur={saveShipDate}
            disabled={!isDraft}
            className="px-3 py-1.5 text-sm border border-zinc-200 rounded-lg text-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900 disabled:opacity-50 disabled:bg-zinc-50"
          />
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isSent && (
            <button onClick={copyLink} className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-white border border-zinc-200 px-3 py-2 rounded-lg hover:bg-zinc-50 transition-colors">
              {copied ? <><Check size={12} className="text-emerald-500" /> Copied!</> : <><Copy size={12} /> Copy order link</>}
            </button>
          )}
          {isDraft && (
            <button onClick={sendSheet} disabled={saving} className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              <Send size={13} />
              {saving ? "Sending…" : "Send sheet"}
            </button>
          )}
          {(isDraft || isSent) && (
            <button onClick={archiveSheet} disabled={saving} className="text-sm text-zinc-400 hover:text-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors">
              <Archive size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Deals ── */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Deals on this sheet</h2>

          {/* Deals on sheet */}
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {sheetDeals.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Product</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Avail.</th>
                    {isDraft && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {sheetDeals.map(sd => {
                    const d = sd.deals as any
                    return (
                      <tr key={sd.id} className="group">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900 text-sm">{d?.product_name}</p>
                          <p className="text-xs text-zinc-400">{d?.lp_name}{d?.format ? ` · ${d.format}` : ""}{d?.thc ? ` · ${d.thc}` : ""}</p>
                          {d?.sale_price && (
                            <p className="text-xs text-emerald-600 font-medium mt-0.5">${Number(d.sale_price).toFixed(2)} sale</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-500 text-sm">{sd.visible_qty}</td>
                        {isDraft && (
                          <td className="px-3 py-3">
                            <button onClick={() => removeDeal(sd.id)} className="text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-400 p-5">No deals added yet.</p>
            )}
          </div>

          {/* Add deals picker — only in draft */}
          {isDraft && (
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Add deals</p>

              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                <select value={lpFilter} onChange={e => setLpFilter(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900">
                  <option value="">All LPs</option>
                  {lpNames.map(lp => <option key={lp} value={lp}>{lp}</option>)}
                </select>
                <select value={formatFilter} onChange={e => setFormatFilter(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900">
                  <option value="">All formats</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer">
                  <input type="checkbox" checked={saleOnly} onChange={e => setSaleOnly(e.target.checked)} className="rounded" />
                  Sale price only
                </label>
              </div>

              {/* Deal list with checkboxes */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {filteredDeals.length === 0 ? (
                  <p className="text-xs text-zinc-400 py-2">No deals match filters.</p>
                ) : filteredDeals.map(d => (
                  <label key={d.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedDealIds.has(d.id)}
                      onChange={e => {
                        const next = new Set(selectedDealIds)
                        e.target.checked ? next.add(d.id) : next.delete(d.id)
                        setSelectedDealIds(next)
                      }}
                      className="rounded flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-800 truncate">{d.product_name}</p>
                      <p className="text-xs text-zinc-400">{d.lp_name}{d.format ? ` · ${d.format}` : ""} · {d.qty_available} avail.</p>
                    </div>
                    {d.sale_price && <span className="ml-auto text-xs text-emerald-600 font-medium flex-shrink-0">${Number(d.sale_price).toFixed(2)}</span>}
                  </label>
                ))}
              </div>

              <button
                onClick={addDeals}
                disabled={!selectedDealIds.size || saving}
                className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={12} />
                Add {selectedDealIds.size > 0 ? `${selectedDealIds.size} deal${selectedDealIds.size > 1 ? "s" : ""}` : "selected"}
              </button>
            </div>
          )}
        </div>

        {/* ── RIGHT: Retailers ── */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Retailers on this sheet</h2>

          {/* Retailers on sheet */}
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {sheetRetailers.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Store</th>
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Ship req.</th>
                    <th className="text-center text-xs text-zinc-400 font-medium px-4 py-3">Status</th>
                    {isDraft && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {sheetRetailers.map(sr => (
                    <tr key={sr.id} className="group">
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900 text-sm">
                          {(sr.retailers as any)?.name ?? sr.retailer_name ?? "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-zinc-400">
                        {sr.requested_ship_date ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sr.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                          {sr.status}
                        </span>
                      </td>
                      {isDraft && (
                        <td className="px-3 py-3">
                          <button onClick={() => removeRetailer(sr.id)} className="text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                            <Trash2 size={13} />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-400 p-5">No retailers added yet.</p>
            )}
          </div>

          {/* Add retailers picker — only in draft */}
          {isDraft && (
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Add retailers</p>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {allRetailers.filter(r => !retailerIdsOnSheet.has(r.id)).length === 0 ? (
                  <p className="text-xs text-zinc-400 py-2">All retailers already added.</p>
                ) : allRetailers.filter(r => !retailerIdsOnSheet.has(r.id)).map(r => (
                  <label key={r.id} className="flex items-center gap-2.5 p-2 rounded-lg hover:bg-white cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedRetailerIds.has(r.id)}
                      onChange={e => {
                        const next = new Set(selectedRetailerIds)
                        e.target.checked ? next.add(r.id) : next.delete(r.id)
                        setSelectedRetailerIds(next)
                      }}
                      className="rounded flex-shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-zinc-800 truncate">{r.name}</p>
                      {r.city && <p className="text-xs text-zinc-400">{[r.city, r.province].filter(Boolean).join(", ")}</p>}
                    </div>
                  </label>
                ))}
              </div>
              <button
                onClick={addRetailers}
                disabled={!selectedRetailerIds.size || saving}
                className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-zinc-800 transition-colors"
              >
                <Plus size={12} />
                Add {selectedRetailerIds.size > 0 ? `${selectedRetailerIds.size} retailer${selectedRetailerIds.size > 1 ? "s" : ""}` : "selected"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
