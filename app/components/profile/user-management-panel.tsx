"use client"

import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Users, Loader2, Trash2, RefreshCw } from "lucide-react"
import { useState, useEffect } from "react"
import { useToast } from "@/components/ui/use-toast"
import { ROLES } from "@/lib/permissions"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface User {
  id: string
  name?: string
  username?: string
  email?: string
  role?: string
  mailboxes: {
    total: number
    active: number
    expired: number
  }
}

interface UserListResponse {
  users: User[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

export function UserManagementPanel() {
  const t = useTranslations("profile.userManagement")
  const tCard = useTranslations("profile.card")
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [roleFilter, setRoleFilter] = useState<string>("all")
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [userToDelete, setUserToDelete] = useState<User | null>(null)
  const { toast } = useToast()

  const fetchUsers = async (pageNum: number = 1, reset: boolean = false) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: '20',
      })

      if (roleFilter !== 'all') {
        params.append('role', roleFilter)
      }

      const res = await fetch(`/api/users?${params}`)
      if (!res.ok) throw new Error("Failed to fetch users")

      const data = await res.json() as UserListResponse

      if (reset) {
        setUsers(data.users)
      } else {
        setUsers(prev => [...prev, ...data.users])
      }

      setHasMore(data.pagination.hasMore)
      setPage(pageNum)
    } catch (error) {
      toast({
        title: t("loadFailed"),
        description: error instanceof Error ? error.message : t("loadFailed"),
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers(1, true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleFilter])

  const handleDelete = async (user: User) => {
    setUserToDelete(user)
  }

  const confirmDelete = async () => {
    if (!userToDelete) return

    setDeleting(userToDelete.id)
    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: userToDelete.id })
      })

      if (!res.ok) {
        const error = await res.json() as { error: string }
        throw new Error(error.error || t("deleteFailed"))
      }

      toast({
        title: t("deleteSuccess"),
        description: `${userToDelete.username || userToDelete.email}`,
      })

      // Refresh user list
      fetchUsers(1, true)
    } catch (error) {
      toast({
        title: t("deleteFailed"),
        description: error instanceof Error ? error.message : t("deleteFailed"),
        variant: "destructive"
      })
    } finally {
      setDeleting(null)
      setUserToDelete(null)
    }
  }

  const roleNames = {
    [ROLES.EMPEROR]: tCard("roles.EMPEROR"),
    [ROLES.DUKE]: tCard("roles.DUKE"),
    [ROLES.KNIGHT]: tCard("roles.KNIGHT"),
    [ROLES.SQUIRE]: tCard("roles.SQUIRE"),
    [ROLES.CIVILIAN]: tCard("roles.CIVILIAN"),
  }

  return (
    <div className="bg-background rounded-lg border-2 border-primary/20 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h2 className="text-lg font-semibold">{t("title")}</h2>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fetchUsers(1, true)}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="space-y-4">
        {/* Filter */}
        <div className="flex gap-2 items-center">
          <span className="text-sm text-muted-foreground">{t("filterByRole")}:</span>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allRoles")}</SelectItem>
              <SelectItem value={ROLES.EMPEROR}>{roleNames[ROLES.EMPEROR]}</SelectItem>
              <SelectItem value={ROLES.DUKE}>{roleNames[ROLES.DUKE]}</SelectItem>
              <SelectItem value={ROLES.KNIGHT}>{roleNames[ROLES.KNIGHT]}</SelectItem>
              <SelectItem value={ROLES.SQUIRE}>{roleNames[ROLES.SQUIRE]}</SelectItem>
              <SelectItem value={ROLES.CIVILIAN}>{roleNames[ROLES.CIVILIAN]}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* User List */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {users.length === 0 && !loading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t("noUsers")}
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {user.username || user.name || user.email}
                    </span>
                    {user.role && (
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded">
                        {roleNames[user.role as keyof typeof roleNames] || user.role}
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {t("mailboxStats", {
                      total: user.mailboxes.total,
                      active: user.mailboxes.active,
                      expired: user.mailboxes.expired,
                    })}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(user)}
                  disabled={deleting === user.id || user.role === ROLES.EMPEROR}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  {deleting === user.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </Button>
              </div>
            ))
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <Button
            variant="outline"
            onClick={() => fetchUsers(page + 1, false)}
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              t("loadMore")
            )}
          </Button>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!userToDelete} onOpenChange={() => setUserToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("deleteDescription", {
                username: userToDelete?.username || userToDelete?.email || ""
              })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
