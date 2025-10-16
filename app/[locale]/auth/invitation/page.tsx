"use client"

import { useState } from "react"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { useToast } from "@/components/ui/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Loader2, Ticket } from "lucide-react"
import { cn } from "@/lib/utils"

export default function InvitationCodePage() {
  const [invitationCode, setInvitationCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const { data: session, update } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations("auth.invitation")

  const handleSubmit = async () => {
    if (!invitationCode) {
      setError(t("errors.codeRequired"))
      return
    }

    setLoading(true)
    setError("")

    try {
      const response = await fetch("/api/auth/apply-invitation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: invitationCode }),
      })

      const data = await response.json() as { error?: string; success?: boolean; role?: string }

      if (!response.ok || !data.success) {
        setError(data.error || t("errors.applyFailed"))
        setLoading(false)
        return
      }

      // Update session to reflect new role
      await update()

      toast({
        title: t("toast.success"),
        description: t("toast.successDesc"),
      })

      // Redirect to home page
      router.push("/")
    } catch (error) {
      setError(error instanceof Error ? error.message : t("errors.applyFailed"))
      setLoading(false)
    }
  }

  // Redirect if user already has a role
  if (session && !session.user.needsInvitationCode) {
    router.push("/")
    return null
  }

  return (
    <div className="flex items-center justify-center min-h-screen p-4">
      <Card className="w-[95%] max-w-md border-2 border-primary/20">
        <CardHeader className="space-y-2">
          <CardTitle className="text-2xl text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            {t("title")}
          </CardTitle>
          <CardDescription className="text-center">
            {t("subtitle")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 px-6">
          <div className="space-y-2">
            <div className="relative">
              <div className="absolute left-2.5 top-2 text-muted-foreground">
                <Ticket className="h-5 w-5" />
              </div>
              <Input
                className={cn(
                  "h-9 pl-9 pr-3",
                  error && "border-destructive focus-visible:ring-destructive"
                )}
                placeholder={t("fields.invitationCode")}
                value={invitationCode}
                onChange={(e) => {
                  setInvitationCode(e.target.value.toUpperCase())
                  setError("")
                }}
                disabled={loading}
              />
            </div>
            {error && (
              <p className="text-xs text-destructive">{error}</p>
            )}
          </div>

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("actions.submit")}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
