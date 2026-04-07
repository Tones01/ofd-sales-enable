import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus, Pencil } from "lucide-react"

export default async function DealsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: deals }, { data: profile }] = await Promise.all([
    supabase.from("deal_availability").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
  ])

  const isAdmin = profile?.role === "admin"

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Deals</h1>
          <p className="text-sm text-zinc-400 mt-1">{deals?.length ?? 0} LP deals — quantities shown in cases</p>
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
            <tr className="border-b border-zinc-100 bg-zinc-50/50">
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Product</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Format</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden xl:table-cell">THC</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 hidden xl:table-cell">Reg. $</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 hidden xl:table-cell">Sale $</th>
              {/* Quantity columns — all in cases */}
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">
                <span title="Total cases in this deal">Total</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">
                <span title="Cases currently on active sheets (pending retailer response)">On sheets</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">
                <span title="Cases accepted by retailers">Accepted</span>
              </th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">
                <span title="Cases not yet allocated to any sheet">Free</span>
              </th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Expiry</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Status</th>
              {isAdmin && <th className="px-5 py-3.5" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {deals?.map(deal => (
              <tr key={deal.id} className="hover:bg-zinc-50/60 transition-colors group">
                <td className="px-5 py-4">
                  <p className="font-medium text-zinc-900">{deal.product_name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    {(deal as any).brand ? `${(deal as any).brand} · ` : ""}{deal.lp_name} · {deal.sku}
                  </p>
                </td>
                <td className="px-5 py-4 text-zinc-500 text-sm hidden lg:table-cell">{(deal as any).format ?? "—"}</td>
                <td className="px-5 py-4 text-zinc-500 text-sm hidden xl:table-cell">{(deal as any).thc ?? "—"}</td>
                <td className="px-5 py-4 text-right text-zinc-500 hidden xl:table-cell">
                  {(deal as any).list_price != null ? `$${Number((deal as any).list_price).toFixed(2)}` : "—"}
                </td>
                <td className="px-5 py-4 text-right hidden xl:table-cell">
                  {(deal as any).sale_price != null
                    ? <span className="text-emerald-600 font-medium">${Number((deal as any).sale_price).toFixed(2)}</span>
                    : <span className="text-zinc-400">—</span>}
                </td>
                <td className="px-5 py-4 text-right text-zinc-500 tabular-nums">{deal.qty_total.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-zinc-500 tabular-nums">{deal.qty_reserved.toLocaleString()}</td>
                <td className="px-5 py-4 text-right text-zinc-500 tabular-nums">{deal.qty_accepted.toLocaleString()}</td>
                <td className="px-5 py-4 text-right tabular-nums">
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
                <td className="px-5 py-4 text-center text-xs text-zinc-400">
                  {(deal as any).deal_expiry ?? "—"}
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
                {isAdmin && (
                  <td className="px-4 py-4 text-right">
                    <Link
                      href={`/deals/${deal.id}/edit`}
                      className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-900 opacity-0 group-hover:opacity-100 transition-all px-2.5 py-1.5 rounded-md hover:bg-zinc-100"
                    >
                      <Pencil size={12} />
                      Edit
                    </Link>
                  </td>
                )}
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
