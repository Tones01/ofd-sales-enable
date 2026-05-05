import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"
import ExportDealsButton from "@/components/deals/ExportDealsButton"
import DealsTable, {
  type DealsQuery,
  PAGE_SIZE,
  SORTABLE_COLUMNS,
  type SortKey,
} from "@/components/deals/DealsTable"

export const dynamic = "force-dynamic"

function parseQuery(searchParams: Record<string, string | string[] | undefined>): DealsQuery {
  const get = (k: string) => {
    const v = searchParams[k]
    return Array.isArray(v) ? v[0] : v
  }

  const rawSort = get("sort")
  const sort: SortKey = (SORTABLE_COLUMNS as readonly string[]).includes(rawSort ?? "")
    ? (rawSort as SortKey)
    : "created_at"

  const dir: "asc" | "desc" = get("dir") === "asc" ? "asc" : "desc"
  const status = get("status")
  const pageNum = Math.max(1, parseInt(get("page") ?? "1", 10) || 1)

  return {
    q: (get("q") ?? "").trim(),
    status: status === "active" || status === "closed" ? status : "all",
    showSoldOut: get("sold_out") === "1",
    sort,
    dir,
    page: pageNum,
  }
}

function escapeForOr(value: string) {
  // PostgREST `or=` uses commas as separators and parens for grouping.
  // ilike values can't contain those raw, so strip them defensively.
  return value.replace(/[,()*]/g, " ").trim()
}

export default async function DealsPage({
  searchParams,
}: {
  searchParams: Record<string, string | string[] | undefined>
}) {
  const supabase = createClient()
  const params = parseQuery(searchParams)

  // Best-effort: flip any deals that crossed their expiry into 'closed'
  // before we read the list. Idempotent and cheap (indexed).
  await supabase.rpc("expire_old_deals")

  const [{ data: { user } }] = await Promise.all([supabase.auth.getUser()])

  let query = supabase
    .from("deal_availability")
    .select("*", { count: "exact" })

  if (params.status !== "all") {
    query = query.eq("status", params.status)
  }
  if (!params.showSoldOut) {
    query = query.gt("qty_available", 0)
  }
  if (params.q) {
    const safe = escapeForOr(params.q)
    if (safe) {
      const pattern = `%${safe}%`
      query = query.or(
        `product_name.ilike.${pattern},lp_name.ilike.${pattern},brand.ilike.${pattern},sku.ilike.${pattern}`
      )
    }
  }

  const from = (params.page - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const [{ data: deals, count }, { data: profile }] = await Promise.all([
    query.order(params.sort, { ascending: params.dir === "asc" }).range(from, to),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").maybeSingle(),
  ])

  const isAdmin = profile?.role === "admin"
  const today = new Date().toISOString().slice(0, 10)
  const total = count ?? 0

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Deals</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {total} LP {total === 1 ? "deal" : "deals"} — quantities in units
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDealsButton />
          {isAdmin && (
            <Link
              href="/deals/new"
              className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Plus size={14} />
              New deal
            </Link>
          )}
        </div>
      </div>

      <DealsTable
        deals={deals ?? []}
        total={total}
        query={params}
        isAdmin={isAdmin}
        today={today}
      />
    </div>
  )
}
