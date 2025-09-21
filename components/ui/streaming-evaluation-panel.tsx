"use client"

import React, { ErrorInfo, ReactNode } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Loader2, CheckCircle, AlertCircle, Clock } from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { StreamingValidationState } from "@/lib/hooks/useStreamingValidation"

interface StreamingEvaluationPanelProps {
  streamingState: StreamingValidationState
}

// 안전한 문자열 추출 헬퍼 함수
function getMarkdownContent(data: any, isRaw: boolean = false): string {
  console.log('Processing data for markdown:', { data, isRaw, type: typeof data })

  // Raw 데이터인 경우 그대로 반환 (이미 문자열이어야 함)
  if (isRaw && typeof data === 'string') {
    return data
  }

  // 이미 문자열인 경우
  if (typeof data === 'string') {
    return data
  }

  // 객체인 경우 가능한 필드들 확인
  if (data && typeof data === 'object') {
    // analysis 단계의 detailedAnalysis 필드
    if (data.detailedAnalysis && typeof data.detailedAnalysis === 'string') {
      return data.detailedAnalysis
    }

    // quality 단계의 feedback 필드
    if (data.feedback && typeof data.feedback === 'string') {
      return data.feedback
    }

    // 기타 가능한 content 필드들
    if (data.content && typeof data.content === 'string') {
      return data.content
    }

    // fallback 데이터인 경우 첫 번째 문자열 값 찾기
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'string' && value.trim().length > 0) {
        console.log(`Using ${key} field as fallback content`)
        return value
      }
    }

    // 객체를 JSON으로 변환 (최후 수단)
    try {
      return '```json\n' + JSON.stringify(data, null, 2) + '\n```'
    } catch {
      return '데이터를 표시할 수 없습니다.'
    }
  }

  // null, undefined, 또는 기타 타입
  return ''
}

// 문자열 검증 함수
function isValidMarkdown(content: string): boolean {
  return typeof content === 'string' && content.trim().length > 0
}

