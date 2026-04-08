import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { headers } from "next/headers"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SheetBuilder from "@/components/sheets/SheetBuilder"

export const dynamic = "force-dynamic"

export default async function SheetDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const headersList = headers()
  const host = headersList.get("host") ?? "localhost:3000"
  const protocol = host.startsWith("localhost") ? "http" : "https"
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${protocol}://${host}`

  const [{ data: sheet }, { data: allDeals }, { data: allRetailers }] = await Promise.all([
    supabase.from("sheets").select("*, profiles(full_name)").eq("id", params.id).single(),
    supabase.from("deal_availability").select("*").eq("status", "active").order("lp_name"),
    supabase.from("retailers").select("id, name, city, province, contact_name, contact_email").eq("status", "active").order("name"),
  ])

  if (!sheet) notFound()

  const [{ data: sheetDeals }, { data: sheetRetailers }] = await Promise.all([
    supabase.from("sheet_deals").select("*, deals(lp_name, brand, product_name, sku, format, thc, list_price, sale_price, units_per_case)").eq("sheet_id", params.id),
    // Fetch everything: placeholder rows (deal_id IS NULL) + order lines (deal_id IS NOT NULL)
    supabase.from("sheet_retailers")
      .select("id, retailer_id, retailer_name, deal_id, alloc_qty, status, requested_ship_date, retailer_notes, order_token, responded_at, retailers(id, name), deals(lp_name, brand, product_name, sku, format, thc, list_price, sale_price, units_per_case)")
      .eq("sheet_id", params.id)
      .order("created_at", { ascending: true }),
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
            Rep: {(sheet.profiles as any)?.full_name ?? "—"}
            {(sheet as any).ship_date && (
              <span className="ml-3">· Ships {(sheet as any).ship_date}</span>
            )}
          </p>
        </div>
      </div>

      <SheetBuilder
        sheet={sheet}
        allDeals={allDeals ?? []}
        allRetailers={allRetailers ?? []}
        sheetDeals={sheetDeals ?? []}
        sheetRetailers={sheetRetailers ?? []}
        siteUrl={siteUrl}
      />
    </div>
  )
}
