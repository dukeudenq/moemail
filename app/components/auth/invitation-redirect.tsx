"use client"

import { useEffect } from "react"
import { useSession } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"

export function InvitationRedirect() {
  const { data: session } = useSession()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // If user needs invitation code and not already on invitation page
    if (session?.user?.needsInvitationCode && !pathname?.includes("/auth/invitation")) {
      router.push("/auth/invitation")
    }
  }, [session, router, pathname])

  return null
}
