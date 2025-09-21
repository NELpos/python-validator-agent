"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Edit, Trash2, Code, Calendar, Star, RefreshCw, Tag } from "lucide-react"

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

interface ExampleListProps {
  examples: CodeExample[]
  isLoading: boolean
  onEdit: (example: CodeExample) => void
  onDelete: (exampleId: string) => void
  onRefresh: () => void
}

export function ExampleList({ examples, isLoading, onEdit, onDelete, onRefresh }: ExampleListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterQuality, setFilterQuality] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'created' | 'title' | 'quality' | 'category'>('quality')

  // 카테고리 목록 추출
  const categories = React.useMemo(() => {
    const cats = new Set(examples.map(ex => ex.category).filter(Boolean))
    return Array.from(cats).sort()
  }, [examples])

  // 필터링 및 정렬
  const filteredAndSortedExamples = React.useMemo(() => {
    let filtered = examples.filter(example => {
      const matchesSearch = example.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           example.codeContent.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (example.description && example.description.toLowerCase().includes(searchTerm.toLowerCase())) ||
                           (example.tags && example.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))

      const matchesCategory = filterCategory === 'all' || example.category === filterCategory

      const matchesQuality = filterQuality === 'all' ||
        (filterQuality === 'high' && example.qualityScore >= 80) ||
        (filterQuality === 'medium' && example.qualityScore >= 60 && example.qualityScore < 80) ||
        (filterQuality === 'low' && example.qualityScore < 60)

      return matchesSearch && matchesCategory && matchesQuality
    })

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'category':
          return (a.category || '').localeCompare(b.category || '')
        case 'quality':
          return b.qualityScore - a.qualityScore // 높은 점수부터
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return filtered
  }, [examples, searchTerm, filterCategory, filterQuality, sortBy])

  const getQualityBadge = (score: number) => {
    if (score >= 90) return { label: '최고', color: 'bg-emerald-100 text-emerald-800' }
    if (score >= 80) return { label: '고품질', color: 'bg-green-100 text-green-800' }
    if (score >= 60) return { label: '중품질', color: 'bg-yellow-100 text-yellow-800' }
    return { label: '저품질', color: 'bg-red-100 text-red-800' }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getCodePreview = (code: string, maxLength: number = 200) => {
    // 주석과 공백 제거하여 핵심 코드만 표시
    const cleaned = code
      .replace(/^\s*#.*$/gm, '') // 주석 제거
      .replace(/^\s*"""[\s\S]*?"""/gm, '') // 독스트링 제거
      .replace(/\n\s*\n/g, '\n') // 빈 줄 제거
      .trim()

    return cleaned.length > maxLength ? cleaned.slice(0, maxLength) + '...' : cleaned
  }

  if (isLoading && examples.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">예제를 불러오는 중...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* 검색 및 필터 */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="제목, 코드, 설명, 태그로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="w-32">
                  <SelectValue placeholder="카테고리" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 카테고리</SelectItem>
                  {categories.map(category => (
                    <SelectItem key={category} value={category}>{category}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterQuality} onValueChange={setFilterQuality}>
                <SelectTrigger className="w-24">
                  <SelectValue placeholder="품질" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 품질</SelectItem>
                  <SelectItem value="high">고품질 (80+)</SelectItem>
                  <SelectItem value="medium">중품질 (60-79)</SelectItem>
                  <SelectItem value="low">저품질 (60미만)</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="quality">품질순</SelectItem>
                  <SelectItem value="created">최신순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                  <SelectItem value="category">카테고리순</SelectItem>
                </SelectContent>
              </Select>

              <Button variant="outline" size="icon" onClick={onRefresh} disabled={isLoading}>
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* 결과 요약 */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>
          {filteredAndSortedExamples.length}개의 예제
          {searchTerm && ` (전체 ${examples.length}개 중)`}
        </span>
        {searchTerm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchTerm('')}
            className="text-xs"
          >
            검색 초기화
          </Button>
        )}
      </div>

      {/* 예제 목록 */}
      <div className="space-y-4">
        {filteredAndSortedExamples.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Code className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? '검색 결과가 없습니다' : '예제가 없습니다'}
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {searchTerm
                  ? '다른 검색어를 시도하거나 필터를 변경해보세요.'
                  : '새 예제를 추가하여 Few-shot 학습을 향상시켜보세요.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedExamples.map((example) => {
            const qualityBadge = getQualityBadge(example.qualityScore)

            return (
              <Card key={example.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-2">
                        <CardTitle className="text-lg truncate">{example.title}</CardTitle>
                        <Badge className={qualityBadge.color}>
                          <Star className="h-3 w-3 mr-1" />
                          {example.qualityScore}점
                        </Badge>
                        {example.category && (
                          <Badge variant="outline" className="text-xs">
                            {example.category}
                          </Badge>
                        )}
                      </div>

                      {example.description && (
                        <CardDescription className="text-sm text-gray-600 mb-2">
                          {example.description}
                        </CardDescription>
                      )}

                      {example.tags && example.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {example.tags.slice(0, 5).map((tag, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              <Tag className="h-2 w-2 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                          {example.tags.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{example.tags.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center space-x-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEdit(example)}
                        className="flex items-center space-x-1"
                      >
                        <Edit className="h-3 w-3" />
                        <span>편집</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(example.id)}
                        className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>삭제</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-0">
                  {/* 코드 미리보기 */}
                  <div className="bg-gray-50 rounded-md p-3 mb-3">
                    <pre className="text-xs text-gray-700 font-mono overflow-x-auto">
                      {getCodePreview(example.codeContent)}
                    </pre>
                  </div>

                  {/* 메타데이터 */}
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center space-x-1">
                        <Calendar className="h-3 w-3" />
                        <span>{formatDate(example.createdAt)}</span>
                      </span>
                      <span>
                        {example.codeContent.split('\n').length} 라인
                      </span>
                    </div>
                    <span className="text-gray-400">ID: {example.id.slice(0, 8)}...</span>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}