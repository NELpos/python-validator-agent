import { NextRequest } from "next/server"
import { invokeClaudeStream, invokeClaude } from "@/lib/bedrock/client"

interface StreamingValidationStep {
  step: 'syntax' | 'rules' | 'quality' | 'analysis' | 'complete'
  data?: any
  error?: string
}

// 안전한 JSON 추출 함수
function extractJSON(content: string): any {
  console.log('Extracting JSON from content:', content.substring(0, 200) + '...')

  // 첫 번째 { 부터 마지막 } 까지 찾기
  const start = content.indexOf('{')
  const end = content.lastIndexOf('}')

  if (start !== -1 && end !== -1 && end > start) {
    const jsonStr = content.substring(start, end + 1)
    console.log('Attempting to parse JSON:', jsonStr.substring(0, 100) + '...')

    try {
      const parsed = JSON.parse(jsonStr)
      console.log('Successfully parsed JSON:', Object.keys(parsed))
      return parsed
    } catch (e) {
      console.warn('JSON parse failed:', e)
      console.warn('Failed content:', jsonStr.substring(0, 500))

      // JSON 파싱 실패 시 대안 시도
      try {
        // 가능한 JSON 수정 시도 (예: 이스케이프 문제)
        const escapedJson = jsonStr.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t')
        return JSON.parse(escapedJson)
      } catch (e2) {
        console.warn('Alternative JSON parse also failed:', e2)
        return null
      }
    }
  }

  console.warn('No valid JSON boundaries found in content')
  return null
}

// 더 강력한 마커 감지 함수
function findStepMarkers(content: string): { start?: { type: string, index: number }, end?: { type: string, index: number } } {
  const startMatch = content.match(/==STEP_START:(\w+)==/)
  const endMatch = content.match(/==STEP_END:(\w+)==/)

  return {
    start: startMatch ? { type: startMatch[1], index: startMatch.index! } : undefined,
    end: endMatch ? { type: endMatch[1], index: endMatch.index! } : undefined
  }
}

