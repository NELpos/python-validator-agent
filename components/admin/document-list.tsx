"use client"

import React, { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Search, Edit, Trash2, FileText, Calendar, Filter, RefreshCw } from "lucide-react"

interface Document {
  id: string
  title: string
  content: string
  section?: string
  documentType: 'rule' | 'best-practice' | 'example'
  metadata?: any
  createdAt: string
}

interface DocumentListProps {
  documents: Document[]
  isLoading: boolean
  onEdit: (document: Document) => void
  onDelete: (documentId: string) => void
  onRefresh: () => void
}

export function DocumentList({ documents, isLoading, onEdit, onDelete, onRefresh }: DocumentListProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [filterType, setFilterType] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'created' | 'title' | 'type'>('created')

  // 필터링 및 정렬
  const filteredAndSortedDocuments = React.useMemo(() => {
    let filtered = documents.filter(doc => {
      const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           doc.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (doc.section && doc.section.toLowerCase().includes(searchTerm.toLowerCase()))

      const matchesType = filterType === 'all' || doc.documentType === filterType

      return matchesSearch && matchesType
    })

    // 정렬
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'type':
          return a.documentType.localeCompare(b.documentType)
        case 'created':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
    })

    return filtered
  }, [documents, searchTerm, filterType, sortBy])

  const documentTypeLabels = {
    rule: '탐지 규칙',
    'best-practice': '모범 사례',
    example: '예제'
  }

  const documentTypeColors = {
    rule: 'bg-blue-100 text-blue-800',
    'best-practice': 'bg-green-100 text-green-800',
    example: 'bg-purple-100 text-purple-800'
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

  const getContentPreview = (content: string, maxLength: number = 150) => {
    const plainText = content.replace(/[#*`]/g, '').replace(/\n+/g, ' ').trim()
    return plainText.length > maxLength ? plainText.slice(0, maxLength) + '...' : plainText
  }

  if (isLoading && documents.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          <p className="text-gray-500">문서를 불러오는 중...</p>
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
                placeholder="문서 제목, 내용, 섹션으로 검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <div className="flex gap-2">
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="타입 필터" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">모든 타입</SelectItem>
                  <SelectItem value="rule">탐지 규칙</SelectItem>
                  <SelectItem value="best-practice">모범 사례</SelectItem>
                  <SelectItem value="example">예제</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">최신순</SelectItem>
                  <SelectItem value="title">제목순</SelectItem>
                  <SelectItem value="type">타입순</SelectItem>
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
          {filteredAndSortedDocuments.length}개의 문서
          {searchTerm && ` (전체 ${documents.length}개 중)`}
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

      {/* 문서 목록 */}
      <div className="space-y-4">
        {filteredAndSortedDocuments.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchTerm ? '검색 결과가 없습니다' : '문서가 없습니다'}
              </h3>
              <p className="text-gray-500 text-center max-w-md">
                {searchTerm
                  ? '다른 검색어를 시도하거나 필터를 변경해보세요.'
                  : '새 문서를 추가하여 RAG 시스템을 향상시켜보세요.'
                }
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredAndSortedDocuments.map((document) => (
            <Card key={document.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-2">
                      <CardTitle className="text-lg truncate">{document.title}</CardTitle>
                      <Badge className={documentTypeColors[document.documentType]}>
                        {documentTypeLabels[document.documentType]}
                      </Badge>
                    </div>

                    {document.section && (
                      <CardDescription className="text-sm text-gray-600 mb-2">
                        📁 {document.section}
                      </CardDescription>
                    )}

                    <CardDescription className="text-sm">
                      {getContentPreview(document.content)}
                    </CardDescription>
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEdit(document)}
                      className="flex items-center space-x-1"
                    >
                      <Edit className="h-3 w-3" />
                      <span>편집</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onDelete(document.id)}
                      className="flex items-center space-x-1 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                      <span>삭제</span>
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <div className="flex items-center space-x-4">
                    <span className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(document.createdAt)}</span>
                    </span>
                    {document.metadata?.wordCount && (
                      <span>{document.metadata.wordCount}단어</span>
                    )}
                  </div>
                  <span className="text-gray-400">ID: {document.id.slice(0, 8)}...</span>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}