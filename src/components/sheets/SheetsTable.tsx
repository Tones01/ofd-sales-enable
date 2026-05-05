"use client"

import { useEffect, useState, useTransition } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, X } from "lucide-react"

export const PAGE_SIZE = 50

export const SORTABLE_COLUMNS = ["name", "status", "created_at"] as const
export type SortKey = (typeof SORTABLE_COLUMNS)[number]

export type SheetsQuery = {
  q: string
  status: "all" | "draft" | "sent" | "archived"
  sort: SortKey
  dir: "asc" | "desc"
  page: number
}

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  sent: "bg-blue-50 text-blue-700",
  archived: "bg-zinc-50 text-zinc-400",
}

function buildSearch(query: SheetsQuery) {
  const sp = new URLSearchParams()
  if (query.q) sp.set("q", query.q)
  if (query.status !== "all") sp.set("status", query.status)
  if (query.sort !== "created_at") sp.set("sort", query.sort)
  if (query.dir !== "desc") sp.set("dir", query.dir)
  if (query.page > 1) sp.set("page", String(query.page))
  const s = sp.toString()
  return s ? `?${s}` : ""
}

export default function SheetsTable({
  sheets,
  total,
  query,
}: {
  sheets: any[]
  total: number
  query: SheetsQuery
}) {
  const router = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()
  const [searchInput, setSearchInput] = useState(query.q)

  useEffect(() => { setSearchInput(query.q) }, [query.q])

  useEffect(() => {
    if (searchInput === query.q) return
    const t = setTimeout(() => update({ q: searchInput, page: 1 }), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  function update(patch: Partial<SheetsQuery>) {
    const next = { ...query, ...patch }
    startTransition(() => {
      router.replace(`${pathname}${buildSearch(next)}`, { scroll: false })
    })
  }

  function toggleSort(col: SortKey) {
    if (query.sort === col) {
      update({ dir: query.dir === "asc" ? "desc" : "asc", page: 1 })
    } else {
      const desc = col === "created_at"
      update({ sort: col, dir: desc ? "desc" : "asc", page: 1 })
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const fromRow = total === 0 ? 0 : (query.page - 1) * PAGE_SIZE + 1
  const toRow = Math.min(total, query.page * PAGE_SIZE)

  return (
    <div className={`bg-white border border-zinc-100 rounded-xl overflow-hidden ${isPending ? "opacity-70" : ""} transition-opacity`}>

      {/* Search + filter bar */}
      <div className="px-4 py-3 border-b border-zinc-100 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Search sheet name…"
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
          onChange={e => update({ status: e.target.value as SheetsQuery["status"], page: 1 })}
          className="text-sm bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-2 text-zinc-700 focus:outline-none focus:ring-2 focus:ring-zinc-900 transition"
        >
          <option value="all">All statuses</option>
          <option value="draft">Draft</option>
          <option value="sent">Sent</option>
          <option value="archived">Archived</option>
        </select>
        <span className="text-xs text-zinc-400 whitespace-nowrap">
          {total === 0 ? "0 results" : `${fromRow}–${toRow} of ${total}`}
        </span>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-100">
            <SortHeader label="Sheet" col="name" align="left" query={query} onClick={toggleSort} />
            <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden md:table-cell">Rep</th>
            <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Retailers</th>
            <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Units out</th>
            <SortHeader label="Status" col="status" align="center" query={query} onClick={toggleSort} />
            <SortHeader label="Date" col="created_at" align="right" query={query} onClick={toggleSort} />
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-50">
          {sheets.map(sheet => {
            const retailers = (sheet.sheet_retailers as any[]) ?? []
            const unitsOut = retailers
              .filter(r => ["accepted", "fulfilled"].includes(r.status))
              .reduce((s: number, r: any) => s + r.alloc_qty, 0)
            const pending = retailers.filter(r => r.status === "pending").length

            return (
              <tr key={sheet.id} className="hover:bg-zinc-50 transition-colors">
                <td className="px-5 py-4">
                  <Link href={`/sheets/${sheet.id}`} className="font-medium text-zinc-900 hover:underline underline-offset-2">
                    {sheet.name}
                  </Link>
                  {pending > 0 && (
                    <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600">
                      {pending} pending
                    </span>
                  )}
                </td>
                <td className="px-5 py-4 text-zinc-500 hidden md:table-cell">
                  {(sheet.profiles as any)?.full_name ?? "—"}
                </td>
                <td className="px-5 py-4 text-center text-zinc-500">{retailers.length}</td>
                <td className="px-5 py-4 text-right text-zinc-500 hidden lg:table-cell">{unitsOut.toLocaleString()}</td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sheet.status] ?? ""}`}>
                    {sheet.status}
                  </span>
                </td>
                <td className="px-5 py-4 text-right text-zinc-400 text-xs">
                  {new Date(sheet.created_at).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {sheets.length === 0 && (
        <div className="text-center py-16">
          <p className="text-sm text-zinc-400">
            {total === 0 && !query.q && query.status === "all"
              ? "No sheets yet."
              : "No sheets match your filters."}
          </p>
          {total === 0 && !query.q && query.status === "all" && (
            <Link href="/sheets/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
              Build the first sheet
            </Link>
          )}
        </div>
      )}

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
}: {
  label: string
  col: SortKey
  align: "left" | "right" | "center"
  query: SheetsQuery
  onClick: (col: SortKey) => void
}) {
  const active = query.sort === col
  const Icon = !active ? ArrowUpDown : query.dir === "asc" ? ArrowUp : ArrowDown
  const justify = align === "right" ? "justify-end" : align === "center" ? "justify-center" : "justify-start"
  return (
    <th className={`text-${align} text-xs text-zinc-400 font-medium px-5 py-3.5 whitespace-nowrap`}>
      <button
        type="button"
        onClick={() => onClick(col)}
        className={`inline-flex items-center gap-1 ${justify} hover:text-zinc-700 transition-colors ${active ? "text-zinc-700" : ""}`}
      >
        {label}
        <Icon size={11} className={active ? "" : "opacity-40"} />
      </button>
    </th>
  )
}
