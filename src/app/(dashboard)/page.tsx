import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Package, FileText, Store, TrendingUp, PackageCheck } from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700 border-amber-200",
  accepted:  "bg-emerald-50 text-emerald-700 border-emerald-200",
  rejected:  "bg-red-50 text-red-500 border-red-200",
  fulfilled: "bg-blue-50 text-blue-700 border-blue-200",
}

type OrderGroup = {
  sheetId: string
  retailerId: string | null
  retailerName: string
  sheet: any
  lines: Array<{ product_name: string; lp_name: string; alloc_qty: number; lineValue: number }>
  totalUnits: number
  totalValue: number
  status: string
}

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { data: deals },
    { data: sheets },
    { data: retailers },
    { data: repStats },
    { data: orderLinesRaw },
  ] = await Promise.all([
    supabase.from("deal_availability").select("*"),
    supabase.from("sheets")
      .select("id, name, status, ship_date, created_at, profiles(full_name)")
      .neq("status", "archived")
      .order("ship_date", { ascending: true }),
    supabase.from("retailers").select("id").eq("status", "active"),
    supabase.from("rep_stats").select("*"),
    // All active order lines (pending / accepted / fulfilled) with deal + retailer + sheet info
    supabase.from("sheet_retailers")
      .select("sheet_id, retailer_id, retailer_name, alloc_qty, status, retailers(name), deals(product_name, lp_name, sale_price, list_price), sheets(id, name, ship_date, status)")
      .in("status", ["pending", "accepted", "fulfilled"])
      .not("deal_id", "is", null)
      .order("created_at", { ascending: true }),
  ])

  const activeDeals = deals?.filter(d => d.status === "active") ?? []
  const totalAvailable = activeDeals.reduce((sum, d) => sum + d.qty_available, 0)
  const sentSheets = sheets?.filter(s => s.status === "sent") ?? []
  const totalUnitsOut = activeDeals.reduce((sum, d) => sum + d.qty_accepted + d.qty_fulfilled, 0)

  // Group order lines into retailer order cards (one card per retailer per sheet)
  const groupMap = new Map<string, OrderGroup>()
  for (const row of (orderLinesRaw ?? [])) {
    const sheet = row.sheets as any
    if (sheet?.status !== "sent") continue
    // Use retailer_id if present; fall back to retailer_name for generic-form orders
    const key = row.retailer_id
      ? `${row.sheet_id}-${row.retailer_id}`
      : `${row.sheet_id}-name:${row.retailer_name ?? "unknown"}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        sheetId: row.sheet_id,
        retailerId: row.retailer_id ?? null,
        retailerName: (row.retailers as any)?.name ?? row.retailer_name ?? "Unknown store",
        sheet,
        lines: [],
        totalUnits: 0,
        totalValue: 0,
        status: row.status,
      })
    }
    const g = groupMap.get(key)!
    const price = (row.deals as any)?.sale_price ?? (row.deals as any)?.list_price ?? 0
    const lineValue = row.alloc_qty * Number(price)
    g.lines.push({
      product_name: (row.deals as any)?.product_name ?? "—",
      lp_name: (row.deals as any)?.lp_name ?? "",
      alloc_qty: row.alloc_qty,
      lineValue,
    })
    g.totalUnits += row.alloc_qty
    g.totalValue += lineValue
    // Escalate status: fulfilled > accepted > pending
    if (g.status === "pending" && (row.status === "accepted" || row.status === "fulfilled")) g.status = row.status
    if (g.status === "accepted" && row.status === "fulfilled") g.status = row.status
  }
  const allOrderGroups = Array.from(groupMap.values())

  // Active orders (pending + accepted) sorted by ship date — shown on dashboard
  const activeOrders = allOrderGroups
    .filter(g => g.status !== "fulfilled")
    .sort((a, b) => {
      if (!a.sheet?.ship_date) return -1
      if (!b.sheet?.ship_date) return 1
      return a.sheet.ship_date.localeCompare(b.sheet.ship_date)
    })
  const completedOrders = allOrderGroups.filter(g => g.status === "fulfilled")

  // Pending orders banner — ALL pending (not just this week)
  const pendingOrders = allOrderGroups.filter(g => g.status === "pending").slice(0, 10)

  // Pipeline stats
  const pendingGroups  = allOrderGroups.filter(g => g.status === "pending")
  const acceptedGroups = allOrderGroups.filter(g => g.status === "accepted")
  const fulfilledGroups = allOrderGroups.filter(g => g.status === "fulfilled")
  const pendingUnits   = pendingGroups.reduce((s, g) => s + g.totalUnits, 0)
  const acceptedUnits  = acceptedGroups.reduce((s, g) => s + g.totalUnits, 0)
  const fulfilledUnits = fulfilledGroups.reduce((s, g) => s + g.totalUnits, 0)
  const pendingValue   = pendingGroups.reduce((s, g) => s + g.totalValue, 0)
  const acceptedValue  = acceptedGroups.reduce((s, g) => s + g.totalValue, 0)
  const fulfilledValue = fulfilledGroups.reduce((s, g) => s + g.totalValue, 0)

  function fmt$(n: number) {
    return `$${Math.round(n).toLocaleString("en-CA")}`
  }
  const totalCapacity  = activeDeals.reduce((s, d) => s + d.qty_total, 0)
  const totalCommitted = pendingUnits + acceptedUnits + fulfilledUnits
  const fillPct = totalCapacity > 0 ? Math.round((totalCommitted / totalCapacity) * 100) : 0

  // Sent sheets with no orders yet (informational)
  const sheetsNoOrders = sentSheets.filter(s => !allOrderGroups.find(g => g.sheetId === s.id))
  // Draft sheets
  const draftSheets = sheets?.filter(s => s.status === "draft") ?? []

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Sales overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon={Package} label="Units available" value={totalAvailable.toLocaleString()} />
        <StatCard icon={FileText} label="Sheets out" value={sentSheets.length.toString()} sub="awaiting retailer response" />
        <StatCard icon={Store} label="Active retailers" value={(retailers?.length ?? 0).toString()} />
        <StatCard icon={TrendingUp} label="Units committed" value={totalUnitsOut.toLocaleString()} sub="accepted + fulfilled" />
      </div>

      {/* Pipeline bar */}
      {allOrderGroups.length > 0 && (
        <div className="bg-white border border-zinc-100 rounded-xl px-6 py-5 mb-8">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Pipeline</p>
            <p className="text-xs text-zinc-400">
              {totalCommitted.toLocaleString()} / {totalCapacity.toLocaleString()} units committed
              {fillPct >= 100 && <span className="ml-2 text-emerald-600 font-semibold">· Fully committed!</span>}
            </p>
          </div>
          <div className="w-full bg-zinc-100 rounded-full h-2 mb-4 overflow-hidden">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(fillPct, 100)}%`, background: fillPct >= 100 ? "#059669" : fillPct >= 75 ? "#10b981" : "#34d399" }}
            />
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xl font-bold text-amber-600 tabular-nums">{pendingGroups.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{pendingUnits.toLocaleString()} units · Pending</p>
              {pendingValue > 0 && <p className="text-xs font-medium text-amber-600 mt-0.5">{fmt$(pendingValue)}</p>}
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600 tabular-nums">{acceptedGroups.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{acceptedUnits.toLocaleString()} units · Accepted</p>
              {acceptedValue > 0 && <p className="text-xs font-medium text-emerald-600 mt-0.5">{fmt$(acceptedValue)}</p>}
            </div>
            <div>
              <p className="text-xl font-bold text-blue-600 tabular-nums">{fulfilledGroups.length}</p>
              <p className="text-xs text-zinc-400 mt-0.5">{fulfilledUnits.toLocaleString()} units · Fulfilled</p>
              {fulfilledValue > 0 && <p className="text-xs font-medium text-blue-600 mt-0.5">{fmt$(fulfilledValue)}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Pending order reviews banner */}
      {pendingOrders.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100">
            <h2 className="text-xs font-medium text-amber-700 uppercase tracking-wider">
              {pendingOrders.length} order{pendingOrders.length > 1 ? "s" : ""} awaiting your review
            </h2>
          </div>
          <div className="divide-y divide-amber-50">
            {pendingOrders.map(g => {
              const href = g.retailerId ? `/orders/${g.sheetId}/${g.retailerId}` : `/sheets/${g.sheetId}`
              return (
                <Link
                  key={`${g.sheetId}-${g.retailerId ?? g.retailerName}`}
                  href={href}
                  className="flex items-center justify-between px-5 py-3 hover:bg-amber-100/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">{g.retailerName}</p>
                    <p className="text-xs text-zinc-500">{g.sheet?.name}{g.sheet?.ship_date ? ` · Ships ${g.sheet.ship_date}` : ""} · {g.totalUnits} units</p>
                  </div>
                  <span className="text-xs text-amber-600 font-medium">Review →</span>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Order sections */}
      <div className="space-y-6 mb-10">

        {/* All active orders */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Active orders</h2>
          {activeOrders.length === 0 ? (
            <div className="bg-white border border-zinc-100 rounded-xl px-5 py-6 text-sm text-zinc-400">No active orders. Send a sheet to start receiving orders.</div>
          ) : (
            <div className="space-y-3">
              {activeOrders.map(g => (
                <OrderCard key={`${g.sheetId}-${g.retailerId ?? g.retailerName}`} group={g} />
              ))}
            </div>
          )}
        </section>

        {/* Completed orders */}
        {completedOrders.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Fulfilled</h2>
            <div className="space-y-3 opacity-70">
              {completedOrders.map(g => (
                <OrderCard key={`${g.sheetId}-${g.retailerId ?? g.retailerName}`} group={g} />
              ))}
            </div>
          </section>
        )}

        {/* Sent sheets with no orders yet */}
        {sheetsNoOrders.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Sheets out — awaiting responses</h2>
            <div className="space-y-2">
              {sheetsNoOrders.map(s => (
                <SheetCard key={s.id} sheet={s} />
              ))}
            </div>
          </section>
        )}

        {/* Drafts */}
        {draftSheets.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">In progress</h2>
            <div className="space-y-2">
              {draftSheets.map(s => (
                <SheetCard key={s.id} sheet={s} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Live deal inventory */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Deal inventory</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {activeDeals.length === 0 ? (
              <p className="text-sm text-zinc-400 p-6">No active deals.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Product</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Total</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Available</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {activeDeals.map(d => (
                    <tr key={d.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-zinc-900 font-medium truncate max-w-[180px]">{d.product_name}</p>
                        <p className="text-xs text-zinc-400">{d.lp_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-500">{d.qty_total.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${d.qty_available <= 0 ? "text-red-500" : d.qty_available < d.qty_total * 0.2 ? "text-amber-500" : "text-emerald-600"}`}>
                          {d.qty_available.toLocaleString()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        {/* Rep performance */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Rep performance</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {!repStats?.length ? (
              <p className="text-sm text-zinc-400 p-6">No rep data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 bg-zinc-50/50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Rep</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Units</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Acc. rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {repStats.map(r => (
                    <tr key={r.rep_id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-zinc-900 font-medium">{r.full_name ?? "—"}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{(r.units_accepted + r.units_fulfilled).toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-zinc-900">
                        {r.acceptance_rate_pct != null ? `${r.acceptance_rate_pct}%` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

function OrderCard({ group }: { group: OrderGroup }) {
  const { sheetId, retailerId, retailerName, sheet, lines, totalUnits, totalValue, status } = group
  const href = retailerId ? `/orders/${sheetId}/${retailerId}` : `/sheets/${sheetId}`
  return (
    <Link
      href={href}
      className="block px-5 py-4 rounded-xl border bg-white border-zinc-100 transition-colors hover:border-zinc-200 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{retailerName}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {sheet?.name}{sheet?.ship_date ? ` · Ships ${sheet.ship_date}` : ""}
            {!retailerId && <span className="ml-2 text-zinc-300">· Direct submission</span>}
          </p>
          <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1">
            {lines.map((line, i) => (
              <span key={i} className="text-xs text-zinc-500">
                <span className="font-medium text-zinc-700">{line.alloc_qty}</span> × {line.product_name}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-zinc-100 text-zinc-500 border-zinc-200"}`}>
            {status === "fulfilled" && <PackageCheck size={11} className="mr-1" />}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
          {totalValue > 0
            ? <p className="text-sm font-semibold text-zinc-900 tabular-nums">${Math.round(totalValue).toLocaleString("en-CA")}</p>
            : null}
          <p className="text-xs text-zinc-400 tabular-nums">{totalUnits} unit{totalUnits !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </Link>
  )
}

function SheetCard({ sheet }: { sheet: any }) {
  const shipDate = (sheet as any).ship_date
  return (
    <Link href={`/sheets/${sheet.id}`} className="flex items-center justify-between px-5 py-4 rounded-xl border bg-white border-zinc-100 transition-colors hover:border-zinc-200 hover:shadow-sm">
      <div>
        <p className="font-medium text-zinc-900 text-sm">{sheet.name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {(sheet.profiles as any)?.full_name ?? ""}
          {shipDate ? ` · Ships ${shipDate}` : " · No ship date set"}
        </p>
      </div>
      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
        sheet.status === "draft" ? "bg-zinc-100 text-zinc-500" :
        sheet.status === "sent"  ? "bg-blue-50 text-blue-700" :
        "bg-zinc-50 text-zinc-400"
      }`}>
        {sheet.status}
      </span>
    </Link>
  )
}

function StatCard({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white border border-zinc-100 rounded-xl px-5 py-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-zinc-400" strokeWidth={1.5} />
        <span className="text-xs text-zinc-400 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-semibold text-zinc-900 tracking-tight">{value}</p>
      {sub && <p className="text-xs text-zinc-400 mt-0.5">{sub}</p>}
    </div>
  )
}
