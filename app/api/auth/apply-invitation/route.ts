import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { invitationCodes, users, emails as emailsSchema } from "@/lib/schema"
import { eq } from "drizzle-orm"
import { auth } from "@/lib/auth"
import { assignRoleToUser } from "@/lib/auth"
import { getRequestContext } from "@cloudflare/next-on-pages"
import { ROLES, Role } from "@/lib/permissions"

export const runtime = "edge"

interface ApplyInvitationCodeRequest {
  code: string
}

async function findOrCreateRole(db: ReturnType<typeof createDb>, roleName: Role) {
  const { roles } = await import("@/lib/schema")

  let role = await db.query.roles.findFirst({
    where: eq(roles.name, roleName),
  })

  if (!role) {
    const ROLE_DESCRIPTIONS: Record<Role, string> = {
      [ROLES.EMPEROR]: "皇帝（网站所有者）",
      [ROLES.DUKE]: "公爵（超级用户）",
      [ROLES.KNIGHT]: "骑士（高级用户）",
      [ROLES.SQUIRE]: "侍从（仅收发邮件）",
      [ROLES.CIVILIAN]: "平民（普通用户）",
    }

    const [newRole] = await db.insert(roles)
      .values({
        name: roleName,
        description: ROLE_DESCRIPTIONS[roleName],
      })
      .returning()
    role = newRole
  }

  return role
}

export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json(
      { error: "未授权" },
      { status: 401 }
    )
  }

  try {
    const body = await request.json() as ApplyInvitationCodeRequest
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { error: "邀请码不能为空" },
        { status: 400 }
      )
    }

    const db = createDb()

    // Check if user already has a role
    const { userRoles } = await import("@/lib/schema")
    const existingRole = await db.query.userRoles.findFirst({
      where: eq(userRoles.userId, session.user.id),
    })

    if (existingRole) {
      return NextResponse.json(
        { error: "用户已有角色，无需使用邀请码" },
        { status: 400 }
      )
    }

    // Validate invitation code
    const invitation = await db.query.invitationCodes.findFirst({
      where: eq(invitationCodes.code, code.toUpperCase())
    })

    if (!invitation) {
      return NextResponse.json(
        { error: "邀请码不存在" },
        { status: 400 }
      )
    }

    if (invitation.usedBy) {
      return NextResponse.json(
        { error: "邀请码已被使用" },
        { status: 400 }
      )
    }

    const now = new Date()
    if (invitation.expiresAt < now) {
      return NextResponse.json(
        { error: "邀请码已过期" },
        { status: 400 }
      )
    }

    // Assign role from invitation code
    const role = await findOrCreateRole(db, invitation.role as Role)
    await assignRoleToUser(db, session.user.id, role.id)

    // Mark invitation code as used
    await db.update(invitationCodes)
      .set({
        usedBy: session.user.id,
        usedAt: now
      })
      .where(eq(invitationCodes.id, invitation.id))

    // Auto-create mailbox for squire role users
    if (invitation.role === ROLES.SQUIRE) {
      try {
        const env = getRequestContext().env
        const domainString = await env.SITE_CONFIG.get("EMAIL_DOMAINS")
        const domains = domainString ? domainString.split(',') : ["moemail.app"]
        const domain = domains[0]

        // Get user info to create mailbox
        const user = await db.query.users.findFirst({
          where: eq(users.id, session.user.id)
        })

        if (!user) {
          throw new Error("用户不存在")
        }

        const username = user.username || user.email?.split('@')[0] || user.name
        const address = `${username}@${domain}`

        let expiresAt: Date
        if (invitation.mailboxExpiryMs === 0 || invitation.mailboxExpiryMs === null) {
          // Permanent mailbox
          expiresAt = new Date('9999-01-01T00:00:00.000Z')
        } else {
          expiresAt = new Date(now.getTime() + invitation.mailboxExpiryMs)
        }

        await db.insert(emailsSchema).values({
          address,
          createdAt: now,
          expiresAt,
          userId: session.user.id
        })
      } catch (error) {
        console.error('Failed to create mailbox for squire user:', error)
        return NextResponse.json(
          { error: "创建邮箱失败" },
          { status: 500 }
        )
      }
    }

    return NextResponse.json({
      success: true,
      role: invitation.role
    })
  } catch (error) {
    console.error('Failed to apply invitation code:', error)
    return NextResponse.json(
      { error: "应用邀请码失败" },
      { status: 500 }
    )
  }
}
