"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function EditableQty({ dealId, value }: { dealId: string; value: number }) {
  const [editing, setEditing] = useState(false)
  const [qty, setQty] = useState(String(value))
  const [saving, setSaving] = useState(false)
  const [current, setCurrent] = useState(value)

  async function save() {
    const num = parseInt(qty, 10)
    if (isNaN(num) || num < 0) { setQty(String(current)); setEditing(false); return }
    if (num === current) { setEditing(false); return }
    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase.from("deals").update({ qty_total: num }).eq("id", dealId)
    if (!error) setCurrent(num)
    setSaving(false)
    setEditing(false)
    // Trigger a soft reload so qty_available recalculates
    window.location.reload()
  }

  if (editing) {
    return (
      <input
        type="number"
        min="1"
        value={qty}
        onChange={e => setQty(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === "Enter") save()
          if (e.key === "Escape") { setQty(String(current)); setEditing(false) }
        }}
        autoFocus
        disabled={saving}
        className="w-20 text-right px-2 py-0.5 text-sm border border-zinc-400 rounded focus:outline-none focus:ring-1 focus:ring-zinc-900 tabular-nums bg-white"
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      title="Click to edit total quantity"
      className="tabular-nums hover:underline hover:text-zinc-900 cursor-pointer transition-colors"
    >
      {current.toLocaleString()}
    </button>
  )
}
