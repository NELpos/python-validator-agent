import { useState, useCallback, useRef } from 'react'
import { type ValidationResult } from '@/lib/schemas/validation'

export interface ProgressStep {
  key: string
  message: string
  timestamp: number
}

export interface StructuredValidationState {
  isValidating: boolean
  currentStep: string | null
  progressSteps: ProgressStep[]
  result: ValidationResult | null
  recordId: string | null
  duration: number | null
  error: string | null
}

export function useStructuredValidation() {
  const [state, setState] = useState<StructuredValidationState>({
    isValidating: false,
    currentStep: null,
    progressSteps: [],
    result: null,
    recordId: null,
    duration: null,
    error: null,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const startValidation = useCallback(async (
    code: string,
    action: 'validate' | 'improve' = 'validate',
    userId?: string
  ) => {
    // Reset state
    setState({
      isValidating: true,
      currentStep: null,
      progressSteps: [],
      result: null,
      recordId: null,
      duration: null,
      error: null,
    })

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/validate-structured', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, action, userId }),
        signal: abortControllerRef.current.signal,
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      if (!response.body) {
        throw new Error('No response body')
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()

        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.type === 'progress') {
                setState(prev => ({
                  ...prev,
                  currentStep: data.step,
                  progressSteps: [
                    ...prev.progressSteps,
                    {
                      key: data.step,
                      message: data.message,
                      timestamp: Date.now(),
                    },
                  ],
                }))
              } else if (data.type === 'complete') {
                setState(prev => ({
                  ...prev,
                  isValidating: false,
                  currentStep: 'complete',
                  result: data.result,
                  recordId: data.recordId,
                  duration: data.duration,
                }))
              } else if (data.type === 'error') {
                setState(prev => ({
                  ...prev,
                  isValidating: false,
                  currentStep: data.step,
                  error: data.error,
                }))
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE data:', line)
            }
          }
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setState(prev => ({
          ...prev,
          isValidating: false,
          error: 'Validation was cancelled',
        }))
      } else {
        setState(prev => ({
          ...prev,
          isValidating: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        }))
      }
    }
  }, [])

  const cancelValidation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isValidating: false,
      currentStep: null,
      progressSteps: [],
      result: null,
      recordId: null,
      duration: null,
      error: null,
    })
  }, [])

  return {
    ...state,
    startValidation,
    cancelValidation,
    reset,
  }
}