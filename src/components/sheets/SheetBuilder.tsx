"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Plus, Trash2, Send, Check, Archive, Link2, ExternalLink, ClipboardList } from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  rejected:  "bg-red-50 text-red-500",
  fulfilled: "bg-blue-50 text-blue-700",
}

type Deal = Record<string, any>
type Retailer = Record<string, any>
type SheetDeal = Record<string, any>
type SheetRetailerRow = Record<string, any>

// Group order lines (deal_id IS NOT NULL) by retailer
function groupOrderLines(lines: SheetRetailerRow[]) {
  const map = new Map<string, {
    key: string
    retailer_id: string | null
    name: string
    status: string
    requested_ship_date: string | null
    retailer_notes: string | null
    responded_at: string | null
    lines: SheetRetailerRow[]
  }>()

  for (const line of lines) {
    const key = line.retailer_id ?? line.retailer_name ?? "unknown"
    if (!map.has(key)) {
      map.set(key, {
        key,
        retailer_id: line.retailer_id,
        name: (line.retailers as any)?.name ?? line.retailer_name ?? "—",
        status: line.status,
        requested_ship_date: line.requested_ship_date,
        retailer_notes: line.retailer_notes,
        responded_at: line.responded_at,
        lines: [],
      })
    }
    map.get(key)!.lines.push(line)
  }

  return Array.from(map.values())
}

