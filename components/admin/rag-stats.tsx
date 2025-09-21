"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Database,
  FileText,
  Code,
  Search,
  RefreshCw,
  BarChart3,
  TrendingUp,
  Clock,
  Star,
  Tag
} from "lucide-react"

interface RAGStatsData {
  totalDocuments: number
  totalExamples: number
  documentTypes: Record<string, number>
  exampleCategories: Record<string, number>
  lastUpdated?: string
}

interface SearchTestResult {
  query: string
  results: Array<{
    id: string
    title: string
    similarity: number
    type: 'document' | 'example'
  }>
  processingTime: number
}

export function RAGStats() {
  const [stats, setStats] = useState<RAGStatsData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 검색 테스트
  const [testQuery, setTestQuery] = useState('브루트포스 공격 탐지')
  const [testResults, setTestResults] = useState<SearchTestResult | null>(null)
  const [isTestingSearch, setIsTestingSearch] = useState(false)

  // 통계 로드
  const loadStats = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/admin/stats')
      if (!response.ok) throw new Error('통계 데이터를 불러오는데 실패했습니다')

      const data = await response.json()
      setStats(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '통계 로드 실패')
    } finally {
      setIsLoading(false)
    }
  }

  // 검색 테스트
  const testSearch = async () => {
    if (!testQuery.trim()) return

    setIsTestingSearch(true)
    try {
      const startTime = Date.now()
      const response = await fetch('/api/admin/test-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, limit: 5 })
      })

      if (!response.ok) throw new Error('검색 테스트 실패')

      const results = await response.json()
      const processingTime = Date.now() - startTime

      setTestResults({
        query: testQuery,
        results,
        processingTime
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색 테스트 실패')
    } finally {
      setIsTestingSearch(false)
    }
  }

  useEffect(() => {
    loadStats()
  }, [])

  if (isLoading && !stats) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">통계를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  const documentTypeLabels = {
    rule: '탐지 규칙',
    'best-practice': '모범 사례',
    example: '예제'
  }

  return (
    <div className="space-y-6">
      {/* 오류 메시지 */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 상단 액션 바 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Database className="h-5 w-5 text-gray-400" />
          <span className="text-sm text-gray-600">
            마지막 업데이트: {stats?.lastUpdated ? new Date(stats.lastUpdated).toLocaleString('ko-KR') : '알 수 없음'}
          </span>
        </div>
        <Button
          variant="outline"
          onClick={loadStats}
          disabled={isLoading}
          className="flex items-center space-x-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>새로고침</span>
        </Button>
      </div>

      {/* 전체 통계 카드 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 문서 수</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalDocuments || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Panther 규칙 문서
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">총 예제 수</CardTitle>
            <Code className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats?.totalExamples || 0}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              Python 코드 예제
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">문서 타입</CardTitle>
            <BarChart3 className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {Object.keys(stats?.documentTypes || {}).length}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              종류의 문서
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">예제 카테고리</CardTitle>
            <Tag className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {Object.keys(stats?.exampleCategories || {}).length}
            </div>
            <p className="text-xs text-gray-600 mt-1">
              종류의 카테고리
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 세부 통계 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 문서 타입 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <FileText className="h-5 w-5" />
              <span>문서 타입 분포</span>
            </CardTitle>
            <CardDescription>타입별 문서 수량</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.documentTypes && Object.keys(stats.documentTypes).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.documentTypes).map(([type, count]) => (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {documentTypeLabels[type as keyof typeof documentTypeLabels] || type}
                      </Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${(count / (stats.totalDocuments || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">문서가 없습니다</p>
            )}
          </CardContent>
        </Card>

        {/* 예제 카테고리 분포 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Code className="h-5 w-5" />
              <span>예제 카테고리 분포</span>
            </CardTitle>
            <CardDescription>카테고리별 예제 수량</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.exampleCategories && Object.keys(stats.exampleCategories).length > 0 ? (
              <div className="space-y-3">
                {Object.entries(stats.exampleCategories).map(([category, count]) => (
                  <div key={category} className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{category}</Badge>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(count / (stats.totalExamples || 1)) * 100}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium w-8 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-4">예제가 없습니다</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* RAG 검색 테스트 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Search className="h-5 w-5" />
            <span>RAG 검색 테스트</span>
          </CardTitle>
          <CardDescription>
            실제 RAG 검색 기능을 테스트하여 시스템 성능을 확인할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex space-x-2">
            <Input
              placeholder="검색할 키워드를 입력하세요..."
              value={testQuery}
              onChange={(e) => setTestQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && testSearch()}
              disabled={isTestingSearch}
            />
            <Button
              onClick={testSearch}
              disabled={isTestingSearch || !testQuery.trim()}
              className="flex items-center space-x-2"
            >
              <Search className={`h-4 w-4 ${isTestingSearch ? 'animate-spin' : ''}`} />
              <span>{isTestingSearch ? '검색 중...' : '검색'}</span>
            </Button>
          </div>

          {testResults && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>검색어: "{testResults.query}"</span>
                <span>처리 시간: {testResults.processingTime}ms</span>
              </div>

              {testResults.results.length > 0 ? (
                <div className="space-y-2">
                  {testResults.results.map((result, index) => (
                    <div key={result.id} className="flex items-center justify-between p-3 border rounded-md">
                      <div className="flex items-center space-x-3">
                        <Badge className="w-6 h-6 rounded-full flex items-center justify-center text-xs">
                          {index + 1}
                        </Badge>
                        <div>
                          <div className="font-medium">{result.title}</div>
                          <div className="text-xs text-gray-500">
                            타입: {result.type === 'document' ? '문서' : '예제'}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Star className="h-4 w-4 text-yellow-500" />
                        <span className="text-sm font-medium">
                          {(result.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">검색 결과가 없습니다</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}