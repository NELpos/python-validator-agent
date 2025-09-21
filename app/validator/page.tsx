"use client"

import React, { useState } from "react"
import { SplitView } from "@/components/ui/split-view"
import { CodeEditor } from "@/components/ui/code-editor"
import { EvaluationPanel } from "@/components/ui/evaluation-panel"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"

const SAMPLE_CODE = `def rule(event):
    """
    Detect suspicious login activity based on unusual location or time.
    """
    # Check if login occurred outside business hours
    login_hour = event.get("hour", 0)
    if login_hour < 6 or login_hour > 22:
        return True

    # Check if login from suspicious country
    suspicious_countries = ["XX", "YY", "ZZ"]
    country = event.get("location", {}).get("country")
    if country in suspicious_countries:
        return True

    return False

def title(event):
    return f"Suspicious login from {event.get('user', 'unknown')}"

def severity(event):
    if event.get("location", {}).get("country") in ["XX", "YY"]:
        return "HIGH"
    return "MEDIUM"
`

export default function ValidatorPage() {
  const [code, setCode] = useState(SAMPLE_CODE)
  const [isValidating, setIsValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleValidate = async () => {
    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, action: "validate" }),
      })

      if (!response.ok) {
        throw new Error("Validation failed")
      }

      const result = await response.json()
      setValidationResult(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsValidating(false)
    }
  }

  const handleImprove = async () => {
    setIsValidating(true)
    setError(null)

    try {
      const response = await fetch("/api/validate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code, action: "improve" }),
      })

      if (!response.ok) {
        throw new Error("Improvement generation failed")
      }

      const result = await response.json()
      setValidationResult(result.validationResult)
      if (result.improvedCode) {
        setCode(result.improvedCode)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Python Detection Rule Validator</h1>
          <div className="flex gap-2">
            <Button
              onClick={handleValidate}
              disabled={isValidating || !code}
            >
              {isValidating ? "Validating..." : "Validate Code"}
            </Button>
            <Button
              onClick={handleImprove}
              disabled={isValidating || !code}
              variant="outline"
            >
              {isValidating ? "Improving..." : "Improve Code"}
            </Button>
          </div>
        </div>
        {error && (
          <Alert className="mt-4" variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      <div className="flex-1 p-6">
        <SplitView
          left={
            <CodeEditor
              value={code}
              onChange={(value) => setCode(value || "")}
            />
          }
          right={
            <EvaluationPanel
              result={validationResult}
              isLoading={isValidating}
            />
          }
        />
      </div>
    </div>
  )
}