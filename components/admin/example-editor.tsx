"use client"

import React, { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Slider } from "@/components/ui/slider"
import { CodeEditor } from "@/components/ui/code-editor"
import { Save, X, Star, Code, Tag, Hash } from "lucide-react"

interface ExampleEditorProps {
  example?: {
    id: string
    title: string
    codeContent: string
    qualityScore: number
    category?: string
    description?: string
    tags?: string[]
  } | null
  onSave: (data: {
    title: string
    codeContent: string
    qualityScore: number
    category?: string
    description?: string
    tags?: string[]
  }) => void
  onCancel: () => void
  isLoading?: boolean
}

export function ExampleEditor({ example, onSave, onCancel, isLoading }: ExampleEditorProps) {
  const [title, setTitle] = useState('')
  const [codeContent, setCodeContent] = useState('')
  const [qualityScore, setQualityScore] = useState([75])
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [tagsInput, setTagsInput] = useState('')

  // 예제 데이터 로드
  useEffect(() => {
    if (example) {
      setTitle(example.title)
      setCodeContent(example.codeContent)
      setQualityScore([example.qualityScore])
      setCategory(example.category || '')
      setDescription(example.description || '')
      setTagsInput(example.tags ? example.tags.join(', ') : '')
    } else {
      setTitle('')
      setCodeContent(`def rule(event):
    """
    탐지 규칙을 작성하세요.
    """
    # 여기에 탐지 로직을 구현하세요
    return False

def title(event):
    return "탐지 제목"

def severity(event):
    return "MEDIUM"`)
      setQualityScore([75])
      setCategory('')
      setDescription('')
      setTagsInput('')
    }
  }, [example])

  const handleSave = () => {
    if (!title.trim() || !codeContent.trim()) {
      alert('제목과 코드를 모두 입력해주세요.')
      return
    }

    // 태그 파싱
    const tags = tagsInput
      .split(',')
      .map(tag => tag.trim())
      .filter(tag => tag.length > 0)

    onSave({
      title: title.trim(),
      codeContent: codeContent.trim(),
      qualityScore: qualityScore[0],
      category: category.trim() || undefined,
      description: description.trim() || undefined,
      tags: tags.length > 0 ? tags : undefined
    })
  }

  const getQualityLabel = (score: number) => {
    if (score >= 90) return { label: '최고 품질', color: 'bg-emerald-100 text-emerald-800' }
    if (score >= 80) return { label: '고품질', color: 'bg-green-100 text-green-800' }
    if (score >= 60) return { label: '중품질', color: 'bg-yellow-100 text-yellow-800' }
    return { label: '저품질', color: 'bg-red-100 text-red-800' }
  }

  const qualityInfo = getQualityLabel(qualityScore[0])

  // 코드 분석 (간단한)
  const codeAnalysis = React.useMemo(() => {
    const lines = codeContent.split('\n').length
    const hasRule = /def rule\(/i.test(codeContent)
    const hasTitle = /def title\(/i.test(codeContent)
    const hasSeverity = /def severity\(/i.test(codeContent)
    const hasDedup = /def dedup\(/i.test(codeContent)
    const hasRunbook = /def runbook\(/i.test(codeContent)
    const hasDocstring = /"""/g.test(codeContent)

    return {
      lines,
      functions: { hasRule, hasTitle, hasSeverity, hasDedup, hasRunbook },
      hasDocstring,
      completeness: [hasRule, hasTitle, hasSeverity].filter(Boolean).length
    }
  }, [codeContent])

  return (
    <div className="space-y-6">
      {/* 메타데이터 섹션 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>{example ? '예제 편집' : '새 예제 작성'}</span>
            <Badge className={qualityInfo.color}>
              <Star className="h-3 w-3 mr-1" />
              {qualityInfo.label} ({qualityScore[0]}점)
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">예제 제목 *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 브루트포스 로그인 탐지"
                disabled={isLoading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">카테고리</Label>
              <Input
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="예: authentication, network, file-system"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">설명</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="이 예제가 무엇을 탐지하는지, 어떤 상황에서 사용하는지 설명해주세요..."
              rows={3}
              disabled={isLoading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">태그 (쉼표로 구분)</Label>
            <Input
              id="tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="brute-force, login, security, monitoring"
              disabled={isLoading}
            />
            {tagsInput && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tagsInput.split(',').map((tag, index) => (
                  <Badge key={index} variant="outline" className="text-xs">
                    <Tag className="h-2 w-2 mr-1" />
                    {tag.trim()}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-3">
            <Label>품질 점수: {qualityScore[0]}점</Label>
            <Slider
              value={qualityScore}
              onValueChange={setQualityScore}
              max={100}
              min={0}
              step={5}
              className="w-full"
              disabled={isLoading}
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>0점 (최저)</span>
              <span>50점 (보통)</span>
              <span>100점 (최고)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 코드 에디터 섹션 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-2">
              <Code className="h-5 w-5" />
              <span>Python 코드</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button variant="outline" onClick={onCancel} disabled={isLoading}>
                <X className="h-4 w-4 mr-2" />
                취소
              </Button>
              <Button onClick={handleSave} disabled={isLoading || !title.trim() || !codeContent.trim()}>
                <Save className="h-4 w-4 mr-2" />
                {isLoading ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-[400px] border rounded-md">
            <CodeEditor
              value={codeContent}
              onChange={(value) => setCodeContent(value || '')}
              language="python"
              height="400px"
            />
          </div>
        </CardContent>
      </Card>

      {/* 코드 분석 정보 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center space-x-2">
            <Hash className="h-4 w-4" />
            <span>코드 분석</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-600">총 라인 수:</span>
              <span className="ml-2 font-medium">{codeAnalysis.lines}</span>
            </div>
            <div>
              <span className="text-gray-600">완성도:</span>
              <span className="ml-2 font-medium">{codeAnalysis.completeness}/3</span>
            </div>
            <div>
              <span className="text-gray-600">문서화:</span>
              <span className="ml-2">
                {codeAnalysis.hasDocstring ? (
                  <Badge className="bg-green-100 text-green-800 text-xs">있음</Badge>
                ) : (
                  <Badge className="bg-red-100 text-red-800 text-xs">없음</Badge>
                )}
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium">함수 체크리스트:</h4>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
              {Object.entries({
                'rule()': codeAnalysis.functions.hasRule,
                'title()': codeAnalysis.functions.hasTitle,
                'severity()': codeAnalysis.functions.hasSeverity,
                'dedup()': codeAnalysis.functions.hasDedup,
                'runbook()': codeAnalysis.functions.hasRunbook,
              }).map(([func, exists]) => (
                <div key={func} className="flex items-center space-x-1">
                  <span className={`w-2 h-2 rounded-full ${exists ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className={exists ? 'text-green-700' : 'text-gray-500'}>{func}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 품질 가이드 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">품질 점수 가이드</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-gray-600 space-y-2">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium mb-2">점수 기준:</h4>
              <ul className="space-y-1 text-xs">
                <li>• <strong>90-100점:</strong> 완벽한 예제, 모든 함수 포함, 상세한 문서화</li>
                <li>• <strong>80-89점:</strong> 고품질, 주요 함수 포함, 적절한 에러 처리</li>
                <li>• <strong>60-79점:</strong> 기본 기능 작동, 일부 함수 누락</li>
                <li>• <strong>60점 미만:</strong> 개선 필요, 기본 구조만 있음</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-2">품질 향상 팁:</h4>
              <ul className="space-y-1 text-xs">
                <li>• 명확한 docstring과 주석 추가</li>
                <li>• title(), severity() 함수 포함</li>
                <li>• dedup(), runbook() 함수로 완성도 향상</li>
                <li>• 에러 처리 및 입력 검증 추가</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}