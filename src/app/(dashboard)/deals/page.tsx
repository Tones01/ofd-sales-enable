import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"
import ExportDealsButton from "@/components/deals/ExportDealsButton"
import DealsTable from "@/components/deals/DealsTable"

export const dynamic = "force-dynamic"

export default async function DealsPage() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  const [{ data: deals }, { data: profile }] = await Promise.all([
    supabase.from("deal_availability").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("role").eq("id", user?.id ?? "").single(),
  ])

  const isAdmin = profile?.role === "admin"
  const today = new Date().toISOString().slice(0, 10)

  return (
    <div className="px-8 py-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Deals</h1>
          <p className="text-sm text-zinc-400 mt-1">{deals?.length ?? 0} LP deals — quantities in units</p>
        </div>
        <div className="flex items-center gap-2">
          <ExportDealsButton />
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
      </div>

      <DealsTable deals={deals ?? []} isAdmin={isAdmin} today={today} />
    </div>
  )
}
