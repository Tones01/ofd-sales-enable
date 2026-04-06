import { createClient } from "@/lib/supabase/server"
import { Package, FileText, Store, TrendingUp } from "lucide-react"

export default async function DashboardPage() {
  const supabase = createClient()

  const [
    { data: deals },
    { data: sheets },
    { data: retailers },
    { data: repStats },
    { data: lpStats },
  ] = await Promise.all([
    supabase.from("deal_availability").select("*"),
    supabase.from("sheets").select("*").neq("status", "archived"),
    supabase.from("retailers").select("id").eq("status", "active"),
    supabase.from("rep_stats").select("*"),
    supabase.from("lp_deal_stats").select("*"),
  ])

  const activeDeals = deals?.filter(d => d.status === "active") ?? []
  const totalAvailable = activeDeals.reduce((sum, d) => sum + d.qty_available, 0)
  const pendingSheets = sheets?.filter(s => s.status === "sent").length ?? 0
  const totalUnitsOut = activeDeals.reduce((sum, d) => sum + d.qty_accepted + d.qty_fulfilled, 0)

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-zinc-900">Dashboard</h1>
        <p className="text-sm text-zinc-400 mt-1">Weekly sales overview</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <StatCard icon={Package} label="Units available" value={totalAvailable.toLocaleString()} />
        <StatCard icon={FileText} label="Active sheets" value={pendingSheets.toString()} sub="awaiting response" />
        <StatCard icon={Store} label="Active retailers" value={(retailers?.length ?? 0).toString()} />
        <StatCard icon={TrendingUp} label="Units committed" value={totalUnitsOut.toLocaleString()} sub="accepted + fulfilled" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Live deal inventory */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
            Deal inventory
          </h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {activeDeals.length === 0 ? (
              <p className="text-sm text-zinc-400 p-6">No active deals.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
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
                        <p className="text-xs text-zinc-400">{d.lp_name} · {d.sku}</p>
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
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
            Rep performance
          </h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {!repStats?.length ? (
              <p className="text-sm text-zinc-400 p-6">No rep data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
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

        {/* LP sell-through */}
        <section className="lg:col-span-2">
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">
            LP sell-through
          </h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {!lpStats?.length ? (
              <p className="text-sm text-zinc-400 p-6">No data yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">LP</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Total units</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Reserved</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Accepted</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Fulfilled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {lpStats.map(lp => (
                    <tr key={lp.lp_name} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-4 py-3 text-zinc-900 font-medium">{lp.lp_name}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{lp.units_total?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{lp.units_reserved?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right text-zinc-500">{lp.units_accepted?.toLocaleString()}</td>
                      <td className="px-4 py-3 text-right font-medium text-emerald-600">{lp.units_fulfilled?.toLocaleString()}</td>
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
