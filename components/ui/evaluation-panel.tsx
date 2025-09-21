"use client"

import React from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

interface EvaluationResult {
  syntaxCheck: {
    isValid: boolean
    errors?: string[]
  }
  ruleCompliance: {
    score: number
    findings: string[]
    suggestions: string[]
  }
  codeQuality: {
    score: number
    feedback: string
  }
  detailedAnalysis: string
}

interface EvaluationPanelProps {
  result: EvaluationResult | null
  isLoading?: boolean
  className?: string
}

export function EvaluationPanel({ result, isLoading, className }: EvaluationPanelProps) {
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-96">
            <div className="animate-pulse text-muted-foreground">Analyzing code...</div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!result) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Evaluation Results</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">
            Enter Python code and click "Validate" to see evaluation results.
          </div>
        </CardContent>
      </Card>
    )
  }

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return "bg-green-500"
    if (score >= 60) return "bg-yellow-500"
    return "bg-red-500"
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Evaluation Results</span>
          <div className="flex gap-2">
            <Badge className={cn(getScoreBadgeColor(result.ruleCompliance.score))}>
              Rules: {result.ruleCompliance.score}%
            </Badge>
            <Badge className={cn(getScoreBadgeColor(result.codeQuality.score))}>
              Quality: {result.codeQuality.score}%
            </Badge>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="syntax">Syntax</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="analysis">Analysis</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <div className="space-y-4">
              <Alert className={result.syntaxCheck.isValid ? "border-green-500" : "border-red-500"}>
                <AlertTitle>Syntax Check</AlertTitle>
                <AlertDescription>
                  {result.syntaxCheck.isValid
                    ? "✓ No syntax errors found"
                    : `✗ ${result.syntaxCheck.errors?.length} syntax errors found`}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h3 className="font-semibold">Code Quality Feedback</h3>
                <div className="text-sm text-muted-foreground">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {result.codeQuality.feedback}
                  </ReactMarkdown>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="syntax">
            <div className="space-y-2">
              {result.syntaxCheck.isValid ? (
                <Alert className="border-green-500">
                  <AlertDescription>All syntax checks passed</AlertDescription>
                </Alert>
              ) : (
                <div className="space-y-2">
                  {result.syntaxCheck.errors?.map((error, idx) => (
                    <Alert key={idx} className="border-red-500">
                      <AlertDescription>{error}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="rules">
            <div className="space-y-4">
              <div className="space-y-2">
                <h3 className="font-semibold">Panther Rules Findings</h3>
                {result.ruleCompliance.findings.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {result.ruleCompliance.findings.map((finding, idx) => (
                      <li key={idx}>{finding}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">No issues found</p>
                )}
              </div>

              <div className="space-y-2">
                <h3 className="font-semibold">Improvement Suggestions</h3>
                {result.ruleCompliance.suggestions.length > 0 ? (
                  <ul className="list-disc list-inside space-y-1 text-sm">
                    {result.ruleCompliance.suggestions.map((suggestion, idx) => (
                      <li key={idx}>{suggestion}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-muted-foreground">Code follows best practices</p>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analysis">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {result.detailedAnalysis}
              </ReactMarkdown>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}