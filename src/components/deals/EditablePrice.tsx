"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"

export default function EditablePrice({
  dealId,
  field,
  value,
}: {
  dealId: string
  field: "list_price" | "sale_price"
  value: number | null
}) {
  const [editing, setEditing]   = useState(false)
  const [raw, setRaw]           = useState(value != null ? String(value) : "")
  const [current, setCurrent]   = useState(value)
  const [saving, setSaving]     = useState(false)

  async function save() {
    const trimmed = raw.trim().replace(/^\$/, "")
    const num = trimmed === "" ? null : parseFloat(trimmed)

    if (num !== null && (isNaN(num) || num < 0)) {
      setRaw(current != null ? String(current) : "")
      setEditing(false)
      return
    }
    if (num === current) { setEditing(false); return }

    setSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("deals")
      .update({ [field]: num })
      .eq("id", dealId)
    if (!error) setCurrent(num)
    setSaving(false)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="number"
        step="0.01"
        min="0"
        value={raw}
        onChange={e => setRaw(e.target.value)}
        onBlur={save}
        onKeyDown={e => {
          if (e.key === "Enter")  save()
          if (e.key === "Escape") { setRaw(current != null ? String(current) : ""); setEditing(false) }
        }}
        autoFocus
        disabled={saving}
        placeholder="0.00"
        className="w-20 text-right px-2 py-0.5 text-sm border border-zinc-400 rounded focus:outline-none focus:ring-1 focus:ring-zinc-900 tabular-nums bg-white"
      />
    )
  }

  return (
    <button
      onClick={() => { setRaw(current != null ? String(current) : ""); setEditing(true) }}
      title={`Click to edit ${field === "list_price" ? "regular" : "sale"} price`}
      className={`tabular-nums hover:underline cursor-pointer transition-colors ${
        field === "sale_price" && current != null
          ? "text-emerald-600 font-medium hover:text-emerald-700"
          : "text-zinc-500 hover:text-zinc-900"
      }`}
    >
      {current != null ? `$${Number(current).toFixed(2)}` : <span className="text-zinc-300">—</span>}
    </button>
  )
}
