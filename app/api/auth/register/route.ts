import { NextResponse } from "next/server"
import { register } from "@/lib/auth"
import { registerSchema, RegisterSchema } from "@/lib/validation"

export const runtime = "edge"

export async function POST(request: Request) {
  try {
    const json = await request.json() as RegisterSchema

    try {
      registerSchema.parse(json)
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "输入格式不正确" },
        { status: 400 }
      )
    }

    const { username, password, invitationCode } = json
    const user = await register(username, password, invitationCode)

    return NextResponse.json({ user })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "注册失败" },
      { status: 500 }
    )
  }
} 