"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

const input = "w-full px-3.5 py-2.5 text-sm bg-white border border-zinc-200 rounded-lg text-zinc-900 placeholder:text-zinc-300 focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent transition"

const PROVINCES = ["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]

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

export default function NewRetailerPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: "", license_number: "", address: "", city: "",
    province: "", postal_code: "",
    contact_name: "", contact_email: "", contact_phone: "", notes: "",
  })

  function set(field: keyof typeof form, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.from("retailers").insert({
      name:           form.name,
      license_number: form.license_number || null,
      address:        form.address || null,
      city:           form.city || null,
      province:       form.province || null,
      postal_code:    form.postal_code || null,
      contact_name:   form.contact_name || null,
      contact_email:  form.contact_email || null,
      contact_phone:  form.contact_phone || null,
      notes:          form.notes || null,
      status:         "active",
    })
    if (error) { setError(error.message); setLoading(false) }
    else { window.location.href = "/retailers" }
  }

  return (
    <div className="px-8 py-8 max-w-2xl mx-auto">
      <Link href="/retailers" className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-zinc-900 transition-colors mb-8">
        <ArrowLeft size={14} />
        Back to retailers
      </Link>

      <h1 className="font-serif text-2xl text-zinc-900 mb-6">Add retailer</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Store name" required>
            <input className={input} value={form.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Green Cannabis Co." required />
          </Field>
          <Field label="Licence number">
            <input className={input} value={form.license_number} onChange={e => set("license_number", e.target.value)} placeholder="e.g. CRSA-1234567" />
          </Field>
        </div>

        <Field label="Address">
          <input className={input} value={form.address} onChange={e => set("address", e.target.value)} placeholder="123 Main St" />
        </Field>

        <div className="grid grid-cols-3 gap-4">
          <Field label="City">
            <input className={input} value={form.city} onChange={e => set("city", e.target.value)} placeholder="Calgary" />
          </Field>
          <Field label="Province">
            <select className={input} value={form.province} onChange={e => set("province", e.target.value)}>
              <option value="">—</option>
              {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </Field>
          <Field label="Postal code">
            <input className={input} value={form.postal_code} onChange={e => set("postal_code", e.target.value)} placeholder="T2P 1J9" />
          </Field>
        </div>

        <div className="border-t border-zinc-100 pt-5">
          <p className="text-xs font-medium text-zinc-400 uppercase tracking-wide mb-4">Contact</p>
          <div className="grid grid-cols-1 gap-4">
            <Field label="Contact name">
              <input className={input} value={form.contact_name} onChange={e => set("contact_name", e.target.value)} placeholder="Jane Smith" />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Email">
                <input className={input} type="email" value={form.contact_email} onChange={e => set("contact_email", e.target.value)} placeholder="jane@store.com" />
              </Field>
              <Field label="Phone">
                <input className={input} type="tel" value={form.contact_phone} onChange={e => set("contact_phone", e.target.value)} placeholder="403-555-0100" />
              </Field>
            </div>
          </div>
        </div>

        <Field label="Internal notes">
          <textarea className={`${input} resize-none`} rows={2} value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Any internal context…" />
        </Field>

        {error && <p className="text-xs text-red-500 bg-red-50 border border-red-100 rounded-lg px-3.5 py-2.5">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-zinc-900 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-zinc-800 disabled:opacity-50 transition-colors">
            {loading ? "Saving…" : "Add retailer"}
          </button>
          <Link href="/retailers" className="text-sm text-zinc-500 px-5 py-2.5 rounded-lg hover:bg-zinc-100 transition-colors">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