// 안전한 ReactMarkdown 래퍼 컴포넌트
function SafeReactMarkdown({ children, fallback = "내용을 표시할 수 없습니다." }: { children: string, fallback?: string }) {
  try {
    if (!isValidMarkdown(children)) {
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

const stepTitles = {
  syntax: "구문 검사",
  rules: "규칙 준수성",
  quality: "코드 품질",
  analysis: "상세 분석",
  complete: "완료"
}

const stepDescriptions = {
  syntax: "Python 구문 오류를 검사하고 있습니다...",
  rules: "Panther 탐지 규칙 준수성을 분석하고 있습니다...",
  quality: "코드 품질과 모범 사례를 평가하고 있습니다...",
  analysis: "종합적인 코드 분석을 수행하고 있습니다...",
  complete: "모든 분석이 완료되었습니다."
}

function getStepProgress(currentStep: string | null): number {
  const steps = ['syntax', 'rules', 'quality', 'analysis', 'complete']
  const currentIndex = currentStep ? steps.indexOf(currentStep) : -1
  return currentIndex >= 0 ? ((currentIndex + 1) / steps.length) * 100 : 0
}

function getStepIcon(step: string, currentStep: string | null, isCompleted: boolean) {
  if (step === currentStep) {
    return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
  } else if (isCompleted) {
    return <CheckCircle className="h-4 w-4 text-green-500" />
  } else {
    return <Clock className="h-4 w-4 text-gray-400" />
  }
}

export function StreamingEvaluationPanel({ streamingState }: StreamingEvaluationPanelProps) {
  const { isStreaming, currentStep, steps, finalResult, error, isFallback } = streamingState

  const progress = getStepProgress(currentStep)

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

  if (!isStreaming && !finalResult && Object.keys(steps).length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500">
        <div className="text-center">
          <Clock className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <p>Streaming 모드로 코드 분석을 시작하세요</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-6 space-y-6">
      {/* Progress Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>분석 진행상황</span>
            <div className="flex gap-2">
              {isFallback && (
                <Badge variant="outline">
                  일반 모드
                </Badge>
              )}
              <Badge variant={isStreaming ? "default" : "secondary"}>
                {isStreaming ? "진행 중" : "완료"}
              </Badge>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={progress} className="mb-4" />
          <div className="space-y-3">
            {Object.entries(stepTitles).map(([step, title]) => {
              const isCompleted = steps[step] && step !== currentStep
              const isCurrent = step === currentStep

              return (
                <div key={step} className="flex items-center gap-3">
                  {getStepIcon(step, currentStep, isCompleted)}
                  <span className={`text-sm ${
                    isCurrent ? 'font-medium text-blue-600' :
                    isCompleted ? 'text-green-600' : 'text-gray-500'
                  }`}>
                    {title}
                  </span>
                  {isCurrent && (
                    <span className="text-xs text-gray-500 ml-auto">
                      {stepDescriptions[step as keyof typeof stepDescriptions]}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Syntax Check Results */}
      {steps.syntax && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              구문 검사 결과
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <Badge variant={steps.syntax.isValid ? "secondary" : "destructive"}>
                {steps.syntax.isValid ? "유효" : "오류"}
              </Badge>
              {steps.syntax.isValid ? (
                <span className="text-green-600">구문 오류가 없습니다</span>
              ) : (
                <span className="text-red-600">구문 오류 발견</span>
              )}
            </div>
            {steps.syntax.errors && steps.syntax.errors.length > 0 && (
              <div className="mt-3">
                <h4 className="font-medium text-red-600 mb-2">오류 목록:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {steps.syntax.errors.map((error: string, index: number) => (
                    <li key={index} className="text-sm text-red-600">{error}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rules Compliance Results */}
      {steps.rules && (
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
              <Badge variant={steps.rules.score >= 70 ? "secondary" : "destructive"}>
                {steps.rules.score}/100
              </Badge>
            </div>

            {steps.rules.findings && steps.rules.findings.length > 0 && (
              <div className="mb-4">
                <h4 className="font-medium mb-2">발견된 문제:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {steps.rules.findings.map((finding: string, index: number) => (
                    <li key={index} className="text-sm text-amber-600">{finding}</li>
                  ))}
                </ul>
              </div>
            )}

            {steps.rules.suggestions && steps.rules.suggestions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">개선 제안:</h4>
                <ul className="list-disc list-inside space-y-1">
                  {steps.rules.suggestions.map((suggestion: string, index: number) => (
                    <li key={index} className="text-sm text-blue-600">{suggestion}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Code Quality Results */}
      {steps.quality && (
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
              <Badge variant={steps.quality.score >= 70 ? "secondary" : "destructive"}>
                {steps.quality.score}/100
              </Badge>
            </div>

            {steps.quality.feedback && (
              <div className="prose prose-sm max-w-none">
                <SafeReactMarkdown
                  fallback="품질 분석 데이터를 불러오는 중입니다..."
                >
                  {getMarkdownContent(steps.quality.feedback)}
                </SafeReactMarkdown>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Detailed Analysis */}
      {steps.analysis && (
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
                {getMarkdownContent(steps.analysis)}
              </SafeReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Final Results */}
      {finalResult && (
        <Card className="border-green-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              분석 완료
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 mb-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {finalResult.syntaxCheck?.isValid ? "✓" : "✗"}
                </div>
                <div className="text-sm text-gray-600">구문 검사</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {finalResult.ruleCompliance?.score || 0}
                </div>
                <div className="text-sm text-gray-600">규칙 준수</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {finalResult.codeQuality?.score || 0}
                </div>
                <div className="text-sm text-gray-600">코드 품질</div>
              </div>
            </div>
            <p className="text-sm text-gray-600 text-center">
              모든 분석이 완료되었습니다. 위의 결과를 참고하여 코드를 개선해보세요.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}