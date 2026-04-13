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
  retailerId: string
  retailerName: string
  sheet: any
  lines: Array<{ product_name: string; lp_name: string; alloc_qty: number }>
  totalUnits: number
  status: string
}

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  const supabase = createClient()

  const today = new Date().toISOString().slice(0, 10)
  const in7Days = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

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
      .select("sheet_id, retailer_id, retailer_name, alloc_qty, status, retailers(name), deals(product_name, lp_name), sheets(id, name, ship_date, status)")
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
    const key = `${row.sheet_id}-${row.retailer_id}`
    if (!groupMap.has(key)) {
      groupMap.set(key, {
        sheetId: row.sheet_id,
        retailerId: row.retailer_id,
        retailerName: (row.retailers as any)?.name ?? row.retailer_name ?? "Unknown store",
        sheet,
        lines: [],
        totalUnits: 0,
        status: row.status,
      })
    }
    const g = groupMap.get(key)!
    g.lines.push({
      product_name: (row.deals as any)?.product_name ?? "—",
      lp_name: (row.deals as any)?.lp_name ?? "",
      alloc_qty: row.alloc_qty,
    })
    g.totalUnits += row.alloc_qty
    // Escalate status: fulfilled > accepted > pending
    if (g.status === "pending" && (row.status === "accepted" || row.status === "fulfilled")) g.status = row.status
    if (g.status === "accepted" && row.status === "fulfilled") g.status = row.status
  }
  const allOrderGroups = Array.from(groupMap.values())

  // Split into this-week vs upcoming
  const ordersThisWeek = allOrderGroups.filter(g =>
    !g.sheet?.ship_date || g.sheet.ship_date <= in7Days
  )
  const ordersUpcoming = allOrderGroups.filter(g =>
    g.sheet?.ship_date && g.sheet.ship_date > in7Days
  )

  // Pending orders (subset of ordersThisWeek, for the amber banner)
  const pendingOrders = ordersThisWeek.filter(g => g.status === "pending").slice(0, 10)

  // Upcoming sheets (sent, no orders yet, ship > 7 days) — show as sheet cards
  const upcoming = sentSheets.filter(s =>
    (s as any).ship_date && (s as any).ship_date > in7Days &&
    !ordersUpcoming.find(g => g.sheetId === s.id)
  )
  // Draft sheets
  const draftSheets = sheets?.filter(s => s.status === "draft") ?? []

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Sales overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard icon={Package} label="Units available" value={totalAvailable.toLocaleString()} />
        <StatCard icon={FileText} label="Sheets out" value={sentSheets.length.toString()} sub="awaiting retailer response" />
        <StatCard icon={Store} label="Active retailers" value={(retailers?.length ?? 0).toString()} />
        <StatCard icon={TrendingUp} label="Units committed" value={totalUnitsOut.toLocaleString()} sub="accepted + fulfilled" />
      </div>

      {/* Pending order reviews banner */}
      {pendingOrders.length > 0 && (
        <div className="mb-8 bg-amber-50 border border-amber-100 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-100">
            <h2 className="text-xs font-medium text-amber-700 uppercase tracking-wider">
              {pendingOrders.length} order{pendingOrders.length > 1 ? "s" : ""} awaiting your review
            </h2>
          </div>
          <div className="divide-y divide-amber-50">
            {pendingOrders.map(g => (
              <Link
                key={`${g.sheetId}-${g.retailerId}`}
                href={`/orders/${g.sheetId}/${g.retailerId}`}
                className="flex items-center justify-between px-5 py-3 hover:bg-amber-100/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-900">{g.retailerName}</p>
                  <p className="text-xs text-zinc-500">{g.sheet?.name}{g.sheet?.ship_date ? ` · Ships ${g.sheet.ship_date}` : ""} · {g.totalUnits} units</p>
                </div>
                <span className="text-xs text-amber-600 font-medium">Review →</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Order sections */}
      <div className="space-y-6 mb-10">

        {/* Orders this week */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Orders this week</h2>
          {ordersThisWeek.length === 0 ? (
            <div className="bg-white border border-zinc-100 rounded-xl px-5 py-6 text-sm text-zinc-400">No orders received yet for this period.</div>
          ) : (
            <div className="space-y-3">
              {ordersThisWeek.map(g => (
                <OrderCard key={`${g.sheetId}-${g.retailerId}`} group={g} highlight />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming orders */}
        {ordersUpcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Upcoming orders</h2>
            <div className="space-y-3">
              {ordersUpcoming.map(g => (
                <OrderCard key={`${g.sheetId}-${g.retailerId}`} group={g} />
              ))}
            </div>
          </section>
        )}

        {/* Upcoming sheets (sent, no orders yet) */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Sheets out — no orders yet</h2>
            <div className="space-y-2">
              {upcoming.map(s => (
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

function OrderCard({ group, highlight = false }: { group: OrderGroup; highlight?: boolean }) {
  const { sheetId, retailerId, retailerName, sheet, lines, totalUnits, status } = group
  return (
    <Link
      href={`/orders/${sheetId}/${retailerId}`}
      className={`block px-5 py-4 rounded-xl border transition-colors hover:shadow-sm ${
        highlight ? "bg-white border-zinc-200" : "bg-white border-zinc-100"
      }`}
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{retailerName}</p>
          <p className="text-xs text-zinc-400 mt-0.5">
            {sheet?.name}{sheet?.ship_date ? ` · Ships ${sheet.ship_date}` : ""}
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
          <p className="text-xs text-zinc-400 tabular-nums">{totalUnits} unit{totalUnits !== 1 ? "s" : ""}</p>
        </div>
      </div>
    </Link>
  )
}

function SheetCard({ sheet, highlight = false, ordersView = false }: { sheet: any; highlight?: boolean; ordersView?: boolean }) {
  const shipDate = (sheet as any).ship_date
  const href = ordersView ? `/sheets/${sheet.id}/orders` : `/sheets/${sheet.id}`
  return (
    <Link href={href} className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-colors hover:shadow-sm ${
      highlight ? "bg-white border-zinc-200" : "bg-white border-zinc-100"
    }`}>
      <div>
        <p className="font-medium text-zinc-900 text-sm">{sheet.name}</p>
        <p className="text-xs text-zinc-400 mt-0.5">
          {(sheet.profiles as any)?.full_name ?? ""}
          {shipDate ? ` · Ships ${shipDate}` : " · No ship date set"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {ordersView && (
          <span className="text-xs text-zinc-400">View orders →</span>
        )}
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          sheet.status === "draft" ? "bg-zinc-100 text-zinc-500" :
          sheet.status === "sent"  ? "bg-blue-50 text-blue-700" :
          "bg-zinc-50 text-zinc-400"
        }`}>
          {sheet.status}
        </span>
      </div>
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
