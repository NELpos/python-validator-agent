import { NextRequest } from 'next/server'
import { invokeClaude } from '@/lib/bedrock/client'
import {
  EnhancedValidationResultSchema,
  EnhancedCodeValidationRequestSchema,
  type EnhancedValidationResult,
  type DocumentReference,
  type ExampleReference
} from '@/lib/schemas/validation'
import { RAGEngine } from '@/lib/knowledge/rag-engine'
import { db, schema } from '@/lib/db'
import { validationDocumentReferences, validationExampleReferences } from '@/lib/db/schema'

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  try {
    // 요청 검증
    const body = await request.json()
    const {
      code,
      action,
      userId,
      ragEnabled,
      includeExamples,
      maxDocuments,
      maxExamples
    } = EnhancedCodeValidationRequestSchema.parse(body)

    const stream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now()

        try {
          // 진행 상태 전송
          const sendProgress = (step: string, message: string) => {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({
              type: 'progress',
              step,
              message
            })}\n\n`))
          }

          // 1. RAG 컨텍스트 구축
          sendProgress('rag', 'RAG 컨텍스트를 구성하고 있습니다...')

          let ragContext = null
          let enhancedPrompt = ''

          if (ragEnabled) {
            const ragEngine = new RAGEngine()

            // Panther 규칙 특화 검색 실행
            ragContext = await ragEngine.buildEnhancedContext(code)
            enhancedPrompt = ragContext.enhancedPrompt

            sendProgress('documents', `Panther 규칙 문서 ${ragContext.relevantDocuments.length}개를 찾았습니다...`)

            // 규칙 준수성 컨텍스트 구축
            const complianceContext = ragEngine.buildRuleComplianceContext(code, ragContext.relevantDocuments)

            // 추가 메타데이터 정보 포함
            ragContext.complianceContext = complianceContext

            if (includeExamples) {
              sendProgress('examples', `유사 코드 예제 ${ragContext.similarExamples.length}개를 찾았습니다...`)
            }

            // 규칙 준수성 예상 점수 미리 계산
            if (complianceContext.complianceScore < 70) {
              sendProgress('compliance', `규칙 준수성 검증 중... (예상 점수: ${complianceContext.complianceScore}점)`)
            }
          } else {
            // RAG 비활성화 시 기본 프롬프트 사용
            enhancedPrompt = `당신은 Panther 탐지 규칙을 전문으로 하는 Python 코드 검증자입니다.

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
          }

          // 2. 단계별 분석 진행
          const steps = [
            { key: 'syntax', message: '구문 검사를 수행합니다...', delay: 400 },
            { key: 'rules', message: 'Panther 규칙 준수성을 분석합니다...', delay: 500 },
            { key: 'quality', message: '코드 품질을 평가합니다...', delay: 400 },
            { key: 'analysis', message: '종합 분석을 수행합니다...', delay: 600 }
          ]

          for (const step of steps) {
            sendProgress(step.key, step.message)
            await new Promise(resolve => setTimeout(resolve, step.delay))
          }

          // 3. Claude에게 강화된 프롬프트로 요청
          const userPrompt = `다음 Python 탐지 규칙 코드를 분석하고 JSON 형식으로 결과를 반환하세요.

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

          // Claude 호출
          const response = await invokeClaude({
            messages: [{
              role: "user",
              content: userPrompt
            }],
            system: enhancedPrompt,
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

          const baseResult = JSON.parse(jsonResponse)

          // 4. RAG 정보를 포함한 강화된 결과 구성
          const enhancedResult: EnhancedValidationResult = {
            ...baseResult,
            documentReferences: ragContext?.relevantDocuments.map(doc => ({
              id: doc.id,
              title: doc.title,
              section: doc.section,
              relevanceScore: doc.similarity,
              content: doc.content.slice(0, 500), // UI 표시용으로 축약
              documentType: doc.documentType
            })) || [],
            similarExamples: ragContext?.similarExamples.map(example => ({
              id: example.id,
              title: example.title,
              similarity: example.similarity,
              qualityScore: example.qualityScore,
              category: example.category,
              improvements: generateImprovements(baseResult, example),
              codeSnippet: example.codeContent.slice(0, 300) // UI 표시용으로 축약
            })) || [],
            ragMetadata: {
              documentsFound: ragContext?.relevantDocuments.length || 0,
              examplesFound: ragContext?.similarExamples.length || 0,
              queryProcessingTime: ragContext?.searchMetadata.queryProcessingTime || 0,
              ragEnabled
            }
          }

          // Zod로 결과 검증
          const validatedResult = EnhancedValidationResultSchema.parse(enhancedResult)

          // 5. 데이터베이스에 저장
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

          // 6. RAG 참조 정보 저장
          if (ragEnabled && validatedResult.documentReferences.length > 0) {
            const docRefs = validatedResult.documentReferences.map(ref => ({
              validationId: savedRecord.id,
              documentId: ref.id,
              relevanceScore: ref.relevanceScore,
              usageContext: 'rag-enhanced-validation'
            }))

            await db.insert(validationDocumentReferences).values(docRefs)
          }

          if (ragEnabled && includeExamples && validatedResult.similarExamples.length > 0) {
            const exampleRefs = validatedResult.similarExamples.map(ref => ({
              validationId: savedRecord.id,
              exampleId: ref.id,
              similarityScore: ref.similarity,
              improvements: ref.improvements
            }))

            await db.insert(validationExampleReferences).values(exampleRefs)
          }

          // 7. 완료 응답 전송
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'complete',
            result: validatedResult,
            recordId: savedRecord.id,
            duration: Date.now() - startTime
          })}\n\n`))

        } catch (error) {
          console.error('RAG validation error:', error)

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

// 도우미 함수: 예제 기반 개선사항 생성
function generateImprovements(result: any, example: any): string[] {
  const improvements: string[] = []

  if (result.ruleCompliance?.score < example.qualityScore) {
    improvements.push('규칙 준수성 개선 필요')
  }

  if (result.codeQuality?.score < example.qualityScore) {
    improvements.push('코드 품질 개선 필요')
  }

  if (example.category) {
    improvements.push(`${example.category} 카테고리 모범 사례 참고`)
  }

  return improvements.length > 0 ? improvements : ['전반적인 구조 개선 참고']
}