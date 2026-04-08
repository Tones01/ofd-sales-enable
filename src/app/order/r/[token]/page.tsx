import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import TokenOrderForm from "./TokenOrderForm"

export const dynamic = "force-dynamic"

export default async function TokenOrderPage({ params }: { params: { token: string } }) {
  const supabase = createClient()

  // Look up the placeholder row by token (deal_id IS NULL = invite/send-list row)
  const { data: invite } = await supabase
    .from("sheet_retailers")
    .select("id, sheet_id, retailer_id, retailer_name, retailers(id, name)")
    .eq("order_token", params.token)
    .is("deal_id", null)
    .single()

  if (!invite) notFound()

  const { data: sheet } = await supabase
    .from("sheets")
    .select("id, name, ship_date, status")
    .eq("id", invite.sheet_id)
    .eq("status", "sent")
    .single()

  if (!sheet) notFound()

  const { data: sheetDeals } = await supabase
    .from("sheet_deals")
    .select("id, deal_id, visible_qty, deals(lp_name, brand, product_name, format, sku, thc, minor_cannabinoids, units_per_case, list_price, sale_price)")
    .eq("sheet_id", sheet.id)

  const retailerName = (invite.retailers as any)?.name ?? invite.retailer_name ?? ""
  const retailerId = invite.retailer_id ?? null

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-3xl mx-auto px-6 py-12">

        <div className="mb-8">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-widest mb-2">Open Fields</p>
          <h1 className="font-serif text-3xl text-zinc-900 mb-2">{sheet.name}</h1>
          <div className="flex items-center gap-4 text-sm text-zinc-500">
            <span>Ships with your next available order</span>
            {(sheet as any).ship_date && (
              <>
                <span className="text-zinc-200">·</span>
                <span className="font-medium text-zinc-700">Target ship date: {(sheet as any).ship_date}</span>
              </>
            )}
          </div>
        </div>

        <TokenOrderForm
          sheet={sheet}
          sheetDeals={sheetDeals ?? []}
          retailerId={retailerId}
          retailerName={retailerName}
        />
      </div>
    </div>
  )
}
