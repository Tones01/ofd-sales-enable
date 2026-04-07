import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Package, FileText, Store, TrendingUp } from "lucide-react"

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
  ] = await Promise.all([
    supabase.from("deal_availability").select("*"),
    supabase.from("sheets")
      .select("id, name, status, ship_date, created_at, profiles(full_name)")
      .neq("status", "archived")
      .order("ship_date", { ascending: true }),
    supabase.from("retailers").select("id").eq("status", "active"),
    supabase.from("rep_stats").select("*"),
  ])

  const activeDeals = deals?.filter(d => d.status === "active") ?? []
  const totalAvailable = activeDeals.reduce((sum, d) => sum + d.qty_available, 0)
  const sentSheets = sheets?.filter(s => s.status === "sent") ?? []
  const totalUnitsOut = activeDeals.reduce((sum, d) => sum + d.qty_accepted + d.qty_fulfilled, 0)

  // Sheets shipping this week (sent + ship_date within 7 days, or no date)
  const shippingThisWeek = sentSheets.filter(s =>
    !(s as any).ship_date || (s as any).ship_date <= in7Days
  )
  // Upcoming: sent + ship_date > 7 days away
  const upcoming = sentSheets.filter(s =>
    (s as any).ship_date && (s as any).ship_date > in7Days
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

      {/* Shipping sections */}
      <div className="space-y-6 mb-10">

        {/* Shipping this week */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Shipping this week</h2>
          {shippingThisWeek.length === 0 ? (
            <div className="bg-white border border-zinc-100 rounded-xl px-5 py-6 text-sm text-zinc-400">No sheets shipping this week.</div>
          ) : (
            <div className="space-y-2">
              {shippingThisWeek.map(s => (
                <SheetCard key={s.id} sheet={s} highlight />
              ))}
            </div>
          )}
        </section>

        {/* Upcoming */}
        {upcoming.length > 0 && (
          <section>
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Upcoming</h2>
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

function SheetCard({ sheet, highlight = false }: { sheet: any; highlight?: boolean }) {
  const shipDate = (sheet as any).ship_date
  return (
    <Link href={`/sheets/${sheet.id}`} className={`flex items-center justify-between px-5 py-4 rounded-xl border transition-colors hover:shadow-sm ${
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
