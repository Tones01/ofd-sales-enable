import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"
import SheetsTable, {
  PAGE_SIZE,
  SORTABLE_COLUMNS,
  type SheetsQuery,
  type SortKey,
} from "@/components/sheets/SheetsTable"

export const dynamic = "force-dynamic"

const STATUSES = ["draft", "sent", "archived"] as const
type Status = (typeof STATUSES)[number]

function parseQuery(searchParams: Record<string, string | string[] | undefined>): SheetsQuery {
  const get = (k: string) => {
    const v = searchParams[k]
    return Array.isArray(v) ? v[0] : v
  }

  const rawSort = get("sort")
  const sort: SortKey = (SORTABLE_COLUMNS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as SortKey)
    : "created_at"

  const dir: "asc" | "desc" = get("dir") === "asc" ? "asc" : "desc"
  const rawStatus = get("status")
  const status: SheetsQuery["status"] = (STATUSES as readonly string[]).includes(rawStatus ?? "")
    ? (rawStatus as Status)
    : "all"
  const pageNum = Math.max(1, parseInt(get("page") ?? "1", 10) || 1)

  return {
    q: (get("q") ?? "").trim(),
    status,
    sort,
    dir,
    page: pageNum,
  }
}

function escapeForOr(value: string) {
  return value.replace(/[,()*]/g, " ").trim()
}

export default async function SheetsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const params = parseQuery(searchParams)

  let query = supabase
    .from("sheets")
    .select(
      `
      *,
      profiles ( full_name ),
      sheet_retailers ( id, status, alloc_qty )
    `,
      { count: "exact" }
    )

  if (params.status !== "all") {
    query = query.eq("status", params.status)
  }
  if (params.q) {
    const safe = escapeForOr(params.q)
    if (safe) {
      query = query.ilike("name", `%${safe}%`)
    }
  }

  const from = (params.page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const { data: sheets, count } = await query
    .order(params.sort, { ascending: params.dir === "asc" })
    .range(from, to)

  const total = count ?? 0

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Sheets</h1>
          <p className="text-sm text-zinc-400 mt-1">{total} total</p>
        </div>
        <Link
          href="/sheets/new"
          className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} />
          New sheet
        </Link>
      </div>

      <SheetsTable sheets={sheets ?? []} total={total} query={params} />
    </div>
  )
}
