import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function RetailersPage() {
  const supabase = createClient()

  const [{ data: retailers }, { data: stats }] = await Promise.all([
    supabase.from("retailers").select("*, profiles ( full_name )").order("name"),
    supabase.from("retailer_stats").select("*"),
  ])

  const statsMap = Object.fromEntries((stats ?? []).map(s => [s.id, s]))

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Retailers</h1>
          <p className="text-sm text-zinc-400 mt-1">{retailers?.length ?? 0} accounts</p>
        </div>
        <Link
          href="/retailers/new"
          className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} />
          Add retailer
        </Link>
      </div>

      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Retailer</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden md:table-cell">Location</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Rep</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Units</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Acc. rate</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {retailers?.map(r => {
              const s = statsMap[r.id]
              return (
                <tr key={r.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/retailers/${r.id}`} className="font-medium text-zinc-900 hover:underline underline-offset-2">
                      {r.name}
                    </Link>
                    {r.license_number && (
                      <p className="text-xs text-zinc-400 mt-0.5">{r.license_number}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 hidden md:table-cell">
                    {[r.city, r.province].filter(Boolean).join(", ") || "—"}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 hidden lg:table-cell">
                    {(r.profiles as any)?.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-500">
                    {s ? (s.units_committed + s.units_fulfilled).toLocaleString() : "—"}
                  </td>
                  <td className="px-5 py-4 text-right font-medium text-zinc-900 hidden lg:table-cell">
                    {s?.acceptance_rate_pct != null ? `${s.acceptance_rate_pct}%` : "—"}
                  </td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      r.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {r.status}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(!retailers || retailers.length === 0) && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400">No retailers yet.</p>
            <Link href="/retailers/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
              Add the first retailer
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
