import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { invitationCodes } from "@/lib/schema"
import { getUserId } from "@/lib/apiKey"
import { checkPermission } from "@/lib/auth"
import { PERMISSIONS, ROLES } from "@/lib/permissions"
import { nanoid } from "nanoid"

export const runtime = "edge"

interface GenerateInvitationCodeRequest {
  role: typeof ROLES.DUKE | typeof ROLES.KNIGHT | typeof ROLES.SQUIRE | typeof ROLES.CIVILIAN
  mailboxExpiryMs?: number | null
  expiresInDays?: number
}

export async function POST(request: Request) {
  // Check for MANAGE_API_KEY permission
  const hasPermission = await checkPermission(PERMISSIONS.MANAGE_API_KEY)
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
    const body = await request.json() as GenerateInvitationCodeRequest
    const { role, mailboxExpiryMs, expiresInDays = 7 } = body

    // Validate role
    if (![ROLES.DUKE, ROLES.KNIGHT, ROLES.SQUIRE, ROLES.CIVILIAN].includes(role)) {
      return NextResponse.json(
        { error: "无效的角色" },
        { status: 400 }
      )
    }

    // Validate mailboxExpiryMs for squire role
    // 0 or null = permanent, positive number = specific expiry time
    if (role === ROLES.SQUIRE && mailboxExpiryMs !== undefined && mailboxExpiryMs !== null && mailboxExpiryMs !== 0) {
      if (mailboxExpiryMs < 0 || mailboxExpiryMs > 365 * 24 * 60 * 60 * 1000) {
        return NextResponse.json(
          { error: "邮箱过期时间必须在0（永久）到1年之间" },
          { status: 400 }
        )
      }
    }

    // Validate expiresInDays
    if (expiresInDays < 1 || expiresInDays > 365) {
      return NextResponse.json(
        { error: "邀请码有效期必须在1到365天之间" },
        { status: 400 }
      )
    }

    // Generate unique invitation code
    const code = nanoid(12).toUpperCase()
    const now = new Date()
    const expiresAt = new Date(now.getTime() + expiresInDays * 24 * 60 * 60 * 1000)

    const db = createDb()

    // Determine mailbox expiry for squire
    let mailboxExpiry = null
    if (role === ROLES.SQUIRE) {
      if (mailboxExpiryMs === 0 || mailboxExpiryMs === null) {
        mailboxExpiry = 0 // 0 means permanent
      } else {
        mailboxExpiry = mailboxExpiryMs ?? 3600000 // Default to 1 hour
      }
    }

    const [invitation] = await db.insert(invitationCodes)
      .values({
        code,
        createdBy: userId,
        role,
        mailboxExpiryMs: mailboxExpiry,
        expiresAt,
      })
      .returning()

    return NextResponse.json({
      code: invitation.code,
      role: invitation.role,
      mailboxExpiryMs: invitation.mailboxExpiryMs,
      expiresAt: invitation.expiresAt,
    })
  } catch (error) {
    console.error('Failed to generate invitation code:', error)
    return NextResponse.json(
      { error: "生成邀请码失败" },
      { status: 500 }
    )
  }
}
