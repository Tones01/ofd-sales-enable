"use client"

import { useState, useMemo, useRef } from "react"
import { ClipboardList, Check, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"

type SortDir = "asc" | "desc" | null
type SortKey = "store" | "sku" | "product" | "lp" | "format" | "price" | "qty" | "ship_date" | "status"

function sortIcon(key: SortKey, active: SortKey | null, dir: SortDir) {
  if (active !== key) return <ChevronsUpDown size={11} className="text-zinc-300" />
  if (dir === "asc") return <ChevronUp size={11} className="text-zinc-600" />
  return <ChevronDown size={11} className="text-zinc-600" />
}

const STATUS_BADGE: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  rejected:  "bg-red-50 text-red-500",
  fulfilled: "bg-blue-50 text-blue-700",
}

export default function SheetOrdersTable({ sheet, orderLines }: { sheet: any; orderLines: any[] }) {
  const [storeFilter, setStoreFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)
  const [copiedCell, setCopiedCell] = useState<string | null>(null)
  const [tableCopied, setTableCopied] = useState(false)

  // Unique store names for filter dropdown
  const storeNames = useMemo(() => {
    const names = new Set(orderLines.map(l => (l.retailers as any)?.name ?? l.retailer_name ?? "Unknown"))
    return Array.from(names).sort()
  }, [orderLines])

  const statuses = useMemo(() => {
    return Array.from(new Set(orderLines.map(l => l.status))).sort()
  }, [orderLines])

  // Flatten each line into a display row
  const rows = useMemo(() => orderLines.map(l => {
    const d = l.deals as any
    const r = l.retailers as any
    const price = d?.sale_price ?? d?.list_price ?? null
    return {
      id: l.id,
      retailer_id: l.retailer_id,
      store: r?.name ?? l.retailer_name ?? "—",
      sku: d?.sku ?? "—",
      product: d?.product_name ?? "—",
      brand: d?.brand ?? "",
      lp: d?.lp_name ?? "—",
      format: d?.format ?? "—",
      thc: d?.thc ?? "",
      price,
      price_display: price != null ? `$${Number(price).toFixed(2)}` : "—",
      units_per_case: d?.units_per_case ?? null,
      qty: l.alloc_qty,
      ship_date: l.requested_ship_date ?? (sheet as any).ship_date ?? "—",
      status: l.status,
      notes: l.retailer_notes ?? "",
    }
  }), [orderLines, sheet])

  // Filter
  const filtered = useMemo(() => {
    let out = rows
    if (storeFilter !== "all") out = out.filter(r => r.store === storeFilter)
    if (statusFilter !== "all") out = out.filter(r => r.status === statusFilter)
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      out = out.filter(r =>
        r.product.toLowerCase().includes(q) ||
        r.sku.toLowerCase().includes(q) ||
        r.lp.toLowerCase().includes(q) ||
        r.store.toLowerCase().includes(q) ||
        r.format.toLowerCase().includes(q)
      )
    }
    return out
  }, [rows, storeFilter, statusFilter, search])

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey || !sortDir) return filtered
    return [...filtered].sort((a, b) => {
      let av: any = a[sortKey as keyof typeof a]
      let bv: any = b[sortKey as keyof typeof b]
      if (av == null) av = ""
      if (bv == null) bv = ""
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv))
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey !== key) { setSortKey(key); setSortDir("asc"); return }
    if (sortDir === "asc") { setSortDir("desc"); return }
    setSortKey(null); setSortDir(null)
  }

  function copyCell(id: string, value: string) {
    navigator.clipboard.writeText(value)
    setCopiedCell(id)
    setTimeout(() => setCopiedCell(null), 1500)
  }

  function copyTable() {
    const header = ["Store", "SKU (Cova)", "Product", "LP", "Format", "THC", "Price", "Units/Case", "Qty", "Ship Date", "Status"].join("\t")
    const rowsText = sorted.map(r =>
      [
        r.store, r.sku, r.product, r.lp, r.format, r.thc,
        r.price_display, r.units_per_case ?? "", r.qty, r.ship_date, r.status,
      ].join("\t")
    ).join("\n")
    navigator.clipboard.writeText(header + "\n" + rowsText)
    setTableCopied(true)
    setTimeout(() => setTableCopied(false), 2000)
  }

  const totalUnits = sorted.reduce((s, r) => s + r.qty, 0)
  const acceptedUnits = sorted.filter(r => r.status === "accepted").reduce((s, r) => s + r.qty, 0)

  const thClass = "text-left text-xs font-medium text-zinc-400 px-3 py-2.5 whitespace-nowrap select-none"
  const tdClass = "px-3 py-2.5 text-sm text-zinc-700 whitespace-nowrap cursor-pointer hover:bg-blue-50/60 transition-colors group relative"

  return (
    <div className="space-y-4">

      {/* Controls */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search product, SKU, store…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 w-52 bg-white"
        />
        <select
          value={storeFilter}
          onChange={e => setStoreFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
        >
          <option value="all">All stores</option>
          {storeNames.map(n => <option key={n} value={n}>{n}</option>)}
        </select>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-zinc-900 bg-white"
        >
          <option value="all">All statuses</option>
          {statuses.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-3">
          <p className="text-xs text-zinc-400 tabular-nums">
            {sorted.length} line{sorted.length !== 1 ? "s" : ""} · {totalUnits} units
            {acceptedUnits > 0 && acceptedUnits !== totalUnits && (
              <span className="text-emerald-600 ml-1">({acceptedUnits} accepted)</span>
            )}
          </p>
          <button
            onClick={copyTable}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-zinc-900 text-white hover:bg-zinc-800 transition-colors"
          >
            {tableCopied
              ? <><Check size={12} className="text-emerald-400" /> Copied!</>
              : <><ClipboardList size={12} /> Copy all for D365</>}
          </button>
        </div>
      </div>

      {/* Hint */}
      <p className="text-xs text-zinc-400">Click any cell to copy its value. Use "Copy all for D365" to copy the full table as a spreadsheet.</p>

      {/* Table */}
      <div className="bg-white border border-zinc-100 rounded-xl overflow-auto shadow-sm">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50/70 sticky top-0 z-10">
              {([
                ["store",     "Store"],
                ["sku",       "SKU (Cova)"],
                ["product",   "Product"],
                ["lp",        "LP"],
                ["format",    "Format / THC"],
                ["price",     "Price"],
                null, // units/case — not sortable label
                ["qty",       "Qty"],
                ["ship_date", "Ship date"],
                ["status",    "Status"],
              ] as (([SortKey, string]) | null)[]).map((col, i) => {
                if (!col) return (
                  <th key={i} className={thClass}>Units/case</th>
                )
                const [key, label] = col
                return (
                  <th
                    key={key}
                    className={`${thClass} cursor-pointer hover:text-zinc-700 hover:bg-zinc-100 transition-colors`}
                    onClick={() => toggleSort(key)}
                  >
                    <span className="flex items-center gap-1">
                      {label}
                      {sortIcon(key, sortKey, sortDir)}
                    </span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-sm text-zinc-400">
                  No orders match your filters.
                </td>
              </tr>
            ) : sorted.map(row => (
              <tr key={row.id} className="hover:bg-zinc-50/50 transition-colors">

                <td className={tdClass} onClick={() => copyCell(row.id + "-store", row.store)}>
                  <span className="font-medium text-zinc-900">{row.store}</span>
                  {copiedCell === row.id + "-store" && <CopiedBadge />}
                </td>

                <td className={tdClass} onClick={() => copyCell(row.id + "-sku", row.sku)}>
                  <span className="font-mono text-xs bg-zinc-100 text-zinc-700 px-1.5 py-0.5 rounded">{row.sku}</span>
                  {copiedCell === row.id + "-sku" && <CopiedBadge />}
                </td>

                <td className={tdClass} onClick={() => copyCell(row.id + "-product", row.product)}>
                  <p className="text-zinc-900">{row.product}</p>
                  {row.brand && <p className="text-xs text-zinc-400">{row.brand}</p>}
                  {copiedCell === row.id + "-product" && <CopiedBadge />}
                </td>

                <td className={tdClass} onClick={() => copyCell(row.id + "-lp", row.lp)}>
                  {row.lp}
                  {copiedCell === row.id + "-lp" && <CopiedBadge />}
                </td>

                <td className={tdClass} onClick={() => copyCell(row.id + "-format", [row.format, row.thc].filter(Boolean).join(" · "))}>
                  <p>{row.format}</p>
                  {row.thc && <p className="text-xs text-zinc-400">{row.thc} THC</p>}
                  {copiedCell === row.id + "-format" && <CopiedBadge />}
                </td>

                <td className={`${tdClass} text-right`} onClick={() => copyCell(row.id + "-price", row.price != null ? String(row.price) : "")}>
                  {row.price != null ? (
                    <span className="font-medium text-emerald-700">{row.price_display}</span>
                  ) : (
                    <span className="text-zinc-300">—</span>
                  )}
                  {copiedCell === row.id + "-price" && <CopiedBadge />}
                </td>

                <td className={`${tdClass} text-right tabular-nums text-zinc-500`} onClick={() => copyCell(row.id + "-upc", String(row.units_per_case ?? ""))}>
                  {row.units_per_case ?? "—"}
                  {copiedCell === row.id + "-upc" && <CopiedBadge />}
                </td>

                <td className={`${tdClass} text-right tabular-nums font-semibold text-zinc-900`} onClick={() => copyCell(row.id + "-qty", String(row.qty))}>
                  {row.qty}
                  {copiedCell === row.id + "-qty" && <CopiedBadge />}
                </td>

                <td className={tdClass} onClick={() => copyCell(row.id + "-ship", row.ship_date)}>
                  {row.ship_date}
                  {copiedCell === row.id + "-ship" && <CopiedBadge />}
                </td>

                <td className={tdClass}>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_BADGE[row.status] ?? "bg-zinc-100 text-zinc-500"}`}>
                    {row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>

          {sorted.length > 0 && (
            <tfoot>
              <tr className="border-t border-zinc-200 bg-zinc-50/70">
                <td colSpan={7} className="px-3 py-2.5 text-xs text-zinc-400 text-right font-medium">
                  Total ({sorted.length} line{sorted.length !== 1 ? "s" : ""})
                </td>
                <td className="px-3 py-2.5 text-right font-bold text-zinc-900 tabular-nums">
                  {totalUnits}
                </td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}

function CopiedBadge() {
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-blue-50/90 text-blue-700 text-xs font-medium rounded pointer-events-none z-10">
      <Check size={11} className="mr-1" /> Copied
    </span>
  )
}
