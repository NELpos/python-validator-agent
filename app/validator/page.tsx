"use client"

import React, { useState } from "react"
import { SplitView } from "@/components/ui/split-view"
import { CodeEditor } from "@/components/ui/code-editor"
import { EvaluationPanel } from "@/components/ui/evaluation-panel"
import { StreamingEvaluationPanel } from "@/components/ui/streaming-evaluation-panel"
import { StructuredEvaluationPanel } from "@/components/ui/structured-evaluation-panel"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useStreamingValidation } from "@/lib/hooks/useStreamingValidation"
import { useStructuredValidation } from "@/lib/hooks/useStructuredValidation"

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
  const [validationMode, setValidationMode] = useState<'streaming' | 'structured' | 'legacy'>('structured')

  const streamingValidation = useStreamingValidation()
  const structuredValidation = useStructuredValidation()

  const handleValidate = async () => {
    if (validationMode === 'streaming') {
      streamingValidation.reset()
      await streamingValidation.startValidation(code, "validate")
    } else if (validationMode === 'structured') {
      structuredValidation.reset()
      await structuredValidation.startValidation(code, "validate")
    } else {
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
          <div className="flex gap-2 items-center">
            <select
              value={validationMode}
              onChange={(e) => setValidationMode(e.target.value as 'streaming' | 'structured' | 'legacy')}
              className="text-sm border rounded px-2 py-1"
            >
              <option value="structured">Structured (DB저장)</option>
              <option value="streaming">Streaming</option>
              <option value="legacy">Legacy</option>
            </select>
            <Button
              onClick={handleValidate}
              disabled={
                (validationMode === 'streaming' ? streamingValidation.isStreaming :
                 validationMode === 'structured' ? structuredValidation.isValidating :
                 isValidating) || !code
              }
            >
              {(validationMode === 'streaming' ? streamingValidation.isStreaming :
                validationMode === 'structured' ? structuredValidation.isValidating :
                isValidating) ? "Validating..." : "Validate Code"}
            </Button>
            {((validationMode === 'streaming' && streamingValidation.isStreaming) ||
              (validationMode === 'structured' && structuredValidation.isValidating)) && (
              <Button
                onClick={validationMode === 'streaming' ? streamingValidation.cancelValidation : structuredValidation.cancelValidation}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            )}
            <Button
              onClick={handleImprove}
              disabled={
                (validationMode === 'streaming' ? streamingValidation.isStreaming :
                 validationMode === 'structured' ? structuredValidation.isValidating :
                 isValidating) || !code
              }
              variant="outline"
            >
              {(validationMode === 'streaming' ? streamingValidation.isStreaming :
                validationMode === 'structured' ? structuredValidation.isValidating :
                isValidating) ? "Improving..." : "Improve Code"}
            </Button>
          </div>
        </div>
        {(error || streamingValidation.error || structuredValidation.error) && (
          <Alert className="mt-4" variant="destructive">
            <AlertDescription>{error || streamingValidation.error || structuredValidation.error}</AlertDescription>
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
            validationMode === 'streaming' ? (
              <StreamingEvaluationPanel
                streamingState={streamingValidation}
              />
            ) : validationMode === 'structured' ? (
              <StructuredEvaluationPanel
                isValidating={structuredValidation.isValidating}
                currentStep={structuredValidation.currentStep}
                progressSteps={structuredValidation.progressSteps}
                result={structuredValidation.result}
                recordId={structuredValidation.recordId}
                duration={structuredValidation.duration}
                error={structuredValidation.error}
              />
            ) : (
              <EvaluationPanel
                result={validationResult}
                isLoading={isValidating}
              />
            )
          }
        />
      </div>
    </div>
  )
}