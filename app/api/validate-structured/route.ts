import { NextRequest } from 'next/server'
import { invokeClaude } from '@/lib/bedrock/client'
import {
  ValidationResultSchema,
  CodeValidationRequestSchema,
  type ValidationResult
} from '@/lib/schemas/validation'
import { db, schema } from '@/lib/db'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    // 요청 검증
    const body = await request.json()
    const { code, action, userId } = CodeValidationRequestSchema.parse(body)

    const stream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now()

        try {
          // 단계별 진행 상태 전송
          const steps = [
            { key: 'initializing', message: '분석을 시작합니다...', delay: 300 },
            { key: 'syntax', message: '구문 검사를 수행합니다...', delay: 400 },
            { key: 'rules', message: 'Panther 규칙 준수성을 분석합니다...', delay: 500 },
            { key: 'quality', message: '코드 품질을 평가합니다...', delay: 400 },
            { key: 'analysis', message: '상세 분석을 수행합니다...', delay: 600 }
          ]

          // 진행 상태 단계별 전송
          for (const step of steps) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              step: step.key,
              message: step.message
            })}\n\n`))

            await new Promise(resolve => setTimeout(resolve, step.delay))
          }

          // Claude에게 구조화된 응답 요청
          const prompt = `다음 Python 탐지 규칙 코드를 분석하고 JSON 형식으로 결과를 반환하세요.

정확히 다음 JSON 구조로 응답해주세요:

{
  "syntaxCheck": {
    "isValid": boolean,
    "errors": ["구문 오류 메시지들 (한국어)"]
  },
  "ruleCompliance": {
    "score": number (0-100),
    "findings": ["발견된 문제점들 (한국어)"],
    "suggestions": ["개선 제안사항들 (한국어)"]
  },
  "codeQuality": {
    "score": number (0-100),
    "feedback": "상세한 피드백 (마크다운 형식, 한국어)"
  },
  "detailedAnalysis": "포괄적인 분석 내용 (마크다운 형식, 한국어)"
}

분석할 코드:
\`\`\`python
${code}
\`\`\`

JSON 객체만 반환하고 다른 텍스트는 포함하지 마세요.`

          const systemPrompt = `당신은 Panther 탐지 규칙을 전문으로 하는 Python 코드 검증자입니다.

다음 기준으로 코드를 평가하세요:

## Panther 탐지 규칙 가이드라인:
1. rule(event) 함수가 있어야 하며 의심 활동 시 True를 반환해야 함
2. 선택적 알림 함수들: severity(), title(), dedup(), runbook()
3. 내장 이벤트 객체 함수 사용: get(), deep_get(), deep_walk()
4. 탐지 내에서 외부 API 요청 금지
5. 15초 내 실행 완료
6. 가능한 경우 통합 데이터 모델(UDM) 필드 사용
7. 중첩되고 복잡한 이벤트 구조 안전 처리
8. 포괄적인 단위 테스트 포함
9. 알림에서 명확하고 실행 가능한 컨텍스트 제공

## 평가 기준:
- 탐지 로직의 정확성과 대상 지정
- 성능과 효율성
- 코드 가독성과 유지보수성
- 적절한 오류 처리
- 문서화와 주석
- 보안 모범 사례

모든 응답은 한국어로 작성하고 JSON 형식만 반환하세요.`

          // Claude 호출
          const response = await invokeClaude({
            messages: [{
              role: "user",
              content: prompt
            }],
            system: systemPrompt,
            temperature: 0.3,
            max_tokens: 8192
          })

          // JSON 추출 및 검증
          let jsonResponse: string
          const jsonMatch = response.match(/\{[\s\S]*\}/)
          if (jsonMatch) {
            jsonResponse = jsonMatch[0]
          } else {
            jsonResponse = response.trim()
          }

          // Zod로 응답 검증
          const validatedResult: ValidationResult = ValidationResultSchema.parse(
            JSON.parse(jsonResponse)
          )

          // 데이터베이스에 저장
          const [savedRecord] = await db.insert(schema.codeValidations).values({
            userId: userId || null,
            codeContent: code,
            syntaxIsValid: validatedResult.syntaxCheck.isValid,
            syntaxErrors: validatedResult.syntaxCheck.errors,
            ruleComplianceScore: validatedResult.ruleCompliance.score,
            ruleFindings: validatedResult.ruleCompliance.findings,
            ruleSuggestions: validatedResult.ruleCompliance.suggestions,
            codeQualityScore: validatedResult.codeQuality.score,
            codeQualityFeedback: validatedResult.codeQuality.feedback,
            detailedAnalysis: validatedResult.detailedAnalysis,
            totalDurationMs: Date.now() - startTime,
            modelUsed: process.env.BEDROCK_MODEL_ID || "claude-3-sonnet",
          }).returning()

          // 완료 응답 전송
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            result: validatedResult,
            recordId: savedRecord.id,
            duration: Date.now() - startTime
          })}\n\n`))

        } catch (error) {
          console.error('Structured validation error:', error)

          const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            error: errorMessage,
            step: 'analysis'
          })}\n\n`))
        }

        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })

  } catch (error) {
    console.error('Request validation error:', error)

    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Invalid request format'
      }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}