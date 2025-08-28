"use client"

import { useEffect } from "react"

type Props = {
  open: boolean
  title?: string
  onClose: () => void
  children: React.ReactNode
  footer?: React.ReactNode
  widthClass?: string
}

export default function Modal({ open, onClose, title, children, footer, widthClass = "max-w-sm" }: Props) {
  useEffect(() => {
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    if (open) window.addEventListener("keydown", onEsc)
    return () => window.removeEventListener("keydown", onEsc)
  }, [open, onClose])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className={`absolute inset-0 flex items-start justify-center p-6`}>
        <div className={`w-full ${widthClass} rounded-2xl bg-white shadow-xl`}>
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <div className="font-semibold">{title}</div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✖</button>
          </div>
          <div className="p-6">{children}</div>
          {footer && <div className="px-6 py-4 border-t bg-gray-50 rounded-b-2xl">{footer}</div>}
        </div>
      </div>
    </div>
  )
}