const PANTHER_RULES_CONTEXT = `
You are a Python code validator specializing in Panther detection rules. Your task is to evaluate Python code based on the following criteria:

## Panther Detection Rules Guidelines:
1. Must have a \`rule(event)\` function that returns True for suspicious activity
2. Should include optional alert functions: severity(), title(), dedup(), runbook()
3. Use built-in event object functions: get(), deep_get(), deep_walk()
4. Avoid external API requests within detections
5. Complete execution within 15 seconds
6. Use unified data model (UDM) fields when possible
7. Handle nested and complex event structures safely
8. Include comprehensive unit tests
9. Provide clear, actionable context in alerts

## Evaluation Criteria:
- Precision and targeting of detection logic
- Performance and efficiency
- Code readability and maintainability
- Proper error handling
- Documentation and comments
- Security best practices
`

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { code, action = "validate" } = body

    if (!code) {
      return new Response(
        JSON.stringify({ error: "Code is required" }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        try {
          // Send initial step
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              step: 'syntax',
              data: { message: '통합 분석을 시작합니다...' }
            })}\n\n`)
          )

          // Create a unified prompt for streaming analysis
          const unifiedPrompt = {
            messages: [
              {
                role: "user" as const,
                content: `Analyze the following Python detection rule code step by step. Provide a streaming response that includes each analysis step clearly marked.

For each step, output the result in this exact format:
==STEP_START:syntax==
{"syntaxCheck": {"isValid": boolean, "errors": ["array of error messages if any"]}}
==STEP_END:syntax==

==STEP_START:rules==
{"ruleCompliance": {"score": number (0-100), "findings": ["array of issues"], "suggestions": ["array of improvements"]}}
==STEP_END:rules==

==STEP_START:quality==
{"codeQuality": {"score": number (0-100), "feedback": "markdown formatted feedback"}}
==STEP_END:quality==

==STEP_START:analysis==
{"detailedAnalysis": "comprehensive markdown analysis"}
==STEP_END:analysis==

Please provide all text content (error messages, findings, suggestions, feedback, analysis) in Korean language.

Code to analyze:
\`\`\`python
${code}
\`\`\`

Begin the analysis now, providing each step's result as you complete it.`,
              },
            ],
            system: PANTHER_RULES_CONTEXT,
            temperature: 0.3,
            max_tokens: 8192,
          }

          let currentStep = ''
          let streamingContent = ''
          let processedSteps = new Set<string>()

          try {
            for await (const chunk of invokeClaudeStream(unifiedPrompt)) {
              streamingContent += chunk
              console.log('Current streaming content length:', streamingContent.length)

              // 현재 스트림에서 마커들 찾기
              const markers = findStepMarkers(streamingContent)

              // 새로운 단계 시작 감지
              if (markers.start && !currentStep && !processedSteps.has(markers.start.type)) {
                currentStep = markers.start.type
                console.log(`Starting step: ${currentStep}`)

                // Send step start notification
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({
                    step: currentStep,
                    data: { message: getStepMessage(currentStep) }
                  })}\n\n`)
                )

                // 시작 마커 제거
                streamingContent = streamingContent.substring(markers.start.index + `==STEP_START:${currentStep}==`.length)
              }

              // 단계 완료 감지
              if (markers.end && currentStep && markers.end.type === currentStep) {
                console.log(`Ending step: ${currentStep}`)

                // 마커 전까지의 내용 추출
                const endMarkerIndex = streamingContent.indexOf(`==STEP_END:${currentStep}==`)
                const stepContent = streamingContent.substring(0, endMarkerIndex).trim()
                console.log(`Step ${currentStep} content:`, stepContent.substring(0, 200) + '...')

                // JSON 추출 및 파싱
                const stepData = extractJSON(stepContent)

                if (stepData) {
                  // Send the parsed data for this step
                  if (currentStep === 'syntax' && stepData.syntaxCheck) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        step: currentStep,
                        data: stepData.syntaxCheck
                      })}\n\n`)
                    )
                  } else if (currentStep === 'rules' && stepData.ruleCompliance) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        step: currentStep,
                        data: stepData.ruleCompliance
                      })}\n\n`)
                    )
                  } else if (currentStep === 'quality' && stepData.codeQuality) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        step: currentStep,
                        data: stepData.codeQuality
                      })}\n\n`)
                    )
                  } else if (currentStep === 'analysis' && stepData.detailedAnalysis) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        step: currentStep,
                        data: stepData.detailedAnalysis
                      })}\n\n`)
                    )
                  } else {
                    console.warn(`No expected data field found for step ${currentStep}:`, Object.keys(stepData))

                    // 복구 시도: raw 데이터 전송
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({
                        step: currentStep,
                        data: stepData,
                        fallback: true
                      })}\n\n`)
                    )
                  }
                } else {
                  console.warn(`Failed to extract JSON for step ${currentStep}, sending raw content`)

                  // JSON 파싱 실패 시 원본 텍스트 전송
                  controller.enqueue(
                    encoder.encode(`data: ${JSON.stringify({
                      step: currentStep,
                      data: stepContent,
                      raw: true
                    })}\n\n`)
                  )
                }

                // 단계 완료 처리
                processedSteps.add(currentStep)
                streamingContent = streamingContent.substring(endMarkerIndex + `==STEP_END:${currentStep}==`.length)
                currentStep = ''
              }
            }

            // Send completion signal
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({
                step: 'complete',
                data: { message: '분석이 완료되었습니다.' }
              })}\n\n`)
            )

          } catch (streamError) {
            console.error("Streaming error:", streamError)

            // If streaming fails, fall back to the original API
            if (streamError instanceof Error &&
                (streamError.message.includes("Rate limit exceeded") ||
                 streamError.message.includes("ThrottlingException"))) {

              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({
                  step: 'error',
                  error: 'Rate limit reached. Switching to standard mode...',
                  fallback: true
                })}\n\n`)
              )
            } else {
              throw streamError
            }
          }

          controller.close()
        } catch (error) {
          console.error("Streaming validation error:", error)
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({
              step: 'error',
              error: error instanceof Error ? error.message : 'Unknown error occurred',
              fallback: true
            })}\n\n`)
          )
          controller.close()
        }
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
    console.error("Validation API error:", error)
    return new Response(
      JSON.stringify({ error: "Failed to process request" }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}

function getStepMessage(step: string): string {
  const messages = {
    syntax: '구문 검사를 수행하고 있습니다...',
    rules: 'Panther 규칙 준수성을 분석하고 있습니다...',
    quality: '코드 품질을 평가하고 있습니다...',
    analysis: '상세 분석을 수행하고 있습니다...'
  }
  return messages[step as keyof typeof messages] || '분석 중입니다...'
}