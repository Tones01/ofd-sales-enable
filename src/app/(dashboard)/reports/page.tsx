import { createClient } from "@/lib/supabase/server"

export default async function ReportsPage() {
  const supabase = createClient()

  const [{ data: repStats }, { data: retailerStats }, { data: lpStats }] = await Promise.all([
    supabase.from("rep_stats").select("*").order("units_fulfilled", { ascending: false }),
    supabase.from("retailer_stats").select("*").order("units_fulfilled", { ascending: false }),
    supabase.from("lp_deal_stats").select("*").order("units_fulfilled", { ascending: false }),
  ])

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-2xl text-zinc-900">Reports</h1>
        <p className="text-sm text-zinc-400 mt-1">Live stats from the database</p>
      </div>

      <div className="space-y-8">

        {/* Rep leaderboard */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Rep performance</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Rep</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Sheets sent</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Pending</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Accepted</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Fulfilled</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Units out</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Acc. rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {repStats?.map(r => (
                  <tr key={r.rep_id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-zinc-900">{r.full_name ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{r.sheets_sent}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{r.allocations_pending}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{r.allocations_accepted}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{r.allocations_fulfilled}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-zinc-900">{(r.units_accepted + r.units_fulfilled).toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                      {r.acceptance_rate_pct != null ? `${r.acceptance_rate_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!repStats?.length && <p className="text-sm text-zinc-400 p-6">No data yet.</p>}
          </div>
        </section>

        {/* LP sell-through */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">LP sell-through</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">LP</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Total</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Reserved</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Accepted</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Fulfilled</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Rejected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {lpStats?.map(lp => (
                  <tr key={lp.lp_name} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-zinc-900">{lp.lp_name}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{lp.units_total?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{lp.units_reserved?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{lp.units_accepted?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-emerald-600">{lp.units_fulfilled?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-400">{lp.units_rejected?.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!lpStats?.length && <p className="text-sm text-zinc-400 p-6">No data yet.</p>}
          </div>
        </section>

        {/* Top retailers */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Top retailers</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100">
                  <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Retailer</th>
                  <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Location</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Units committed</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Fulfilled</th>
                  <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Acc. rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {retailerStats?.map(r => (
                  <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-zinc-900">{r.name}</td>
                    <td className="px-5 py-3.5 text-zinc-500">{[r.city, r.province].filter(Boolean).join(", ") || "—"}</td>
                    <td className="px-5 py-3.5 text-right text-zinc-500">{r.units_committed?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-medium text-emerald-600">{r.units_fulfilled?.toLocaleString()}</td>
                    <td className="px-5 py-3.5 text-right font-semibold text-zinc-900">
                      {r.acceptance_rate_pct != null ? `${r.acceptance_rate_pct}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!retailerStats?.length && <p className="text-sm text-zinc-400 p-6">No data yet.</p>}
          </div>
        </section>

      </div>
    </div>
  )
}
