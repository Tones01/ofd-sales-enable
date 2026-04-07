import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import OrderForm from "./OrderForm"

export const dynamic = "force-dynamic"

export default async function PublicOrderPage({ params }: { params: { sheetId: string } }) {
  const supabase = createClient()

  const { data: sheet } = await supabase
    .from("sheets")
    .select("id, name, ship_date, status")
    .eq("id", params.sheetId)
    .eq("status", "sent")        // only sent sheets are publicly accessible
    .single()

  if (!sheet) notFound()

  const { data: sheetDeals } = await supabase
    .from("sheet_deals")
    .select("id, visible_qty, deals(id, lp_name, brand, product_name, format, sku, thc, minor_cannabinoids, units_per_case, list_price, sale_price)")
    .eq("sheet_id", params.sheetId)

  const { data: retailers } = await supabase
    .from("sheet_retailers")
    .select("id, retailer_id, retailers(id, name)")
    .eq("sheet_id", params.sheetId)

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">Open Fields</p>
          <h1 className="font-serif text-3xl text-zinc-900 mb-2">{sheet.name}</h1>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>Ships with your next available order</span>
            {sheet.ship_date && (
              <>
                <span className="text-zinc-200">·</span>
                <span className="font-medium text-zinc-700">Target ship date: {sheet.ship_date}</span>
              </>
            )}
          </div>
        </div>

        <OrderForm
          sheet={sheet}
          sheetDeals={sheetDeals ?? []}
          retailers={retailers ?? []}
        />
      </div>
    </div>
  )
}
