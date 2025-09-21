import { NextRequest, NextResponse } from "next/server"
import { validatePythonCode, generateImprovedCode } from "@/lib/agents/python-validator"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, action = "validate" } = body

    if (!code) {
      return NextResponse.json(
        { error: "Code is required" },
        { status: 400 }
      )
    }

    if (action === "validate") {
      const result = await validatePythonCode(code)
      return NextResponse.json(result)
    } else if (action === "improve") {
      const validationResult = await validatePythonCode(code)
      const improvedCode = await generateImprovedCode(code, validationResult)
      return NextResponse.json({
        validationResult,
        improvedCode,
      })
    } else {
      return NextResponse.json(
        { error: "Invalid action. Use 'validate' or 'improve'" },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error("Validation API error:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}