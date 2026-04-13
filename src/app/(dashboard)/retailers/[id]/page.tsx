import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Mail, Phone, MapPin, User } from "lucide-react"

export const dynamic = "force-dynamic"

export default async function RetailerAccountPage({ params }: { params: { id: string } }) {
  const supabase = createClient()

  const [{ data: retailer }, { data: stats }, { data: history }] = await Promise.all([
    supabase.from("retailers").select("*, profiles(full_name)").eq("id", params.id).single(),
    supabase.from("retailer_stats").select("*").eq("id", params.id).single(),
    supabase.from("retailer_purchase_history").select("*").eq("retailer_id", params.id),
  ])

  if (!retailer) notFound()

  const unitsCommitted = (stats?.units_committed ?? 0) + (stats?.units_fulfilled ?? 0)
  const lastOrder = stats?.last_response_at
    ? new Date(stats.last_response_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", year: "numeric" })
    : null

  return (
    <div className="px-8 py-8 max-w-5xl mx-auto">
      <Link
        href="/retailers"
        className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-6"
      >
        <ArrowLeft size={14} />
        Back to retailers
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-serif text-2xl text-zinc-900">{retailer.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
              retailer.status === "active"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-zinc-100 text-zinc-400"
            }`}>
              {retailer.status}
            </span>
          </div>
          {retailer.license_number && (
            <p className="text-sm text-zinc-400 mt-1">Licence {retailer.license_number}</p>
          )}
        </div>
        <Link
          href={`/retailers/${params.id}/edit`}
          className="text-sm text-zinc-500 border border-zinc-200 px-3 py-1.5 rounded-lg hover:bg-zinc-50 transition-colors"
        >
          Edit
        </Link>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Units Committed", value: unitsCommitted.toLocaleString() },
          { label: "Units Fulfilled", value: (stats?.units_fulfilled ?? 0).toLocaleString() },
          {
            label: "Acceptance Rate",
            value: stats?.acceptance_rate_pct != null ? `${stats.acceptance_rate_pct}%` : "—",
          },
          { label: "Last Order", value: lastOrder ?? "—" },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white border border-zinc-100 rounded-xl px-4 py-3.5">
            <p className="text-xs text-zinc-400 mb-1">{label}</p>
            <p className="text-lg font-semibold text-zinc-900 leading-none">{value}</p>
          </div>
        ))}
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left — Contact info */}
        <div className="space-y-4">
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-4">Contact</h2>
            <dl className="space-y-3 text-sm">
              {retailer.contact_name && (
                <div className="flex items-start gap-2.5">
                  <User size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                  <span className="text-zinc-700">{retailer.contact_name}</span>
                </div>
              )}
              {retailer.contact_email && (
                <div className="flex items-start gap-2.5">
                  <Mail size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                  <a
                    href={`mailto:${retailer.contact_email}`}
                    className="text-zinc-700 hover:underline underline-offset-2 break-all"
                  >
                    {retailer.contact_email}
                  </a>
                </div>
              )}
              {retailer.contact_phone && (
                <div className="flex items-start gap-2.5">
                  <Phone size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                  <a
                    href={`tel:${retailer.contact_phone}`}
                    className="text-zinc-700 hover:underline underline-offset-2"
                  >
                    {retailer.contact_phone}
                  </a>
                </div>
              )}
              {(retailer.address || retailer.city || retailer.province) && (
                <div className="flex items-start gap-2.5">
                  <MapPin size={14} className="text-zinc-300 mt-0.5 shrink-0" />
                  <div className="text-zinc-700">
                    {retailer.address && <p>{retailer.address}</p>}
                    <p>
                      {[retailer.city, retailer.province, retailer.postal_code]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                </div>
              )}
              {!retailer.contact_name && !retailer.contact_email && !retailer.contact_phone && !retailer.city && (
                <p className="text-zinc-400">No contact info on file.</p>
              )}
            </dl>
          </div>

          {/* Account rep + notes */}
          <div className="bg-white border border-zinc-100 rounded-xl p-5">
            <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Account Rep</h2>
            <p className="text-sm text-zinc-700">
              {(retailer.profiles as any)?.full_name ?? <span className="text-zinc-400">Unassigned</span>}
            </p>
          </div>

          {retailer.notes && (
            <div className="bg-white border border-zinc-100 rounded-xl p-5">
              <h2 className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-3">Notes</h2>
              <p className="text-sm text-zinc-700 whitespace-pre-wrap">{retailer.notes}</p>
            </div>
          )}
        </div>

        {/* Right — Order history */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-zinc-50">
              <h2 className="text-sm font-medium text-zinc-900">Order History</h2>
              <p className="text-xs text-zinc-400 mt-0.5">Accepted and fulfilled orders</p>
            </div>

            {history && history.length > 0 ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-50">
                    <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3">Product</th>
                    <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3 hidden md:table-cell">Sheet</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3">Qty</th>
                    <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3">Status</th>
                    <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3 hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-50">
                  {history.map((row: any) => (
                    <tr key={row.allocation_id} className="hover:bg-zinc-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-zinc-900 leading-snug">{row.product_name}</p>
                        <p className="text-xs text-zinc-400">{row.lp_name}</p>
                      </td>
                      <td className="px-5 py-3.5 text-zinc-500 hidden md:table-cell">
                        <Link
                          href={`/sheets/${row.sheet_id}`}
                          className="hover:underline underline-offset-2"
                        >
                          {row.sheet_name}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-right text-zinc-700 font-medium">
                        {row.alloc_qty?.toLocaleString()}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          row.status === "fulfilled"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-blue-50 text-blue-700"
                        }`}>
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right text-zinc-400 text-xs hidden sm:table-cell">
                        {row.responded_at
                          ? new Date(row.responded_at).toLocaleDateString("en-CA", {
                              month: "short",
                              day: "numeric",
                            })
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-14">
                <p className="text-sm text-zinc-400">No orders yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