export default function SheetBuilder({
  sheet, allDeals, allRetailers, sheetDeals: initialSheetDeals,
  sheetRetailers: initialSheetRetailers, siteUrl,
}: {
  sheet: any
  allDeals: Deal[]
  allRetailers: Retailer[]
  sheetDeals: SheetDeal[]
  sheetRetailers: SheetRetailerRow[]
  siteUrl: string
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
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [d365Copied, setD365Copied] = useState<string | null>(null)
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null)
  const [rejectingKey, setRejectingKey] = useState<string | null>(null)

  const isDraft = status === "draft"
  const isSent = status === "sent"

  // Split into placeholder rows (send list) and order lines
  const placeholders = sheetRetailers.filter(sr => !sr.deal_id)
  const orderLines = sheetRetailers.filter(sr => sr.deal_id)
  const orderGroups = groupOrderLines(orderLines)
  const acceptedGroups = orderGroups.filter(g => g.status === "accepted")

  // Deals already on the sheet
  const dealIdsOnSheet = new Set(sheetDeals.map(sd => sd.deal_id))

  // Retailers already on sheet (by retailer_id)
  const retailerIdsOnSheet = new Set(placeholders.map(sr => sr.retailer_id).filter(Boolean))

  // Unique LP names / formats for filter
  const lpNames = Array.from(new Set(allDeals.map(d => d.lp_name))).sort()
  const formats = Array.from(new Set(allDeals.map(d => d.format).filter(Boolean))).sort()

  const filteredDeals = allDeals.filter(d => {
    if (dealIdsOnSheet.has(d.id)) return false
    if (lpFilter && d.lp_name !== lpFilter) return false
    if (formatFilter && d.format !== formatFilter) return false
    if (saleOnly && !d.sale_price) return false
    return true
  })

  // ── Actions ──────────────────────────────────────────────────────────────

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
    const { data, error } = await supabase.from("sheet_retailers").insert(rows)
      .select("id, retailer_id, retailer_name, deal_id, alloc_qty, status, requested_ship_date, retailer_notes, order_token, responded_at, retailers(id, name), deals(lp_name, brand, product_name, sku, format, thc, list_price, sale_price, units_per_case)")
    if (error) { setError(error.message) }
    else { setSheetRetailers(prev => [...prev, ...(data ?? [])]); setSelectedRetailerIds(new Set()) }
    setSaving(false)
  }

  async function removeRetailer(placeholderId: string, retailerId: string | null) {
    const supabase = createClient()
    await supabase.from("sheet_retailers").delete().eq("id", placeholderId)
    if (retailerId) {
      await supabase.from("sheet_retailers")
        .delete()
        .eq("sheet_id", sheet.id)
        .eq("retailer_id", retailerId)
        .not("deal_id", "is", null)
    }
    setSheetRetailers(prev => prev.filter(sr =>
      sr.id !== placeholderId && sr.retailer_id !== retailerId
    ))
  }

  async function saveShipDate() {
    const supabase = createClient()
    await supabase.from("sheets").update({ ship_date: shipDate || null }).eq("id", sheet.id)
  }

  async function sendSheet() {
    if (!sheetDeals.length) { setError("Add at least one deal before sending."); return }
    if (!placeholders.length) { setError("Add at least one retailer before sending."); return }
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

  async function acceptOrder(retailer_id: string) {
    setAcceptingKey(retailer_id)
    const supabase = createClient()
    const { error } = await supabase.rpc("accept_order", {
      p_sheet_id: sheet.id,
      p_retailer_id: retailer_id,
    })
    if (error) { setError(error.message) }
    else {
      setSheetRetailers(prev => prev.map(sr =>
        sr.retailer_id === retailer_id && sr.deal_id ? { ...sr, status: "accepted" } : sr
      ))
    }
    setAcceptingKey(null)
  }

  async function rejectOrder(retailer_id: string) {
    setRejectingKey(retailer_id)
    const supabase = createClient()
    const { error } = await supabase.rpc("reject_order", {
      p_sheet_id: sheet.id,
      p_retailer_id: retailer_id,
    })
    if (error) { setError(error.message) }
    else {
      setSheetRetailers(prev => prev.map(sr =>
        sr.retailer_id === retailer_id && sr.deal_id ? { ...sr, status: "rejected" } : sr
      ))
    }
    setRejectingKey(null)
  }

  function copyRetailerLink(token: string) {
    const url = `${siteUrl}/order/r/${token}`
    navigator.clipboard.writeText(url)
    setCopiedToken(token)
    setTimeout(() => setCopiedToken(null), 2000)
  }

  function copyD365(group: ReturnType<typeof groupOrderLines>[number]) {
    const header = "SKU\tProduct\tLP\tPrice\tQty"
    const rows = group.lines.map(line => {
      const d = line.deals as any
      const price = d?.sale_price ?? d?.list_price ?? ""
      return `${d?.sku ?? ""}\t${d?.product_name ?? ""}\t${d?.lp_name ?? ""}\t${price}\t${line.alloc_qty}`
    })
    navigator.clipboard.writeText([header, ...rows].join("\n"))
    setD365Copied(group.key)
    setTimeout(() => setD365Copied(null), 2000)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-3">{error}</p>}

      {/* Ship date + action buttons */}
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

      {/* ── Deals + Retailers grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* LEFT: Deals */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Deals on this sheet</h2>

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

          {isDraft && (
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl p-4 space-y-3">
              <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Add deals</p>
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

        {/* RIGHT: Retailers (send list with per-retailer links) */}
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Retailers on this sheet</h2>

          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {placeholders.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Store</th>
                    {isSent && <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Order</th>}
                    {isSent && <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Link</th>}
                    {isDraft && <th className="px-3 py-3" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {placeholders.map(sr => {
                    const group = orderGroups.find(g => g.retailer_id === sr.retailer_id)
                    return (
                      <tr key={sr.id} className="group">
                        <td className="px-4 py-3">
                          <p className="font-medium text-zinc-900 text-sm">
                            {(sr.retailers as any)?.name ?? sr.retailer_name ?? "—"}
                          </p>
                        </td>
                        {isSent && (
                          <td className="px-4 py-3">
                            {group ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[group.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                                {group.status}
                              </span>
                            ) : (
                              <span className="text-xs text-zinc-300">awaiting</span>
                            )}
                          </td>
                        )}
                        {isSent && (
                          <td className="px-4 py-3 text-right">
                            {sr.order_token && (
                              <button
                                onClick={() => copyRetailerLink(sr.order_token)}
                                className="inline-flex items-center gap-1 text-xs text-zinc-400 hover:text-zinc-900 transition-colors"
                                title="Copy order link for this retailer"
                              >
                                {copiedToken === sr.order_token
                                  ? <><Check size={11} className="text-emerald-500" /> Copied</>
                                  : <><Link2 size={11} /> Copy link</>
                                }
                              </button>
                            )}
                          </td>
                        )}
                        {isDraft && (
                          <td className="px-3 py-3">
                            <button onClick={() => removeRetailer(sr.id, sr.retailer_id)} className="text-zinc-300 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
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
              <p className="text-sm text-zinc-400 p-5">No retailers added yet.</p>
            )}
          </div>

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

      {/* ── Orders received ── */}
      {isSent && orderGroups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Orders received</h2>

          <div className="space-y-3">
            {orderGroups.map(group => (
              <div key={group.key} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
                {/* Retailer header */}
                <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-50 bg-zinc-50/40">
                  <div className="flex items-center gap-3">
                    <p className="font-medium text-zinc-900 text-sm">{group.name}</p>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[group.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                      {group.status}
                    </span>
                    {group.requested_ship_date && (
                      <span className="text-xs text-zinc-400">Req. ship: {group.requested_ship_date}</span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {group.retailer_id && (
                      <a
                        href={`/orders/${sheet.id}/${group.retailer_id}`}
                        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 transition-colors px-2.5 py-1.5 rounded-lg hover:bg-zinc-100"
                      >
                        <ExternalLink size={11} /> View order
                      </a>
                    )}
                    {group.status === "pending" && group.retailer_id && (
                      <>
                      <button
                        onClick={() => acceptOrder(group.retailer_id!)}
                        disabled={acceptingKey === group.retailer_id || rejectingKey === group.retailer_id}
                        className="text-xs font-medium px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                      >
                        {acceptingKey === group.retailer_id ? "Accepting…" : "Accept"}
                      </button>
                      <button
                        onClick={() => rejectOrder(group.retailer_id!)}
                        disabled={acceptingKey === group.retailer_id || rejectingKey === group.retailer_id}
                        className="text-xs font-medium px-3 py-1.5 bg-white text-red-500 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
                      >
                        {rejectingKey === group.retailer_id ? "Rejecting…" : "Reject"}
                      </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Order lines */}
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-zinc-50 bg-zinc-50/20">
                      <th className="text-left text-xs text-zinc-400 font-medium px-5 py-2.5">Product</th>
                      <th className="text-left text-xs text-zinc-400 font-medium px-4 py-2.5 hidden sm:table-cell">SKU</th>
                      <th className="text-right text-xs text-zinc-400 font-medium px-4 py-2.5">Price</th>
                      <th className="text-right text-xs text-zinc-400 font-medium px-5 py-2.5">Qty ordered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-50">
                    {group.lines.map(line => {
                      const d = line.deals as any
                      return (
                        <tr key={line.id} className="hover:bg-zinc-50/40">
                          <td className="px-5 py-3">
                            <p className="font-medium text-zinc-900">{d?.product_name ?? "—"}</p>
                            <p className="text-xs text-zinc-400">{d?.lp_name}{d?.format ? ` · ${d.format}` : ""}</p>
                          </td>
                          <td className="px-4 py-3 text-xs text-zinc-400 hidden sm:table-cell font-mono">{d?.sku ?? "—"}</td>
                          <td className="px-4 py-3 text-right text-sm">
                            {d?.sale_price != null
                              ? <span className="text-emerald-600 font-medium">${Number(d.sale_price).toFixed(2)}</span>
                              : d?.list_price != null
                              ? <span className="text-zinc-700">${Number(d.list_price).toFixed(2)}</span>
                              : <span className="text-zinc-300">—</span>}
                          </td>
                          <td className="px-5 py-3 text-right font-semibold text-zinc-900 tabular-nums">{line.alloc_qty}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                {group.retailer_notes && (
                  <div className="px-5 py-3 border-t border-zinc-50 bg-zinc-50/20">
                    <p className="text-xs text-zinc-400"><span className="font-medium text-zinc-500">Retailer notes:</span> {group.retailer_notes}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── D365 Export (accepted orders only) ── */}
      {acceptedGroups.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider">D365 Export</h2>
            <span className="text-xs text-zinc-300">— copy & paste into your 365 order</span>
          </div>

          {acceptedGroups.map(group => (
            <div key={group.key} className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-50">
                <p className="text-sm font-medium text-zinc-900">{group.name}</p>
                <button
                  onClick={() => copyD365(group)}
                  className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 bg-zinc-50 border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-100 transition-colors"
                >
                  {d365Copied === group.key
                    ? <><Check size={11} className="text-emerald-500" /> Copied!</>
                    : <><ClipboardList size={11} /> Copy for D365</>
                  }
                </button>
              </div>

              <table className="w-full text-sm font-mono">
                <thead>
                  <tr className="border-b border-zinc-50 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-5 py-2.5">SKU (Cova)</th>
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-2.5">Product</th>
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-2.5 hidden sm:table-cell">LP</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-2.5">Price</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-5 py-2.5">Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {group.lines.map(line => {
                    const d = line.deals as any
                    return (
                      <tr key={line.id} className="hover:bg-zinc-50/40 select-all">
                        <td className="px-5 py-2.5 text-zinc-600 font-mono text-xs">{d?.sku ?? "—"}</td>
                        <td className="px-4 py-2.5 text-zinc-900 text-xs">{d?.product_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-zinc-500 text-xs hidden sm:table-cell">{d?.lp_name ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right text-xs">
                          {d?.sale_price != null
                            ? <span className="text-emerald-600">${Number(d.sale_price).toFixed(2)}</span>
                            : d?.list_price != null
                            ? <span className="text-zinc-700">${Number(d.list_price).toFixed(2)}</span>
                            : "—"}
                        </td>
                        <td className="px-5 py-2.5 text-right font-semibold text-zinc-900 tabular-nums text-xs">{line.alloc_qty}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
