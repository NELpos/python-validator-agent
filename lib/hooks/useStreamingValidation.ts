import { useState, useCallback, useRef } from 'react'

export interface ValidationStep {
  step: 'syntax' | 'rules' | 'quality' | 'analysis' | 'complete' | 'error'
  data?: any
  error?: string
}

export interface StreamingValidationState {
  isStreaming: boolean
  currentStep: string | null
  steps: Record<string, any>
  finalResult: any
  error: string | null
  isFallback: boolean
}

export function useStreamingValidation() {
  const [state, setState] = useState<StreamingValidationState>({
    isStreaming: false,
    currentStep: null,
    steps: {},
    finalResult: null,
    error: null,
    isFallback: false,
  })

  const abortControllerRef = useRef<AbortController | null>(null)

  const startValidation = useCallback(async (code: string, action: 'validate' | 'improve' = 'validate') => {
    // Reset state
    setState({
      isStreaming: true,
      currentStep: null,
      steps: {},
      finalResult: null,
      error: null,
      isFallback: false,
    })

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController()

    try {
      const response = await fetch('/api/validate-stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, action }),
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
              const data = JSON.parse(line.slice(6)) as ValidationStep & { fallback?: boolean }

              setState(prev => ({
                ...prev,
                currentStep: data.step,
                steps: {
                  ...prev.steps,
                  [data.step]: data.data,
                },
                ...(data.step === 'complete' && { finalResult: data.data }),
                ...(data.step === 'error' && {
                  error: data.error,
                  isFallback: data.fallback || false
                }),
              }))

              // If fallback is needed, switch to regular API
              if (data.step === 'error' && data.fallback) {
                console.log('Switching to fallback mode...')
                await handleFallback(code, action)
                return
              }

              if (data.step === 'complete' || data.step === 'error') {
                setState(prev => ({ ...prev, isStreaming: false }))
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
          isStreaming: false,
          error: 'Validation was cancelled',
        }))
      } else {
        setState(prev => ({
          ...prev,
          isStreaming: false,
          error: error instanceof Error ? error.message : 'An error occurred',
        }))
      }
    }
  }, [])

  const handleFallback = useCallback(async (code: string, action: 'validate' | 'improve') => {
    try {
      setState(prev => ({
        ...prev,
        isFallback: true,
        currentStep: 'fallback',
        error: null,
      }))

      const response = await fetch('/api/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, action }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const result = await response.json()

      setState(prev => ({
        ...prev,
        isStreaming: false,
        finalResult: result,
        currentStep: 'complete',
        steps: {
          syntax: result.syntaxCheck,
          rules: result.ruleCompliance,
          quality: result.codeQuality,
          analysis: result.detailedAnalysis,
        },
      }))
    } catch (error) {
      setState(prev => ({
        ...prev,
        isStreaming: false,
        error: error instanceof Error ? error.message : 'Fallback failed',
      }))
    }
  }, [])

  const cancelValidation = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      isStreaming: false,
      currentStep: null,
      steps: {},
      finalResult: null,
      error: null,
      isFallback: false,
    })
  }, [])

  return {
    ...state,
    startValidation,
    cancelValidation,
    reset,
  }
}