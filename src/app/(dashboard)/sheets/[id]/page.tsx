import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SheetActions from "@/components/sheets/SheetActions"

export const dynamic = "force-dynamic"

const STATUS_STYLES: Record<string, string> = {
  pending:   "bg-amber-50 text-amber-700",
  accepted:  "bg-emerald-50 text-emerald-700",
  rejected:  "bg-red-50 text-red-500",
  fulfilled: "bg-blue-50 text-blue-700",
}

export default async function SheetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const { data: sheet } = await supabase
    .from("sheets")
    .select(`*, profiles ( full_name )`)
    .eq("id", params.id)
    .single()

  if (!sheet) notFound()

  const [{ data: sheetDeals }, { data: retailers }] = await Promise.all([
    supabase
      .from("sheet_deals")
      .select(`*, deals ( lp_name, product_name, sku, qty_total )`)
      .eq("sheet_id", params.id),
    supabase
      .from("sheet_retailers")
      .select(`*, deals ( product_name, sku )`)
      .eq("sheet_id", params.id)
      .order("created_at"),
  ])

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link href="/sheets" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-6">
        <ArrowLeft size={14} />
        Back to sheets
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl text-zinc-900">{sheet.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              sheet.status === "draft" ? "bg-zinc-100 text-zinc-500" :
              sheet.status === "sent"  ? "bg-blue-50 text-blue-700" :
              "bg-zinc-50 text-zinc-400"
            }`}>
              {sheet.status}
            </span>
          </div>
          <p className="text-sm text-zinc-400 mt-1">
            Created by {(sheet.profiles as any)?.full_name ?? "—"}
          </p>
        </div>
        <SheetActions sheet={sheet} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Deals on this sheet */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Deals</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {sheetDeals?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Product</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Visible qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {sheetDeals.map(sd => (
                    <tr key={sd.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{(sd.deals as any)?.product_name}</p>
                        <p className="text-xs text-zinc-400">{(sd.deals as any)?.sku}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600 font-medium">{sd.visible_qty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-400 p-5">No deals added yet.</p>
            )}
          </div>
        </section>

        {/* Retailer allocations */}
        <section>
          <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Retailer responses</h2>
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            {retailers?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-100">
                    <th className="text-left text-xs text-zinc-400 font-medium px-4 py-3">Retailer</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-4 py-3">Qty</th>
                    <th className="text-center text-xs text-zinc-400 font-medium px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {retailers.map(r => (
                    <tr key={r.id}>
                      <td className="px-4 py-3">
                        <p className="font-medium text-zinc-900">{r.retailer_name}</p>
                        <p className="text-xs text-zinc-400">{(r.deals as any)?.product_name}</p>
                      </td>
                      <td className="px-4 py-3 text-right text-zinc-600">{r.alloc_qty}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status]}`}>
                          {r.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-zinc-400 p-5">No retailer allocations yet.</p>
            )}
          </div>
        </section>

      </div>
    </div>
  )
}
