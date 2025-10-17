import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { users, userRoles, emails } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS } from "@/lib/permissions"
import { eq, desc, sql, and, lt } from "drizzle-orm"

export const runtime = "edge"

interface ListUsersQuery {
  role?: string
  page?: number
  limit?: number
  hasExpiredMailbox?: boolean
}

export async function GET(request: Request) {
  // Check for PROMOTE_USER permission (EMPEROR only)
  const hasPermission = await checkPermission(PERMISSIONS.PROMOTE_USER)
  if (!hasPermission) {
    return NextResponse.json(
      { error: "权限不足" },
      { status: 403 }
    )
  }

  const userId = await getUserId()
  if (!userId) {
    return NextResponse.json(
      { error: "未授权" },
      { status: 401 }
    )
  }

  try {
    const url = new URL(request.url)
    const role = url.searchParams.get('role') || undefined
    const page = parseInt(url.searchParams.get('page') || '1')
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
    const hasExpiredMailbox = url.searchParams.get('hasExpiredMailbox') === 'true'

    const db = createDb()
    const offset = (page - 1) * limit

    // Build query
    let query = db
      .select({
        id: users.id,
        name: users.name,
        username: users.username,
        email: users.email,
        emailVerified: users.emailVerified,
        image: users.image,
        roles: sql<string>`GROUP_CONCAT(${userRoles.roleId})`,
      })
      .from(users)
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .groupBy(users.id)
      .orderBy(desc(users.id))
      .limit(limit)
      .offset(offset)

    const allUsers = await query

    // Get role names and mailbox info for each user
    const usersWithDetails = await Promise.all(
      allUsers.map(async (user) => {
        const userRoleRecords = await db.query.userRoles.findMany({
          where: eq(userRoles.userId, user.id),
          with: { role: true },
        })

        const roleName = userRoleRecords[0]?.role.name || null

        // Filter by role if specified
        if (role && roleName !== role) {
          return null
        }

        // Get user's emails
        const userEmails = await db.query.emails.findMany({
          where: eq(emails.userId, user.id),
          orderBy: desc(emails.createdAt),
        })

        const now = new Date()
        const activeMailboxes = userEmails.filter(e => e.expiresAt > now).length
        const expiredMailboxes = userEmails.filter(e => e.expiresAt <= now).length

        // Filter by expired mailbox status if specified
        if (hasExpiredMailbox && expiredMailboxes === 0) {
          return null
        }

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          role: roleName,
          mailboxes: {
            total: userEmails.length,
            active: activeMailboxes,
            expired: expiredMailboxes,
          },
        }
      })
    )

    // Filter out null results
    const filteredUsers = usersWithDetails.filter(u => u !== null)

    // Get total count (rough estimate)
    const totalCount = await db.select({ count: sql<number>`count(*)` })
      .from(users)
      .then(result => result[0]?.count || 0)

    return NextResponse.json({
      users: filteredUsers,
      pagination: {
        page,
        limit,
        total: totalCount,
        hasMore: offset + filteredUsers.length < totalCount,
      },
    })
  } catch (error) {
    console.error('Failed to list users:', error)
    return NextResponse.json(
      { error: "获取用户列表失败" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  // Check for PROMOTE_USER permission (EMPEROR only)
  const hasPermission = await checkPermission(PERMISSIONS.PROMOTE_USER)
  if (!hasPermission) {
    return NextResponse.json(
      { error: "权限不足" },
      { status: 403 }
    )
  }

  const currentUserId = await getUserId()
  if (!currentUserId) {
    return NextResponse.json(
      { error: "未授权" },
      { status: 401 }
    )
  }

  try {
    const { userId } = await request.json() as { userId: string }

    if (!userId) {
      return NextResponse.json(
        { error: "请提供用户ID" },
        { status: 400 }
      )
    }

    // Prevent self-deletion
    if (userId === currentUserId) {
      return NextResponse.json(
        { error: "不能删除自己" },
        { status: 400 }
      )
    }

    const db = createDb()

    // Check if user exists
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      with: {
        userRoles: {
          with: {
            role: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "用户不存在" },
        { status: 404 }
      )
    }

    // Prevent deleting EMPEROR users
    const isEmperor = user.userRoles.some(ur => ur.role.name === 'emperor')
    if (isEmperor) {
      return NextResponse.json(
        { error: "不能删除皇帝用户" },
        { status: 403 }
      )
    }

    // Delete user (cascade will delete related records)
    await db.delete(users).where(eq(users.id, userId))

    return NextResponse.json({
      success: true,
      message: "用户已删除",
    })
  } catch (error) {
    console.error('Failed to delete user:', error)
    return NextResponse.json(
      { error: "删除用户失败" },
      { status: 500 }
    )
  }
}
