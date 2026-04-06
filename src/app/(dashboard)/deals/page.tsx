import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function DealsPage() {
  const supabase = createClient()

  const [{ data: deals }, { data: profile }] = await Promise.all([
    supabase.from("deal_availability").select("*").order("created_at", { ascending: false }),
    supabase.auth.getUser().then(({ data: { user } }) =>
      supabase.from("profiles").select("role").eq("id", user?.id ?? "").single()
    ),
  ])

  const isAdmin = profile?.data?.role === "admin"

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Deals</h1>
          <p className="text-sm text-zinc-400 mt-1">{deals?.length ?? 0} active LP deals</p>
        </div>
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

      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Product</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Credit</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Total</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Reserved</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Accepted</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Available</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {deals?.map(deal => (
              <tr key={deal.id} className="hover:bg-zinc-50 transition-colors group">
                <td className="px-5 py-4">
                  <p className="font-medium text-zinc-900">{deal.product_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{deal.lp_name} · {deal.sku}</p>
                </td>
                <td className="px-5 py-4 text-zinc-500 hidden lg:table-cell max-w-[220px]">
                  <span className="line-clamp-1">{deal.credit_description}</span>
                </td>
                <td className="px-5 py-4 text-right text-zinc-500">{deal.qty_total.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-zinc-500">{deal.qty_reserved.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-zinc-500">{deal.qty_accepted.toLocaleString()}</td>
                <td className="px-5 py-4 text-right">
                  <span className={`font-semibold ${
                    deal.qty_available <= 0
                      ? "text-red-500"
                      : deal.qty_available < deal.qty_total * 0.15
                      ? "text-amber-500"
                      : "text-emerald-600"
                  }`}>
                    {deal.qty_available.toLocaleString()}
                  </span>
                </td>
                <td className="px-5 py-4 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    deal.status === "active"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-zinc-100 text-zinc-500"
                  }`}>
                    {deal.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {(!deals || deals.length === 0) && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400">No deals yet.</p>
            {isAdmin && (
              <Link href="/deals/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
                Create the first deal
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
