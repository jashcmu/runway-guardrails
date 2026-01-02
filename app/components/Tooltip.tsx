'use client'

import { useState } from 'react'

type TooltipProps = {
  term: string
  explanation: string
  children: React.ReactNode
}

export default function Tooltip({ term, explanation, children }: TooltipProps) {
  const [show, setShow] = useState(false)

  return (
    <span className="relative inline-block">
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        className="underline decoration-dotted cursor-help"
      >
        {children}
      </span>
      {show && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 p-3 bg-gray-900 text-white text-sm rounded-lg shadow-lg">
          <div className="font-semibold mb-1">{term}</div>
          <div className="text-gray-300">{explanation}</div>
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
            <div className="border-4 border-transparent border-t-gray-900" />
          </div>
        </div>
      )}
    </span>
  )
}

