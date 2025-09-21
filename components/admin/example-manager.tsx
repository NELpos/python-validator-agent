"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ExampleEditor } from "./example-editor"
import { ExampleList } from "./example-list"
import { Plus, Code, Star } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface CodeExample {
  id: string
  title: string
  codeContent: string
  qualityScore: number
  category?: string
  description?: string
  tags?: string[]
  createdAt: string
}

export function ExampleManager() {
  const [activeView, setActiveView] = useState<'list' | 'create' | 'edit'>('list')
  const [examples, setExamples] = useState<CodeExample[]>([])
  const [selectedExample, setSelectedExample] = useState<CodeExample | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // 예제 목록 로드
  const loadExamples = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/admin/examples')
      if (!response.ok) throw new Error('예제 목록을 불러오는데 실패했습니다')
      const data = await response.json()
      setExamples(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '예제 목록 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 예제 저장
  const handleSaveExample = async (exampleData: {
    title: string
    codeContent: string
    qualityScore: number
    category?: string
    description?: string
    tags?: string[]
  }) => {
    setIsLoading(true)
    setError(null)

    try {
      const url = selectedExample
        ? `/api/admin/examples/${selectedExample.id}`
        : '/api/admin/examples'
      const method = selectedExample ? 'PUT' : 'POST'

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(exampleData)
      })

      if (!response.ok) throw new Error('예제 저장에 실패했습니다')

      const savedExample = await response.json()

      if (selectedExample) {
        setExamples(examples => examples.map(ex =>
          ex.id === savedExample.id ? savedExample : ex
        ))
        setSuccess('예제가 성공적으로 수정되었습니다')
      } else {
        setExamples(examples => [...examples, savedExample])
        setSuccess('새 예제가 성공적으로 추가되었습니다')
      }

      setActiveView('list')
      setSelectedExample(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : '예제 저장 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 예제 삭제
  const handleDeleteExample = async (exampleId: string) => {
    if (!confirm('정말로 이 예제를 삭제하시겠습니까?')) return

    setIsLoading(true)
    try {
      const response = await fetch(`/api/admin/examples/${exampleId}`, {
        method: 'DELETE'
      })

      if (!response.ok) throw new Error('예제 삭제에 실패했습니다')

      setExamples(examples => examples.filter(ex => ex.id !== exampleId))
      setSuccess('예제가 성공적으로 삭제되었습니다')
    } catch (err) {
      setError(err instanceof Error ? err.message : '예제 삭제 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 예제 편집
  const handleEditExample = (example: CodeExample) => {
    setSelectedExample(example)
    setActiveView('edit')
  }

  // 새 예제 생성
  const handleCreateNew = () => {
    setSelectedExample(null)
    setActiveView('create')
  }

  useEffect(() => {
    loadExamples()
  }, [])

  // 알림 자동 제거
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null)
        setError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [success, error])

  // 품질 통계 계산
  const qualityStats = React.useMemo(() => {
    if (examples.length === 0) return { average: 0, high: 0, medium: 0, low: 0 }

    const average = examples.reduce((sum, ex) => sum + ex.qualityScore, 0) / examples.length
    const high = examples.filter(ex => ex.qualityScore >= 80).length
    const medium = examples.filter(ex => ex.qualityScore >= 60 && ex.qualityScore < 80).length
    const low = examples.filter(ex => ex.qualityScore < 60).length

    return { average: Math.round(average), high, medium, low }
  }, [examples])

  return (
    <div className="space-y-6">
      {/* 알림 메시지 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <AlertDescription className="text-green-600">{success}</AlertDescription>
        </Alert>
      )}

      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          {activeView !== 'list' && (
            <Button
              variant="outline"
              onClick={() => {
                setActiveView('list')
                setSelectedExample(null)
              }}
            >
              ← 목록으로
            </Button>
          )}

          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-2">
              <Code className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-600">
                총 {examples.length}개 예제
              </span>
            </div>

            {examples.length > 0 && (
              <div className="flex items-center space-x-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <span className="text-sm text-gray-600">
                  평균 품질: {qualityStats.average}점
                </span>
              </div>
            )}
          </div>
        </div>

        {activeView === 'list' && (
          <Button onClick={handleCreateNew} className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>새 예제 추가</span>
          </Button>
        )}
      </div>

      {/* 품질 통계 */}
      {activeView === 'list' && examples.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">품질 분포</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex space-x-4">
              <div className="flex items-center space-x-2">
                <Badge className="bg-green-100 text-green-800">고품질 (80+)</Badge>
                <span className="text-sm text-gray-600">{qualityStats.high}개</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-yellow-100 text-yellow-800">중품질 (60-79)</Badge>
                <span className="text-sm text-gray-600">{qualityStats.medium}개</span>
              </div>
              <div className="flex items-center space-x-2">
                <Badge className="bg-red-100 text-red-800">저품질 (60미만)</Badge>
                <span className="text-sm text-gray-600">{qualityStats.low}개</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 메인 컨텐츠 */}
      {activeView === 'list' && (
        <ExampleList
          examples={examples}
          isLoading={isLoading}
          onEdit={handleEditExample}
          onDelete={handleDeleteExample}
          onRefresh={loadExamples}
        />
      )}

      {(activeView === 'create' || activeView === 'edit') && (
        <ExampleEditor
          example={selectedExample}
          onSave={handleSaveExample}
          onCancel={() => {
            setActiveView('list')
            setSelectedExample(null)
          }}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}