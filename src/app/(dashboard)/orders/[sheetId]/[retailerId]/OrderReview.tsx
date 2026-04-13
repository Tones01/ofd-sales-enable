"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Check, ClipboardList, CheckCircle, XCircle, PackageCheck } from "lucide-react"
import { useRouter } from "next/navigation"

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  accepted:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-red-50 text-red-500 border-red-200",
  fulfilled: "bg-blue-50 text-blue-700 border-blue-200",
}

export default function OrderReview({
  sheetId,
  retailerId,
  sheet,
  retailerName,
  orderLines: initialLines,
}: {
  sheetId: string
  retailerId: string
  sheet: any
  retailerName: string
  orderLines: any[]
}) {
  const router = useRouter()
  const [orderLines, setOrderLines] = useState(initialLines)
  const [acting, setActing] = useState<"accept" | "reject" | "fulfill" | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const status = orderLines[0]?.status ?? "pending"
  const requestedShipDate = orderLines[0]?.requested_ship_date
  const retailerNotes = orderLines[0]?.retailer_notes
  const respondedAt = orderLines[0]?.responded_at

  const totalUnits = orderLines.reduce((sum, l) => sum + l.alloc_qty, 0)

  async function accept() {
    setActing("accept"); setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc("accept_order", {
      p_sheet_id: sheetId,
      p_retailer_id: retailerId,
    })
    if (error) { setError(error.message); setActing(null); return }
    setOrderLines(prev => prev.map(l => ({ ...l, status: "accepted" })))
    setActing(null)
  }

  async function fulfill() {
    setActing("fulfill"); setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc("fulfill_order", {
      p_sheet_id: sheetId,
      p_retailer_id: retailerId,
    })
    if (error) { setError(error.message); setActing(null); return }
    setOrderLines(prev => prev.map(l => ({ ...l, status: "fulfilled" })))
    setActing(null)
  }

  async function reject() {
    setActing("reject"); setError(null)
    const supabase = createClient()
    const { error } = await supabase.rpc("reject_order", {
      p_sheet_id: sheetId,
      p_retailer_id: retailerId,
    })
    if (error) { setError(error.message); setActing(null); return }
    setOrderLines(prev => prev.map(l => ({ ...l, status: "rejected" })))
    setActing(null)
  }

  function copyForD365() {
    const header = "SKU (Cova)\tProduct\tLP\tFormat\tPrice\tQty\tRequested Ship"
    const shipDate = requestedShipDate ?? (sheet as any).ship_date ?? ""
    const rows = orderLines.map(line => {
      const d = line.deals as any
      const price = d?.sale_price ?? d?.list_price ?? ""
      return [
        d?.sku ?? "",
        d?.product_name ?? "",
        d?.lp_name ?? "",
        d?.format ?? "",
        price,
        line.alloc_qty,
        shipDate,
      ].join("\t")
    })
    navigator.clipboard.writeText([header, ...rows].join("\n"))
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="space-y-6">

      {/* Header card */}
      <div className="bg-white border border-zinc-100 rounded-2xl p-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-1">Order review</p>
            <h1 className="font-serif text-2xl text-zinc-900">{retailerName}</h1>
            <div className="flex items-center gap-3 mt-2 text-sm text-zinc-500 flex-wrap">
              <span>Sheet: <span className="text-zinc-700 font-medium">{sheet.name}</span></span>
              {(sheet as any).ship_date && (
                <><span className="text-zinc-200">·</span><span>Sheet ship date: {(sheet as any).ship_date}</span></>
              )}
              {requestedShipDate && (
                <><span className="text-zinc-200">·</span><span className="text-zinc-900 font-medium">Requested: {requestedShipDate}</span></>
              )}
              {(sheet.profiles as any)?.full_name && (
                <><span className="text-zinc-200">·</span><span>Rep: {(sheet.profiles as any).full_name}</span></>
              )}
            </div>
            {retailerNotes && (
              <p className="mt-3 text-sm text-zinc-500 bg-zinc-50 border border-zinc-100 rounded-lg px-4 py-2.5 max-w-prose">
                <span className="font-medium text-zinc-700">Retailer notes: </span>{retailerNotes}
              </p>
            )}
          </div>

          {/* Status + action */}
          <div className="flex flex-col items-end gap-3">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
              {status.charAt(0).toUpperCase() + status.slice(1)}
            </span>

            {status === "pending" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={reject}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 disabled:opacity-50 transition-colors"
                >
                  <XCircle size={14} />
                  {acting === "reject" ? "Rejecting…" : "Reject"}
                </button>
                <button
                  onClick={accept}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle size={14} />
                  {acting === "accept" ? "Accepting…" : "Accept order"}
                </button>
              </div>
            )}

            {status === "accepted" && (
              <div className="flex items-center gap-2">
                <button
                  onClick={copyForD365}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
                >
                  {copied
                    ? <><Check size={14} className="text-emerald-500" /> Copied!</>
                    : <><ClipboardList size={14} /> Copy for D365</>}
                </button>
                <button
                  onClick={fulfill}
                  disabled={!!acting}
                  className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <PackageCheck size={14} />
                  {acting === "fulfill" ? "Marking…" : "Mark as fulfilled"}
                </button>
              </div>
            )}

            {status === "fulfilled" && (
              <span className="flex items-center gap-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 px-4 py-2 rounded-lg">
                <PackageCheck size={14} /> Order fulfilled
              </span>
            )}
          </div>
        </div>

        {error && <p className="mt-4 text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-4 py-2">{error}</p>}
      </div>

      {/* Order table */}
      <div className="bg-white border border-zinc-100 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-zinc-50 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-zinc-700">Order lines</h2>
            <p className="text-xs text-zinc-400 mt-0.5">{orderLines.length} product{orderLines.length !== 1 ? "s" : ""} · {totalUnits} total units</p>
          </div>
          {status === "accepted" && (
            <button
              onClick={copyForD365}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-zinc-50 border border-zinc-200 text-zinc-600 hover:bg-zinc-100 transition-colors"
            >
              {copied
                ? <><Check size={11} className="text-emerald-500" /> Copied!</>
                : <><ClipboardList size={11} /> Copy for D365</>}
            </button>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left text-xs text-zinc-400 font-medium px-6 py-3">SKU (Cova)</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Product</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 hidden md:table-cell">LP</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3 hidden lg:table-cell">Format / THC</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Price</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3 hidden md:table-cell">Units/case</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-6 py-3">Qty ordered</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {orderLines.map(line => {
              const d = line.deals as any
              return (
                <tr key={line.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-3.5">
                    <span className="font-mono text-xs text-zinc-600 bg-zinc-50 px-2 py-0.5 rounded">
                      {d?.sku ?? "—"}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <p className="font-medium text-zinc-900">{d?.product_name ?? "—"}</p>
                    {d?.brand && <p className="text-xs text-zinc-400">{d.brand}</p>}
                  </td>
                  <td className="px-4 py-3.5 text-zinc-500 hidden md:table-cell">{d?.lp_name ?? "—"}</td>
                  <td className="px-4 py-3.5 hidden lg:table-cell">
                    <p className="text-zinc-500 text-xs">{d?.format ?? "—"}</p>
                    {d?.thc && <p className="text-zinc-400 text-xs">{d.thc} THC</p>}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    {d?.sale_price != null ? (
                      <div>
                        <p className="font-medium text-emerald-600">${Number(d.sale_price).toFixed(2)}</p>
                        {d?.list_price != null && (
                          <p className="text-xs text-zinc-400 line-through">${Number(d.list_price).toFixed(2)}</p>
                        )}
                      </div>
                    ) : d?.list_price != null ? (
                      <span className="text-zinc-700">${Number(d.list_price).toFixed(2)}</span>
                    ) : (
                      <span className="text-zinc-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right text-zinc-500 tabular-nums hidden md:table-cell">
                    {d?.units_per_case ?? "—"}
                  </td>
                  <td className="px-6 py-3.5 text-right">
                    <span className="font-semibold text-zinc-900 tabular-nums text-base">{line.alloc_qty}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-zinc-100 bg-zinc-50/50">
              <td colSpan={5} className="px-6 py-3 text-xs text-zinc-400 text-right">Total units ordered</td>
              <td className="px-4 py-3 hidden md:table-cell" />
              <td className="px-6 py-3 text-right font-bold text-zinc-900 tabular-nums text-base">{totalUnits}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* D365 copy hint when accepted */}
      {status === "accepted" && (
        <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <p className="text-sm font-medium text-zinc-700">Ready to enter in D365</p>
            <p className="text-xs text-zinc-400 mt-0.5">Copy the table, paste into D365, then mark as fulfilled once the order is shipped.</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={copyForD365}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 transition-colors"
            >
              {copied
                ? <><Check size={14} className="text-emerald-500" /> Copied!</>
                : <><ClipboardList size={14} /> Copy for D365</>}
            </button>
            <button
              onClick={fulfill}
              disabled={!!acting}
              className="flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <PackageCheck size={14} />
              {acting === "fulfill" ? "Marking…" : "Mark as fulfilled"}
            </button>
          </div>
        </div>
      )}

      {/* Fulfilled confirmation */}
      {status === "fulfilled" && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-5 py-4 flex items-center gap-3">
          <PackageCheck size={16} className="text-blue-600 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-900">Order fulfilled</p>
            <p className="text-xs text-blue-600 mt-0.5">This order has been marked as shipped.</p>
          </div>
        </div>
      )}
    </div>
  )
}
