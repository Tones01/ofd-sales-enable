"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Pencil, Search, X } from "lucide-react"
import EditableQty from "@/components/deals/EditableQty"
import EditablePrice from "@/components/deals/EditablePrice"

export default function DealsTable({ deals, isAdmin, today }: {
  deals: any[]
  isAdmin: boolean
  today: string
}) {
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all")

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return deals.filter(deal => {
      if (statusFilter !== "all" && deal.status !== statusFilter) return false
      if (!q) return true
      return (
        deal.product_name?.toLowerCase().includes(q) ||
        deal.lp_name?.toLowerCase().includes(q) ||
        deal.brand?.toLowerCase().includes(q) ||
        deal.sku?.toLowerCase().includes(q)
      )
    })
  }, [deals, search, statusFilter])

  return (
    <div className="bg-white border border-zinc-100 rounded-xl">

      {/* Search + filter bar */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search product, LP, brand, SKU…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {filtered.length} of {deals.length}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Product</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Format</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">THC</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Reg. $</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Sale $</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Number of units per case (pack size)">Units/case</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Total units in this deal">Total units</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Units currently on active sheets (pending retailer response)">On sheets</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Units accepted by retailers">Accepted</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Units not yet allocated to any sheet">Available</span>
              </th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Expiry</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Status</th>
              {isAdmin && <th className="px-5 py-3.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {filtered.map(deal => {
              const expiry = deal.deal_expiry as string | null
              const isExpired = expiry != null && expiry < today && deal.status === "active"
              return (
                <tr key={deal.id} className={`transition-colors group ${isExpired ? "bg-red-50/40 hover:bg-red-50/60" : "hover:bg-zinc-50/60"}`}>
                  <td className="px-5 py-4 min-w-[200px]">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-zinc-900">{deal.product_name}</p>
                      {isExpired && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-600 whitespace-nowrap">
                          Expired
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-400 mt-0.5">
                      {deal.brand ? `${deal.brand} · ` : ""}{deal.lp_name} · {deal.sku}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-zinc-500 text-sm whitespace-nowrap">{deal.format ?? "—"}</td>
                  <td className="px-5 py-4 text-zinc-500 text-sm whitespace-nowrap">{deal.thc ?? "—"}</td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {isAdmin
                      ? <EditablePrice dealId={deal.id} field="list_price" value={deal.list_price ?? null} />
                      : deal.list_price != null ? `$${Number(deal.list_price).toFixed(2)}` : "—"}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    {isAdmin
                      ? <EditablePrice dealId={deal.id} field="sale_price" value={deal.sale_price ?? null} />
                      : deal.sale_price != null
                        ? <span className="text-emerald-600 font-medium">${Number(deal.sale_price).toFixed(2)}</span>
                        : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                    {deal.units_per_case != null ? deal.units_per_case : "—"}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500 tabular-nums whitespace-nowrap">
                    {isAdmin
                      ? <EditableQty dealId={deal.id} value={deal.qty_total} />
                      : deal.qty_total.toLocaleString()}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500 tabular-nums whitespace-nowrap">{deal.qty_reserved.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right text-zinc-500 tabular-nums whitespace-nowrap">{deal.qty_accepted.toLocaleString()}</td>
                  <td className="px-5 py-4 text-right tabular-nums whitespace-nowrap">
                    <span className={`font-semibold ${
                      deal.qty_available <= 0
                        ? "text-red-500"
                        : deal.qty_available < deal.qty_total * 0.15
                        ? "text-amber-500"
                        : "text-emerald-600"
                    }`}>
                      {deal.qty_available.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-center text-xs text-zinc-400 whitespace-nowrap">
                    {deal.deal_expiry ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-center whitespace-nowrap">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      deal.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-zinc-100 text-zinc-500"
                    }`}>
                      {deal.status}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="px-4 py-4 text-right whitespace-nowrap">
                      <Link
                        href={`/deals/${deal.id}/edit`}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-900 opacity-0 group-hover:opacity-100 transition-all px-2.5 py-1.5 rounded-md hover:bg-zinc-100"
                      >
                        <Pencil size={12} />
                        Edit
                      </Link>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400">
              {deals.length === 0 ? "No deals yet." : "No deals match your search."}
            </p>
            {deals.length === 0 && isAdmin && (
              <Link href="/deals/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
                Create the first deal
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
