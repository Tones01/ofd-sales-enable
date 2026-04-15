export const dynamic = "force-dynamic"

import { createClient } from "@/lib/supabase/server"
import ChangePasswordForm from "./ChangePasswordForm"

export default async function AccountPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user!.id)
    .single()

  return (
    <div className="px-8 py-8 max-w-lg mx-auto">
      <h1 className="font-serif text-2xl text-zinc-900 mb-1">Account</h1>
      <p className="text-sm text-zinc-400 mb-8">
        {profile?.full_name} · <span className="capitalize">{profile?.role}</span>
      </p>
      <ChangePasswordForm email={user!.email!} />
    </div>
  )
}
