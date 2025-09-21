import { z } from 'zod'

// 기본 검증 결과 스키마
export const ValidationResultSchema = z.object({
  syntaxCheck: z.object({
    isValid: z.boolean(),
    errors: z.array(z.string()).default([]),
  }),
  ruleCompliance: z.object({
    score: z.number().min(0).max(100),
    findings: z.array(z.string()),
    suggestions: z.array(z.string()),
  }),
  codeQuality: z.object({
    score: z.number().min(0).max(100),
    feedback: z.string(),
  }),
  detailedAnalysis: z.string(),
})

// 진행 상태 스키마
export const ProgressStepSchema = z.object({
  type: z.literal('progress'),
  step: z.enum(['initializing', 'syntax', 'rules', 'quality', 'analysis']),
  message: z.string(),
})

// 완료 결과 스키마
export const CompleteResultSchema = z.object({
  type: z.literal('complete'),
  result: ValidationResultSchema,
  recordId: z.string().uuid(),
  duration: z.number().optional(),
})

// 에러 스키마
export const ErrorResultSchema = z.object({
  type: z.literal('error'),
  error: z.string(),
  step: z.string().optional(),
})

// 스트리밍 응답 통합 스키마
export const StreamingResponseSchema = z.discriminatedUnion('type', [
  ProgressStepSchema,
  CompleteResultSchema,
  ErrorResultSchema,
])

// TypeScript 타입 추출
export type ValidationResult = z.infer<typeof ValidationResultSchema>
export type ProgressStep = z.infer<typeof ProgressStepSchema>
export type CompleteResult = z.infer<typeof CompleteResultSchema>
export type ErrorResult = z.infer<typeof ErrorResultSchema>
export type StreamingResponse = z.infer<typeof StreamingResponseSchema>

// 입력 검증 스키마
export const CodeValidationRequestSchema = z.object({
  code: z.string().min(1, '코드는 필수입니다'),
  action: z.enum(['validate', 'improve']).default('validate'),
  userId: z.string().uuid().optional(),
})

export type CodeValidationRequest = z.infer<typeof CodeValidationRequestSchema>

// 검증 히스토리 조회용 스키마
export const ValidationHistoryQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  limit: z.number().min(1).max(100).default(10),
  offset: z.number().min(0).default(0),
  minScore: z.number().min(0).max(100).optional(),
  maxScore: z.number().min(0).max(100).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
})

export type ValidationHistoryQuery = z.infer<typeof ValidationHistoryQuerySchema>