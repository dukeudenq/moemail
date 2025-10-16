import { NextResponse } from "next/server"
import { createDb } from "@/lib/db"
import { invitationCodes } from "@/lib/schema"
import { eq, and, isNull, gt } from "drizzle-orm"

export const runtime = "edge"

interface ValidateInvitationCodeRequest {
  code: string
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as ValidateInvitationCodeRequest
    const { code } = body

    if (!code) {
      return NextResponse.json(
        { valid: false, error: "邀请码不能为空" },
        { status: 400 }
      )
    }

    const db = createDb()
    const invitation = await db.query.invitationCodes.findFirst({
      where: eq(invitationCodes.code, code.toUpperCase())
    })

    if (!invitation) {
      return NextResponse.json({
        valid: false,
        error: "邀请码不存在"
      })
    }

    // Check if already used
    if (invitation.usedBy) {
      return NextResponse.json({
        valid: false,
        error: "邀请码已被使用"
      })
    }

    // Check if expired
    const now = new Date()
    if (invitation.expiresAt < now) {
      return NextResponse.json({
        valid: false,
        error: "邀请码已过期"
      })
    }

    // Valid invitation code
    return NextResponse.json({
      valid: true,
      role: invitation.role,
      mailboxExpiryMs: invitation.mailboxExpiryMs,
    })
  } catch (error) {
    console.error('Failed to validate invitation code:', error)
    return NextResponse.json(
      { valid: false, error: "验证邀请码失败" },
      { status: 500 }
    )
  }
}
