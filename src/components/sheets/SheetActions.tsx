"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Send, Archive } from "lucide-react"

export default function SheetActions({ sheet }: { sheet: any }) {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function sendSheet() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.rpc("reserve_inventory", { p_sheet_id: sheet.id })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.reload()
    }
  }

  async function archiveSheet() {
    setLoading(true)
    const { error } = await supabase.from("sheets").update({ status: "archived" }).eq("id", sheet.id)
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.reload()
    }
  }

  if (sheet.status === "archived") return null

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex gap-2">
        {sheet.status === "draft" && (
          <button
            onClick={sendSheet}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <Send size={14} />
            {loading ? "Sending…" : "Send sheet"}
          </button>
        )}
        <button
          onClick={archiveSheet}
          disabled={loading}
          className="flex items-center gap-2 text-sm text-zinc-500 px-4 py-2 rounded-lg hover:bg-zinc-100 disabled:opacity-50 transition-colors"
        >
          <Archive size={14} />
          Archive
        </button>
      </div>
      {error && (
        <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2 max-w-xs text-right">
          {error}
        </p>
      )}
    </div>
  )
}
