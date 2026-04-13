import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import SheetOrdersTable from "./SheetOrdersTable"

export const dynamic = "force-dynamic"

export default async function SheetOrdersPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: sheet }, { data: orderLines }] = await Promise.all([
    supabase
      .from("sheets")
      .select("id, name, ship_date, status, profiles(full_name)")
      .eq("id", params.id)
      .single(),
    supabase
      .from("sheet_retailers")
      .select(
        "id, alloc_qty, status, requested_ship_date, retailer_notes, retailer_name, retailer_id, " +
        "retailers(id, name, city, province), " +
        "deals(id, lp_name, brand, product_name, sku, format, thc, units_per_case, list_price, sale_price)"
      )
      .eq("sheet_id", params.id)
      .not("deal_id", "is", null)
      .order("retailer_name", { ascending: true }),
  ])

  if (!sheet) notFound()

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <Link
        href={`/sheets/${params.id}`}
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to sheet
      </Link>

      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">{sheet.name}</h1>
          <p className="text-sm text-zinc-400 mt-1">
            {(sheet.profiles as any)?.full_name ?? ""}
            {(sheet as any).ship_date
              ? ` · Ships ${(sheet as any).ship_date}`
              : " · No ship date set"}
          </p>
        </div>
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium self-start ${
          sheet.status === "sent" ? "bg-blue-50 text-blue-700" : "bg-zinc-100 text-zinc-500"
        }`}>
          {sheet.status}
        </span>
      </div>

      <SheetOrdersTable sheet={sheet} orderLines={orderLines ?? []} />
    </div>
  )
}
