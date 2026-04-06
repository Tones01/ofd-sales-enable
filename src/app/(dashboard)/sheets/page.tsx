import { createClient } from "@/lib/supabase/server"
import Link from "next/link"
import { Plus } from "lucide-react"

const STATUS_STYLES: Record<string, string> = {
  draft: "bg-zinc-100 text-zinc-500",
  sent: "bg-blue-50 text-blue-700",
  archived: "bg-zinc-50 text-zinc-400",
}

export default async function SheetsPage() {
  const supabase = createClient()

  const { data: sheets } = await supabase
    .from("sheets")
    .select(`
      *,
      profiles ( full_name ),
      sheet_retailers ( id, status, alloc_qty )
    `)
    .order("created_at", { ascending: false })

  return (
    <div className="px-8 py-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-2xl text-zinc-900">Sheets</h1>
          <p className="text-sm text-zinc-400 mt-1">{sheets?.length ?? 0} total</p>
        </div>
        <Link
          href="/sheets/new"
          className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 transition-colors"
        >
          <Plus size={14} />
          New sheet
        </Link>
      </div>

      <div className="bg-white border border-zinc-100 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100">
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5">Sheet</th>
              <th className="text-left text-xs text-zinc-400 font-medium px-5 py-3.5 hidden md:table-cell">Rep</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Retailers</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5 hidden lg:table-cell">Units out</th>
              <th className="text-center text-xs text-zinc-400 font-medium px-5 py-3.5">Status</th>
              <th className="text-right text-xs text-zinc-400 font-medium px-5 py-3.5">Date</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {sheets?.map(sheet => {
              const retailers = (sheet.sheet_retailers as any[]) ?? []
              const unitsOut = retailers.filter(r => ["accepted","fulfilled"].includes(r.status)).reduce((s: number, r: any) => s + r.alloc_qty, 0)
              const pending = retailers.filter(r => r.status === "pending").length

              return (
                <tr key={sheet.id} className="hover:bg-zinc-50 transition-colors">
                  <td className="px-5 py-4">
                    <Link href={`/sheets/${sheet.id}`} className="font-medium text-zinc-900 hover:underline underline-offset-2">
                      {sheet.name}
                    </Link>
                    {pending > 0 && (
                      <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs bg-amber-50 text-amber-600">
                        {pending} pending
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-zinc-500 hidden md:table-cell">
                    {(sheet.profiles as any)?.full_name ?? "—"}
                  </td>
                  <td className="px-5 py-4 text-center text-zinc-500">{retailers.length}</td>
                  <td className="px-5 py-4 text-right text-zinc-500 hidden lg:table-cell">{unitsOut.toLocaleString()}</td>
                  <td className="px-5 py-4 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[sheet.status] ?? ""}`}>
                      {sheet.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right text-zinc-400 text-xs">
                    {new Date(sheet.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric" })}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        {(!sheets || sheets.length === 0) && (
          <div className="text-center py-16">
            <p className="text-sm text-zinc-400">No sheets yet.</p>
            <Link href="/sheets/new" className="mt-3 inline-block text-sm text-zinc-900 underline underline-offset-2">
              Build the first sheet
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
