"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"
import {
  LayoutDashboard,
  Tag,
  FileText,
  Inbox,
  Store,
  Megaphone,
  BarChart2,
  LogOut,
  KeyRound,
} from "lucide-react"
import type { Role } from "@/types/database"

const NAV = [
  { href: "/",            label: "Dashboard",   icon: LayoutDashboard },
  { href: "/deals",       label: "Deals",        icon: Tag },
  { href: "/sheets",      label: "Sheets",       icon: FileText },
  { href: "/orders",      label: "Orders",       icon: Inbox },
  { href: "/retailers",   label: "Retailers",    icon: Store },
  { href: "/promotions",  label: "Promotions",   icon: Megaphone },
  { href: "/reports",     label: "Reports",      icon: BarChart2 },
]

export default function Sidebar({ role, fullName }: { role: Role; fullName: string }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  async function signOut() {
    await supabase.auth.signOut()
    router.push("/login")
    router.refresh()
  }

  return (
    <aside className="w-56 flex flex-col bg-white border-r border-zinc-100 shrink-0">

      {/* Wordmark */}
      <div className="px-6 pt-7 pb-6 border-b border-zinc-100">
        <span className="font-serif text-xl text-zinc-900 tracking-tight">Open Fields</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50"
              }`}
            >
              <Icon size={15} strokeWidth={active ? 2 : 1.5} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* User footer */}
      <div className="px-3 py-4 border-t border-zinc-100">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-zinc-900 truncate">{fullName}</p>
          <p className="text-xs text-zinc-400 capitalize">{role}</p>
        </div>
        <Link
          href="/account"
          className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm transition-colors ${
            pathname === "/account"
              ? "bg-zinc-900 text-white"
              : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50"
          }`}
        >
          <KeyRound size={15} strokeWidth={pathname === "/account" ? 2 : 1.5} />
          Account
        </Link>
        <button
          onClick={signOut}
          className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 transition-colors"
        >
          <LogOut size={15} strokeWidth={1.5} />
          Sign out
        </button>
      </div>
    </aside>
  )
}
