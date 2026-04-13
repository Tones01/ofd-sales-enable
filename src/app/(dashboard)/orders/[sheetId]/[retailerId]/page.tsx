import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import OrderReview from "./OrderReview"

export const dynamic = "force-dynamic"

export default async function OrderReviewPage({
  params,
}: {
  params: { sheetId: string; retailerId: string }
}) {
  const supabase = createClient()

  const [{ data: sheet }, { data: orderLines }] = await Promise.all([
    supabase
      .from("sheets")
      .select("id, name, ship_date, status, profiles(full_name)")
      .eq("id", params.sheetId)
      .single(),
    supabase
      .from("sheet_retailers")
      .select(
        "id, alloc_qty, status, requested_ship_date, retailer_notes, responded_at, retailer_name, " +
        "retailers(name), " +
        "deals(id, lp_name, brand, product_name, sku, format, thc, units_per_case, list_price, sale_price)"
      )
      .eq("sheet_id", params.sheetId)
      .eq("retailer_id", params.retailerId)
      .not("deal_id", "is", null)
      .order("created_at", { ascending: true }),
  ])

  if (!sheet || !orderLines?.length) notFound()

  const first = orderLines[0] as any
  const retailerName = first.retailers?.name ?? first.retailer_name ?? "Unknown store"

  return (
    <div className="px-8 py-8 max-w-4xl mx-auto">
      <Link
        href={`/sheets/${params.sheetId}`}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to {sheet.name}
      </Link>

      <OrderReview
        sheetId={params.sheetId}
        retailerId={params.retailerId}
        sheet={sheet}
        retailerName={retailerName}
        orderLines={orderLines}
      />
    </div>
  )
}
