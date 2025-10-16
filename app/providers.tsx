"use client"

import { SessionProvider } from "next-auth/react"
import { InvitationRedirect } from "@/components/auth/invitation-redirect"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <InvitationRedirect />
      {children}
    </SessionProvider>
  )
} 