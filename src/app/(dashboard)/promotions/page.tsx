import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"

export default async function PromotionsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: promos }, { data: profile }] = await Promise.all([
    supabase.from("promotions").select("*").order("start_date", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
  ])

  const isAdmin = profile?.role === "admin"
  const today = new Date().toISOString().split("T")[0]

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Promotions</h1>
          <p className="text-sm text-zinc-400 mt-1">Portfolio promos — reconciled end of month</p>
        </div>
        {isAdmin && (
          <Link
            href="/promotions/new"
            className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
          >
            <Plus size={14} />
            New promo
          </Link>
        )}
      </div>

      <div className="grid gap-4">
        {promos?.map(promo => {
          const isActive = (!promo.end_date || promo.end_date >= today) && promo.start_date <= today
          return (
            <div key={promo.id} className="bg-white border border-zinc-100 rounded-xl px-6 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium text-zinc-900">
                      {promo.partner_name} × {promo.lp_name}
                    </h3>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      isActive ? "bg-emerald-50 text-emerald-700" : "bg-zinc-100 text-zinc-400"
                    }`}>
                      {isActive ? "active" : "ended"}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-500 mb-3">{promo.mechanism_description}</p>
                  {promo.notes && (
                    <p className="text-xs text-zinc-400 leading-relaxed">{promo.notes}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-2xl font-semibold text-zinc-900 tracking-tight">
                    {promo.units_sold.toLocaleString()}
                  </p>
                  <p className="text-xs text-zinc-400">units sold</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-zinc-50 flex items-center gap-4 text-xs text-zinc-400">
                <span>{promo.start_date} → {promo.end_date ?? "ongoing"}</span>
              </div>
            </div>
          )
        })}
      </div>

      {(!promos || promos.length === 0) && (
        <div className="text-center py-16 bg-white border border-zinc-100 rounded-xl">
          <p className="text-sm text-zinc-400">No promotions yet.</p>
          {isAdmin && (
            <Link href="/promotions/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
              Create the first promo
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
