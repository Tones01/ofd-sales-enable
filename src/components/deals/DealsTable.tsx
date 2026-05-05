"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Pencil, Search, X } from "lucide-react"
import EditableQty from "@/components/deals/EditableQty"
import EditablePrice from "@/components/deals/EditablePrice"

export const PAGE_SIZE = 50

export const SORTABLE_COLUMNS = [
  "product_name",
  "list_price",
  "sale_price",
  "qty_total",
  "qty_reserved",
  "qty_accepted",
  "qty_available",
  "deal_expiry",
  "created_at",
] as const

export type SortKey = (typeof SORTABLE_COLUMNS)[number]

export type DealsQuery = {
  q: string
  status: "all" | "active" | "closed"
  showSoldOut: boolean
  sort: SortKey
  dir: "asc" | "desc"
  page: number
}

type Props = {
  deals: any[]
  total: number
  query: DealsQuery
  isAdmin: boolean
  today: string
}

function buildSearch(query: DealsQuery) {
  const sp = new URLSearchParams()
  if (query.q) sp.set("q", query.q)
  if (query.status !== "all") sp.set("status", query.status)
  if (query.showSoldOut) sp.set("sold_out", "1")
  if (query.sort !== "created_at") sp.set("sort", query.sort)
  if (query.dir !== "desc") sp.set("dir", query.dir)
  if (query.page > 1) sp.set("page", String(query.page))
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default function DealsTable({ deals, total, query, isAdmin, today }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(query.q)

  // Reflect server-side `q` if the user navigates via back/forward.
  useEffect(() => { setSearchInput(query.q) }, [query.q])

  // Debounce search input → URL.
  useEffect(() => {
    if (searchInput === query.q) return
    const t = setTimeout(() => {
      update({ q: searchInput, page: 1 })
    }, 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function update(patch: Partial<DealsQuery>) {
    const next = { ...query, ...patch }
    startTransition(() => {
      router.replace(`${pathname}${buildSearch(next)}`, { scroll: false })
    })
  }

  function toggleSort(col: SortKey) {
    if (query.sort === col) {
      update({ dir: query.dir === "asc" ? "desc" : "asc", page: 1 })
    } else {
      // Sensible defaults: text asc, numeric/date desc.
      const desc = col !== "product_name"
      update({ sort: col, dir: desc ? "desc" : "asc", page: 1 })
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const from = total === 0 ? 0 : (query.page - 1) * PAGE_SIZE + 1
  const to = Math.min(total, query.page * PAGE_SIZE)

  return (
    <div className={`bg-white border border-zinc-100 rounded-xl ${isPending ? "opacity-70" : ""} transition-opacity`}>

      {/* Search + filter bar */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search product, LP, brand, SKU…"
            className="w-full pl-9 pr-8 py-2 text-sm bg-zinc-50 border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              aria-label="Clear search"
            >
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={query.status}
          onChange={e => update({ status: e.target.value as DealsQuery["status"], page: 1 })}
          className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="closed">Closed</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-500 whitespace-nowrap cursor-pointer select-none">
          <input
            type="checkbox"
            checked={query.showSoldOut}
            onChange={e => update({ showSoldOut: e.target.checked, page: 1 })}
            className="rounded border-zinc-300"
          />
          Show sold out
        </label>
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {total === 0 ? "0 results" : `${from}–${to} of ${total}`}
        </span>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <SortHeader label="Product" col="product_name" align="left" query={query} onClick={toggleSort} />
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Format</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">THC</th>
              <SortHeader label="Reg. $" col="list_price" align="right" query={query} onClick={toggleSort} />
              <SortHeader label="Sale $" col="sale_price" align="right" query={query} onClick={toggleSort} />
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">
                <span title="Number of units per case (pack size)">Units/case</span>
              </th>
              <SortHeader label="Total units" col="qty_total" align="right" query={query} onClick={toggleSort} hint="Total units in this deal" />
              <SortHeader label="On sheets" col="qty_reserved" align="right" query={query} onClick={toggleSort} hint="Units currently on active sheets (pending retailer response)" />
              <SortHeader label="Accepted" col="qty_accepted" align="right" query={query} onClick={toggleSort} hint="Units accepted by retailers" />
              <SortHeader label="Available" col="qty_available" align="right" query={query} onClick={toggleSort} hint="Units not yet allocated to any sheet" />
              <SortHeader label="Expiry" col="deal_expiry" align="center" query={query} onClick={toggleSort} />
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap">Status</th>
              {isAdmin && <th className="px-5 py-3.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {deals.map(deal => {
              const expiry = deal.deal_expiry as string | null
              const isExpired = expiry != null && expiry < today && deal.status === "active"
              const safeTotal = Number(deal.qty_total) || 0
              const lowThreshold = safeTotal * 0.15
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
                        : safeTotal > 0 && deal.qty_available < lowThreshold
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
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-900 px-2.5 py-1.5 rounded-md hover:bg-zinc-100 focus:opacity-100 focus:outline-none focus:ring-2 focus:ring-zinc-900"
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

        {deals.length === 0 && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400">
              {total === 0 && !query.q && query.status === "all"
                ? "No deals yet."
                : "No deals match your filters."}
            </p>
            {total === 0 && isAdmin && !query.q && query.status === "all" && (
              <Link href="/deals/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
                Create the first deal
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="px-4 py-3 border-t border-zinc-100 flex items-center justify-between text-sm">
          <span className="text-xs text-zinc-400">
            Page {query.page} of {totalPages}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => update({ page: query.page - 1 })}
              disabled={query.page <= 1 || isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <button
              onClick={() => update({ page: query.page + 1 })}
              disabled={query.page >= totalPages || isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function SortHeader({
  label,
  col,
  align,
  query,
  onClick,
  hint,
}: {
  label: string
  col: SortKey
  align: "left" | "right" | "center"
  query: DealsQuery
  onClick: (col: SortKey) => void
  hint?: string
}) {
  const active = query.sort === col
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  return (
    <th className={`text-${align} text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap`}>
      <button
        type="button"
        onClick={() => onClick(col)}
        title={hint}
        className={`inline-flex items-center gap-1 ${justify} hover:text-zinc-700 transition-colors ${active ? "text-zinc-700" : ""}`}
      >
        {label}
        <Icon size={11} className={active ? "" : "opacity-40"} />
      </button>
    </th>
  )
}
