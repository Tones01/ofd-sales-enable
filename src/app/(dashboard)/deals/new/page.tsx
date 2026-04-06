"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function NewDealPage() {
  const router = useRouter()
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [form, setForm] = useState({
    lp_name: "",
    product_name: "",
    sku: "",
    credit_description: "",
    qty_total: "",
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const { error } = await supabase.from("deals").insert({
      lp_name: form.lp_name,
      product_name: form.product_name,
      sku: form.sku,
      credit_description: form.credit_description,
      qty_total: parseInt(form.qty_total, 10),
      status: "active",
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push("/deals")
      router.refresh()
    }
  }

  return (
    <div className="px-8 py-8 max-w-xl mx-auto">
      <Link href="/deals" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to deals
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-8">New deal</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <Field label="LP name" required>
          <input className={input} value={form.lp_name} onChange={e => set("lp_name", e.target.value)} placeholder="e.g. Auxly Cannabis" required />
        </Field>

        <Field label="Product name" required>
          <input className={input} value={form.product_name} onChange={e => set("product_name", e.target.value)} placeholder="e.g. Kolab Project 28g Indica" required />
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field label="SKU" required>
            <input className={input} value={form.sku} onChange={e => set("sku", e.target.value)} placeholder="e.g. AUX-KLP-28-IND" required />
          </Field>
          <Field label="Total units" required>
            <input className={input} type="number" min="1" value={form.qty_total} onChange={e => set("qty_total", e.target.value)} placeholder="500" required />
          </Field>
        </div>

        <Field label="Credit / markdown description" required>
          <textarea
            className={`${input} resize-none`}
            rows={3}
            value={form.credit_description}
            onChange={e => set("credit_description", e.target.value)}
            placeholder="e.g. $2.00/unit markdown on 90-day aged inventory"
            required
          />
        </Field>

        {error && (
          <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>
        )}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {loading ? "Creating…" : "Create deal"}
          </button>
          <Link href="/deals" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  )
}

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
