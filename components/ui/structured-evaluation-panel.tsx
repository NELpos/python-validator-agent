"use client"

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, AlertCircle, Clock, Database } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { type ValidationResult } from "@/lib/schemas/validation"

interface ProgressStep {
  key: string
  message: string
  timestamp: number
}

interface StructuredEvaluationPanelProps {
  isValidating: boolean
  currentStep: string | null
  progressSteps: ProgressStep[]
  result: ValidationResult | null
  recordId: string | null
  duration: number | null
  error: string | null
}

function SafeReactMarkdown({ children, fallback = "내용을 표시할 수 없습니다." }: { children: string, fallback?: string }) {
  try {
    if (!children || typeof children !== 'string' || children.trim().length === 0) {
      return <div className="text-gray-500 italic">{fallback}</div>
    }

    return (
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    )
  } catch (error) {
    console.warn('ReactMarkdown rendering error:', error)
    return <div className="text-red-500 italic">마크다운 렌더링 중 오류가 발생했습니다.</div>
  }
}

export function StructuredEvaluationPanel({
  isValidating,
  currentStep,
  progressSteps,
  result,
  recordId,
  duration,
  error
}: StructuredEvaluationPanelProps) {
  if (error) {
    return (
      <div className="h-full p-6">
        <Card className="border-red-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600">
              <AlertCircle className="h-5 w-5" />
              오류 발생
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600">{error}</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!isValidating && !result && progressSteps.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>구조화된 검증을 시작하여 결과를 DB에 저장하세요</p>
        </div>
      </div>
    )
  }

  const progressPercent = progressSteps.length > 0 ?
    (currentStep === 'complete' ? 100 : (progressSteps.length / 5) * 100) : 0

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>구조화된 검증 진행상황</span>
            <div className="flex gap-2">
              <Badge variant="outline" className="flex items-center gap-1">
                <Database className="h-3 w-3" />
                DB 저장
              </Badge>
              <Badge variant={isValidating ? "default" : "secondary"}>
                {isValidating ? "진행 중" : "완료"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progressPercent} className="mb-4" />

          {/* Progress Steps Timeline */}
          <div className="space-y-3">
            {progressSteps.map((step, index) => (
              <div key={step.key} className="flex items-center gap-3">
                {index === progressSteps.length - 1 && isValidating ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                )}
                <span className="text-sm text-gray-700">{step.message}</span>
                <span className="text-xs text-gray-400 ml-auto">
                  {new Date(step.timestamp).toLocaleTimeString('ko-KR')}
                </span>
              </div>
            ))}

            {currentStep && isValidating && (
              <div className="flex items-center gap-3">
                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                <span className="text-sm text-blue-600 font-medium">
                  {currentStep === 'analysis' ? '상세 분석을 수행하고 있습니다...' : '처리 중...'}
                </span>
              </div>
            )}
          </div>

          {/* Database Info */}
          {recordId && (
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2 text-sm">
                <Database className="h-4 w-4 text-gray-600" />
                <span className="text-gray-600">
                  Record ID: <code className="text-xs bg-white px-1 py-0.5 rounded">{recordId}</code>
                </span>
                {duration && (
                  <span className="text-gray-600 ml-4">
                    Duration: <code className="text-xs bg-white px-1 py-0.5 rounded">{duration}ms</code>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results Section */}
      {result && (
        <>
          {/* Syntax Check Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                구문 검사 결과
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Badge variant={result.syntaxCheck.isValid ? "secondary" : "destructive"}>
                  {result.syntaxCheck.isValid ? "유효" : "오류"}
                </Badge>
                {result.syntaxCheck.isValid ? (
                  <span className="text-green-600">구문 오류가 없습니다</span>
                ) : (
                  <span className="text-red-600">구문 오류 발견</span>
                )}
              </div>
              {result.syntaxCheck.errors && result.syntaxCheck.errors.length > 0 && (
                <div className="mt-3">
                  <h4 className="font-medium text-red-600 mb-2">오류 목록:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.syntaxCheck.errors.map((error, index) => (
                      <li key={index} className="text-sm text-red-600">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Rules Compliance Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                규칙 준수성 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">점수:</span>
                <Badge variant={result.ruleCompliance.score >= 70 ? "secondary" : "destructive"}>
                  {result.ruleCompliance.score}/100
                </Badge>
              </div>

              {result.ruleCompliance.findings && result.ruleCompliance.findings.length > 0 && (
                <div className="mb-4">
                  <h4 className="font-medium mb-2">발견된 문제:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.ruleCompliance.findings.map((finding, index) => (
                      <li key={index} className="text-sm text-amber-600">{finding}</li>
                    ))}
                  </ul>
                </div>
              )}

              {result.ruleCompliance.suggestions && result.ruleCompliance.suggestions.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">개선 제안:</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.ruleCompliance.suggestions.map((suggestion, index) => (
                      <li key={index} className="text-sm text-blue-600">{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Code Quality Results */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                코드 품질 평가
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-4">
                <span className="text-sm font-medium">점수:</span>
                <Badge variant={result.codeQuality.score >= 70 ? "secondary" : "destructive"}>
                  {result.codeQuality.score}/100
                </Badge>
              </div>

              <div className="prose prose-sm max-w-none">
                <SafeReactMarkdown
                  fallback="품질 분석 데이터를 불러오는 중입니다..."
                >
                  {result.codeQuality.feedback}
                </SafeReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Analysis */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                상세 분석
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none">
                <SafeReactMarkdown
                  fallback="분석 데이터를 불러오는 중입니다..."
                >
                  {result.detailedAnalysis}
                </SafeReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Summary Card */}
          <Card className="border-green-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="h-5 w-5" />
                분석 완료
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {result.syntaxCheck.isValid ? "✓" : "✗"}
                  </div>
                  <div className="text-sm text-gray-600">구문 검사</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {result.ruleCompliance.score}
                  </div>
                  <div className="text-sm text-gray-600">규칙 준수</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {result.codeQuality.score}
                  </div>
                  <div className="text-sm text-gray-600">코드 품질</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}