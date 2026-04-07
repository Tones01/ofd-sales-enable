"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  )
}

export default function NewPromotionPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    partner_name: "",
    lp_name: "",
    mechanism_description: "",
    start_date: "",
    end_date: "",
    units_sold: "0",
    notes: "",
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { error } = await supabase.from("promotions").insert({
      partner_name: form.partner_name,
      lp_name: form.lp_name,
      mechanism_description: form.mechanism_description,
      start_date: form.start_date,
      end_date: form.end_date || null,
      units_sold: parseInt(form.units_sold, 10) || 0,
      notes: form.notes || null,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      window.location.href = "/promotions"
    }
  }

  return (
    <div className="px-8 py-8 max-w-xl mx-auto">
      <Link href="/promotions" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to promotions
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-8">New promotion</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Partner name" required>
            <input className={input} value={form.partner_name} onChange={e => set("partner_name", e.target.value)} placeholder="e.g. BudNked" required />
          </Field>
          <Field label="LP name" required>
            <input className={input} value={form.lp_name} onChange={e => set("lp_name", e.target.value)} placeholder="e.g. Cannaba" required />
          </Field>
        </div>

        <Field label="Mechanism description" required>
          <textarea
            className={`${input} resize-none`}
            rows={3}
            value={form.mechanism_description}
            onChange={e => set("mechanism_description", e.target.value)}
            placeholder="e.g. $1/unit co-promo on all 3.5g SKUs — credit applied monthly"
            required
          />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="Start date" required>
            <input className={input} type="date" value={form.start_date} onChange={e => set("start_date", e.target.value)} required />
          </Field>
          <Field label="End date">
            <input className={input} type="date" value={form.end_date} onChange={e => set("end_date", e.target.value)} />
          </Field>
        </div>

        <Field label="Units sold">
          <input className={input} type="number" min="0" value={form.units_sold} onChange={e => set("units_sold", e.target.value)} placeholder="0" />
        </Field>

        <Field label="Notes">
          <textarea
            className={`${input} resize-none`}
            rows={3}
            value={form.notes}
            onChange={e => set("notes", e.target.value)}
            placeholder="Reconciliation details, contacts, campaign IDs…"
          />
        </Field>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {loading ? "Creating…" : "Create promotion"}
          </button>
          <Link href="/promotions" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}
