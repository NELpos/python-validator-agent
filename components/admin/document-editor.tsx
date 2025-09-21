"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CodeEditor } from "@/components/ui/code-editor"
import { Eye, Edit, Save, X } from "lucide-react"
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface DocumentEditorProps {
  document?: {
    id: string
    title: string
    content: string
    section?: string
    documentType: 'rule' | 'best-practice' | 'example'
    metadata?: any
  } | null
  onSave: (data: {
    title: string
    content: string
    section?: string
    documentType: 'rule' | 'best-practice' | 'example'
    metadata?: any
  }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function DocumentEditor({ document, onSave, onCancel, isLoading }: DocumentEditorProps) {
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [section, setSection] = useState('')
  const [documentType, setDocumentType] = useState<'rule' | 'best-practice' | 'example'>('rule')
  const [activeTab, setActiveTab] = useState('edit')

  // 문서 데이터 로드
  useEffect(() => {
    if (document) {
      setTitle(document.title)
      setContent(document.content)
      setSection(document.section || '')
      setDocumentType(document.documentType)
    } else {
      setTitle('')
      setContent('')
      setSection('')
      setDocumentType('rule')
    }
  }, [document])

  const handleSave = () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 모두 입력해주세요.')
      return
    }

    onSave({
      title: title.trim(),
      content: content.trim(),
      section: section.trim() || undefined,
      documentType,
      metadata: {
        wordCount: content.trim().split(/\s+/).length,
        lastModified: new Date().toISOString()
      }
    })
  }

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

  return (
    <div className="space-y-6">
      {/* 메타데이터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{document ? '문서 편집' : '새 문서 작성'}</span>
            <Badge className={documentTypeColors[documentType]}>
              {documentTypeLabels[documentType]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">문서 제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: Panther 탐지 규칙 작성 가이드"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="section">섹션</Label>
              <Input
                id="section"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="예: 기본 규칙 구조"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="documentType">문서 타입 *</Label>
            <Select value={documentType} onValueChange={(value: any) => setDocumentType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="rule">탐지 규칙 - 규칙 작성 방법 및 가이드라인</SelectItem>
                <SelectItem value="best-practice">모범 사례 - 권장 패턴 및 최적화 방법</SelectItem>
                <SelectItem value="example">예제 - 구체적인 사용 사례 및 샘플</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 에디터 섹션 */}
      <Card className="min-h-[600px]">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>마크다운 콘텐츠</CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button onClick={handleSave} disabled={isLoading || !title.trim() || !content.trim()}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="edit" className="flex items-center space-x-2">
                <Edit className="h-4 w-4" />
                <span>편집</span>
              </TabsTrigger>
              <TabsTrigger value="preview" className="flex items-center space-x-2">
                <Eye className="h-4 w-4" />
                <span>미리보기</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="edit" className="mt-4 h-[500px]">
              <div className="h-full border rounded-md">
                <CodeEditor
                  value={content}
                  onChange={(value) => setContent(value || '')}
                  language="markdown"
                  height="500px"
                />
              </div>
            </TabsContent>

            <TabsContent value="preview" className="mt-4 h-[500px] overflow-auto">
              <div className="prose prose-sm max-w-none p-4 border rounded-md bg-gray-50 h-full">
                {content ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {content}
                  </ReactMarkdown>
                ) : (
                  <p className="text-gray-500 italic">편집 탭에서 마크다운을 작성하면 여기에 미리보기가 표시됩니다.</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* 도움말 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">마크다운 작성 팁</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">기본 문법:</h4>
              <ul className="space-y-1 text-xs">
                <li><code># 제목</code> - 헤딩</li>
                <li><code>**굵게**</code> - 굵은 글씨</li>
                <li><code>`코드`</code> - 인라인 코드</li>
                <li><code>```python</code> - 코드 블록</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">RAG 최적화:</h4>
              <ul className="space-y-1 text-xs">
                <li>• 명확한 제목과 섹션 구조</li>
                <li>• 구체적인 예제 포함</li>
                <li>• 키워드 및 용어 정의</li>
                <li>• 단계별 설명</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}