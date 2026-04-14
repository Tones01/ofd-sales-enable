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
  sheet, allDeals, sheetDeals: initialSheetDeals,
  sheetRetailers: initialSheetRetailers, siteUrl,
}: {
  sheet: any
  allDeals: Deal[]
  sheetDeals: SheetDeal[]
  sheetRetailers: SheetRetailerRow[]
  siteUrl: string
}) {
  const [sheetDeals, setSheetDeals] = useState(initialSheetDeals)
  const [sheetRetailers, setSheetRetailers] = useState(initialSheetRetailers)
  const [status, setStatus] = useState(sheet.status)
  const [shipDate, setShipDate] = useState((sheet as any).ship_date ?? "")

  // Deal picker state
  const [searchQuery, setSearchQuery] = useState("")
  const [lpFilter, setLpFilter] = useState("")
  const [brandFilter, setBrandFilter] = useState("")
  const [formatFilter, setFormatFilter] = useState("")
  const [saleOnly, setSaleOnly] = useState(false)
  const [selectedDealIds, setSelectedDealIds] = useState<Set<string>>(new Set())

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [linkCopied, setLinkCopied] = useState(false)
  const [d365Copied, setD365Copied] = useState<string | null>(null)
  const [acceptingKey, setAcceptingKey] = useState<string | null>(null)
  const [rejectingKey, setRejectingKey] = useState<string | null>(null)

  const isDraft = status === "draft"
  const isSent = status === "sent"

  // Order lines (deal_id IS NOT NULL) grouped by retailer
  const orderLines = sheetRetailers.filter(sr => sr.deal_id)
  const orderGroups = groupOrderLines(orderLines)
  const acceptedGroups = orderGroups.filter(g => g.status === "accepted")

  // Deals already on the sheet
  const dealIdsOnSheet = new Set(sheetDeals.map(sd => sd.deal_id))

  // Unique values for filter dropdowns
  const lpNames = Array.from(new Set(allDeals.map(d => d.lp_name))).sort()
  const brands  = Array.from(new Set(allDeals.map(d => (d as any).brand).filter(Boolean))).sort()
  const formats = Array.from(new Set(allDeals.map(d => d.format).filter(Boolean))).sort()

  const filteredDeals = allDeals.filter(d => {
    if (dealIdsOnSheet.has(d.id)) return false
    if (lpFilter && d.lp_name !== lpFilter) return false
    if (brandFilter && (d as any).brand !== brandFilter) return false
    if (formatFilter && d.format !== formatFilter) return false
    if (saleOnly && !d.sale_price) return false
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      const match =
        d.product_name?.toLowerCase().includes(q) ||
        d.lp_name?.toLowerCase().includes(q) ||
        (d as any).brand?.toLowerCase().includes(q) ||
        d.sku?.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const allFilteredSelected =
    filteredDeals.length > 0 && filteredDeals.every(d => selectedDealIds.has(d.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      const next = new Set(selectedDealIds)
      filteredDeals.forEach(d => next.delete(d.id))
      setSelectedDealIds(next)
    } else {
      const next = new Set(selectedDealIds)
      filteredDeals.forEach(d => next.add(d.id))
      setSelectedDealIds(next)
    }
  }

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

  async function saveShipDate() {
    const supabase = createClient()
    await supabase.from("sheets").update({ ship_date: shipDate || null }).eq("id", sheet.id)
  }

  async function sendSheet() {
    if (!sheetDeals.length) { setError("Add at least one deal before sending."); return }
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

  async function copyOrderLink() {
    try {
      await navigator.clipboard.writeText(`${siteUrl}/order/${sheet.id}`)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2500)
    } catch {
      setError(`Could not copy — the link is: ${siteUrl}/order/${sheet.id}`)
    }
  }

  async function copyD365(group: ReturnType<typeof groupOrderLines>[number]) {
    const header = "SKU\tProduct\tLP\tPrice\tQty"
    const rows = group.lines.map(line => {
      const d = line.deals as any
      const price = d?.sale_price ?? d?.list_price ?? ""
      return `${d?.sku ?? ""}\t${d?.product_name ?? ""}\t${d?.lp_name ?? ""}\t${price}\t${line.alloc_qty}`
    })
    try {
      await navigator.clipboard.writeText([header, ...rows].join("\n"))
      setD365Copied(group.key)
      setTimeout(() => setD365Copied(null), 2000)
    } catch {
      setError("Copy failed — please select and copy the table manually.")
    }
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
          {isSent && (
            <button
              onClick={copyOrderLink}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {linkCopied
                ? <><Check size={13} className="text-emerald-500" /> Copied!</>
                : <><Link2 size={13} /> Copy order link</>}
            </button>
          )}
          {isDraft && (
            <button onClick={sendSheet} disabled={saving} className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
              <Send size={13} />
              {saving ? "Sending…" : "Send sheet"}
            </button>
          )}
          {(isDraft || isSent) && (
            <button
              onClick={archiveSheet}
              disabled={saving}
              title="Archive this sheet — public order links will stop working"
              className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-700 px-3 py-2 rounded-lg hover:bg-zinc-100 transition-colors"
            >
              <Archive size={14} />
              <span className="hidden sm:inline">Archive</span>
            </button>
          )}
        </div>
      </div>

      {/* ── Deals ── */}
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
            <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              {/* Filter bar */}
              <div className="px-4 py-3 border-b border-zinc-100 bg-zinc-50/50 flex flex-wrap items-center gap-2">
                <p className="text-xs font-medium text-zinc-500 uppercase tracking-wide mr-1">Add deals</p>
                <input
                  type="text"
                  placeholder="Search product, LP, SKU…"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 placeholder:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-900 w-44"
                />
                <select value={lpFilter} onChange={e => setLpFilter(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900">
                  <option value="">All producers</option>
                  {lpNames.map(lp => <option key={lp} value={lp}>{lp}</option>)}
                </select>
                {brands.length > 0 && (
                  <select value={brandFilter} onChange={e => setBrandFilter(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900">
                    <option value="">All brands</option>
                    {brands.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                )}
                <select value={formatFilter} onChange={e => setFormatFilter(e.target.value)} className="text-xs border border-zinc-200 bg-white rounded-lg px-2.5 py-1.5 text-zinc-700 focus:outline-none focus:ring-1 focus:ring-zinc-900">
                  <option value="">All formats</option>
                  {formats.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
                <label className="flex items-center gap-1.5 text-xs text-zinc-600 cursor-pointer select-none">
                  <input type="checkbox" checked={saleOnly} onChange={e => setSaleOnly(e.target.checked)} className="rounded" />
                  Sale only
                </label>
                {(searchQuery || lpFilter || brandFilter || formatFilter || saleOnly) && (
                  <button
                    onClick={() => { setSearchQuery(""); setLpFilter(""); setBrandFilter(""); setFormatFilter(""); setSaleOnly(false) }}
                    className="text-xs text-zinc-400 hover:text-zinc-700 transition-colors"
                  >
                    Clear
                  </button>
                )}
                <div className="ml-auto">
                  <button
                    onClick={addDeals}
                    disabled={!selectedDealIds.size || saving}
                    className="flex items-center gap-1.5 text-xs font-medium bg-zinc-900 text-white px-3 py-1.5 rounded-lg disabled:opacity-40 hover:bg-zinc-800 transition-colors"
                  >
                    <Plus size={12} />
                    Add {selectedDealIds.size > 0 ? `${selectedDealIds.size} deal${selectedDealIds.size > 1 ? "s" : ""}` : "selected"}
                  </button>
                </div>
              </div>

              {/* Scrollable deal table */}
              <div className="max-h-80 overflow-y-auto">
                {filteredDeals.length === 0 ? (
                  <p className="text-xs text-zinc-400 px-5 py-6">No deals match your filters.</p>
                ) : (
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white border-b border-zinc-100 z-10">
                      <tr>
                        <th className="px-4 py-2.5 w-8">
                          <input
                            type="checkbox"
                            checked={allFilteredSelected}
                            onChange={toggleSelectAll}
                            className="rounded"
                            title="Select all"
                          />
                        </th>
                        <th className="text-left text-zinc-400 font-medium px-3 py-2.5">Product</th>
                        <th className="text-left text-zinc-400 font-medium px-3 py-2.5 hidden lg:table-cell">Brand</th>
                        <th className="text-left text-zinc-400 font-medium px-3 py-2.5 hidden md:table-cell">Producer</th>
                        <th className="text-left text-zinc-400 font-medium px-3 py-2.5 hidden lg:table-cell">Format</th>
                        <th className="text-left text-zinc-400 font-medium px-3 py-2.5 hidden xl:table-cell">THC</th>
                        <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Price</th>
                        <th className="text-right text-zinc-400 font-medium px-3 py-2.5 hidden lg:table-cell">Per case</th>
                        <th className="text-right text-zinc-400 font-medium px-3 py-2.5">Avail.</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-50">
                      {filteredDeals.map(d => {
                        const checked = selectedDealIds.has(d.id)
                        return (
                          <tr
                            key={d.id}
                            onClick={() => {
                              const next = new Set(selectedDealIds)
                              checked ? next.delete(d.id) : next.add(d.id)
                              setSelectedDealIds(next)
                            }}
                            className={`cursor-pointer transition-colors ${checked ? "bg-zinc-900/[0.03]" : "hover:bg-zinc-50"}`}
                          >
                            <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={e => {
                                  const next = new Set(selectedDealIds)
                                  e.target.checked ? next.add(d.id) : next.delete(d.id)
                                  setSelectedDealIds(next)
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="px-3 py-2.5">
                              <p className="font-medium text-zinc-900 truncate max-w-[180px]">{d.product_name}</p>
                              <p className="text-zinc-400">{d.sku}</p>
                            </td>
                            <td className="px-3 py-2.5 text-zinc-500 hidden lg:table-cell">{(d as any).brand ?? "—"}</td>
                            <td className="px-3 py-2.5 text-zinc-500 hidden md:table-cell">{d.lp_name}</td>
                            <td className="px-3 py-2.5 text-zinc-500 hidden lg:table-cell">{d.format ?? "—"}</td>
                            <td className="px-3 py-2.5 text-zinc-500 hidden xl:table-cell">{(d as any).thc ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right">
                              {d.sale_price != null
                                ? <span className="text-emerald-600 font-medium">${Number(d.sale_price).toFixed(2)}</span>
                                : d.list_price != null
                                ? <span className="text-zinc-600">${Number(d.list_price).toFixed(2)}</span>
                                : <span className="text-zinc-300">—</span>}
                            </td>
                            <td className="px-3 py-2.5 text-right text-zinc-500 hidden lg:table-cell">{(d as any).units_per_case ?? "—"}</td>
                            <td className="px-3 py-2.5 text-right font-medium text-zinc-700 tabular-nums">{d.qty_available.toLocaleString()}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Footer count */}
              {filteredDeals.length > 0 && (
                <div className="px-4 py-2 border-t border-zinc-50 bg-zinc-50/30 flex items-center justify-between">
                  <p className="text-xs text-zinc-400">
                    {filteredDeals.length} deal{filteredDeals.length !== 1 ? "s" : ""} shown
                    {selectedDealIds.size > 0 && <span className="ml-2 font-medium text-zinc-700">· {selectedDealIds.size} selected</span>}
                  </p>
                </div>
              )}
            </div>
          )}
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
