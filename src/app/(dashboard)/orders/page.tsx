import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export const dynamic = "force-dynamic"

type OrderLine = {
  id: string
  alloc_qty: number
  status: string
  requested_ship_date: string | null
  retailer_id: string | null
  retailer_name: string | null
  sheet_id: string
  retailers: { id: string; name: string } | null
  deals: { product_name: string; lp_name: string; sale_price: number | null; list_price: number | null } | null
  sheets: { id: string; name: string; ship_date: string | null } | null
}

type OrderGroup = {
  key: string
  sheetId: string
  retailerId: string | null
  retailerName: string
  sheetName: string
  shipDate: string | null
  products: string[]
  totalUnits: number
  totalValue: number
  status: string
}

function buildGroups(rows: OrderLine[]): OrderGroup[] {
  const map = new Map<string, OrderGroup>()

  for (const row of rows) {
    const key = row.retailer_id
      ? `${row.sheet_id}-${row.retailer_id}`
      : `${row.sheet_id}-name:${row.retailer_name ?? "unknown"}`

    if (!map.has(key)) {
      const retailerName =
        (row.retailers as any)?.name ?? row.retailer_name ?? "Unknown store"
      map.set(key, {
        key,
        sheetId: row.sheet_id,
        retailerId: row.retailer_id,
        retailerName,
        sheetName: (row.sheets as any)?.name ?? "—",
        shipDate: (row.sheets as any)?.ship_date ?? row.requested_ship_date,
        products: [],
        totalUnits: 0,
        totalValue: 0,
        status: row.status,
      })
    }

    const group = map.get(key)!
    const productLabel = (row.deals as any)?.product_name ?? "Unknown product"
    if (!group.products.includes(productLabel)) {
      group.products.push(productLabel)
    }
    group.totalUnits += row.alloc_qty ?? 0
    const price = (row.deals as any)?.sale_price ?? (row.deals as any)?.list_price ?? 0
    group.totalValue += (row.alloc_qty ?? 0) * Number(price)
  }

  return Array.from(map.values())
}

function formatDate(d: string | null) {
  if (!d) return "—"
  return new Date(d).toLocaleDateString("en-CA", { month: "short", day: "numeric" })
}

function StatusBadge({ status }: { status: string }) {
  const styles =
    status === "pending"
      ? "bg-amber-50 text-amber-700"
      : status === "accepted"
      ? "bg-blue-50 text-blue-700"
      : status === "fulfilled"
      ? "bg-emerald-50 text-emerald-700"
      : "bg-zinc-100 text-zinc-400"
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles}`}>
      {status}
    </span>
  )
}

function GroupTable({ groups, emptyLabel }: { groups: OrderGroup[]; emptyLabel: string }) {
  if (groups.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-sm text-zinc-400">{emptyLabel}</p>
      </div>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-zinc-50">
          <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3">Retailer</th>
          <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3 hidden md:table-cell">Sheet</th>
          <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3 hidden lg:table-cell">Products</th>
          <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3">Units</th>
          <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3 hidden sm:table-cell">Value</th>
          <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3 hidden sm:table-cell">Ships</th>
          <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3"></th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-50">
        {groups.map((g) => {
          const productSummary =
            g.products.length <= 2
              ? g.products.join(", ")
              : `${g.products.slice(0, 2).join(", ")} +${g.products.length - 2} more`

          const reviewHref = g.retailerId
            ? `/orders/${g.sheetId}/${g.retailerId}`
            : `/sheets/${g.sheetId}`

          return (
            <tr key={g.key} className="hover:bg-zinc-50 transition-colors">
              <td className="px-5 py-3.5">
                {g.retailerId ? (
                  <Link
                    href={`/retailers/${g.retailerId}`}
                    className="font-medium text-zinc-900 hover:underline underline-offset-2"
                  >
                    {g.retailerName}
                  </Link>
                ) : (
                  <span className="font-medium text-zinc-900">{g.retailerName}</span>
                )}
              </td>
              <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">
                <Link
                  href={`/sheets/${g.sheetId}`}
                  className="hover:underline underline-offset-2"
                >
                  {g.sheetName}
                </Link>
              </td>
              <td className="px-5 py-3.5 text-zinc-500 hidden lg:table-cell max-w-xs truncate">
                {productSummary}
              </td>
              <td className="px-5 py-3.5 text-right font-medium text-zinc-900">
                {g.totalUnits.toLocaleString()}
              </td>
              <td className="px-5 py-3.5 text-right font-medium text-zinc-900 hidden sm:table-cell">
                {g.totalValue > 0 ? `$${Math.round(g.totalValue).toLocaleString("en-CA")}` : <span className="text-zinc-300 font-normal">—</span>}
              </td>
              <td className="px-5 py-3.5 text-right text-zinc-400 hidden sm:table-cell">
                {formatDate(g.shipDate)}
              </td>
              <td className="px-5 py-3.5 text-right">
                <Link
                  href={reviewHref}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 hover:text-zinc-900 transition-colors"
                >
                  Review <ArrowRight size={12} />
                </Link>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

export default async function OrdersPage() {
  const supabase = createClient()

  const { data: rows } = await supabase
    .from("sheet_retailers")
    .select(
      "id, alloc_qty, status, requested_ship_date, retailer_id, retailer_name, sheet_id, " +
        "retailers(id, name), deals(product_name, lp_name, sale_price, list_price), sheets(id, name, ship_date)"
    )
    .not("deal_id", "is", null)
    .order("requested_ship_date", { ascending: true, nullsFirst: false })

  const allGroups = buildGroups((rows ?? []) as unknown as OrderLine[])

  const pending = allGroups.filter((g) => g.status === "pending")
  const accepted = allGroups.filter((g) => g.status === "accepted")
  const fulfilled = allGroups.filter((g) => g.status === "fulfilled")

  const sections = [
    { label: "Pending Review", groups: pending, empty: "No orders pending review." },
    { label: "Accepted", groups: accepted, empty: "No accepted orders." },
    { label: "Fulfilled", groups: fulfilled, empty: "No fulfilled orders." },
  ]

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="font-serif text-2xl text-zinc-900">Orders</h1>
        <span className="text-sm text-zinc-400">{allGroups.length} total</span>
      </div>

      <div className="space-y-8">
        {sections.map(({ label, groups, empty }) => (
          <div key={label}>
            <div className="flex items-center gap-2 mb-3">
              <h2 className="text-sm font-medium text-zinc-900">{label}</h2>
              <span className="text-xs text-zinc-400 bg-zinc-100 px-2 py-0.5 rounded-full">
                {groups.length}
              </span>
            </div>
            <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
              <GroupTable groups={groups} emptyLabel={empty} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
