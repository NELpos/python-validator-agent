"use client"

import React, { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SplitViewProps {
  left: ReactNode
  right: ReactNode
  className?: string
}

export function SplitView({ left, right, className }: SplitViewProps) {
  return (
    <div className={cn("flex h-full w-full gap-4", className)}>
      <div className="flex-1 min-w-0">
        {left}
      </div>
      <div className="flex-1 min-w-0">
        {right}
      </div>
    </div>
  )
}