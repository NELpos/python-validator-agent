"use client"

import React from "react"
import Editor from "@monaco-editor/react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CodeEditorProps {
  value: string
  onChange: (value: string | undefined) => void
  className?: string
}

export function CodeEditor({ value, onChange, className }: CodeEditorProps) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Python Code Input</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Editor
          height="calc(100vh - 200px)"
          language="python"
          theme="vs-dark"
          value={value}
          onChange={onChange}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: "on",
            roundedSelection: false,
            scrollBeyondLastLine: false,
            automaticLayout: true,
            formatOnPaste: true,
            formatOnType: true,
            suggestOnTriggerCharacters: true,
            quickSuggestions: {
              other: true,
              comments: false,
              strings: false,
            },
            parameterHints: {
              enabled: true,
            },
            folding: true,
            bracketPairColorization: {
              enabled: true,
            },
            wordWrap: "off",
            tabSize: 4,
            insertSpaces: true,
          }}
        />
      </CardContent>
    </Card>
  )
}