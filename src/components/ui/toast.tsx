'use client'

import * as ToastPrimitive from '@radix-ui/react-toast'
import { CheckCircle2, XCircle } from 'lucide-react'
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

type ToastVariant = 'success' | 'error'

interface ToastItem {
  id: number
  title: string
  variant: ToastVariant
}

const ToastContext = createContext<{ toast: (title: string, variant?: ToastVariant) => void } | null>(
  null
)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx.toast
}

const ROOT_CLASSES: Record<ToastVariant, string> = {
  success: 'border-emerald-300 bg-emerald-50 text-emerald-950',
  error: 'border-red-300 bg-red-50 text-red-950',
}

const ICON_CLASSES: Record<ToastVariant, string> = {
  success: 'text-emerald-700',
  error: 'text-red-700',
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((title: string, variant: ToastVariant = 'success') => {
    const id = Date.now() + Math.random()
    setItems((prev) => [...prev, { id, title, variant }])
  }, [])

  const value = useMemo(() => ({ toast }), [toast])

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider duration={4000} swipeDirection="right" label="Notifications">
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            className={`pointer-events-auto flex w-full items-start gap-3 rounded-xl border p-4 shadow-lg ${ROOT_CLASSES[item.variant]}`}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== item.id))
            }}
          >
            {item.variant === 'success' ? (
              <CheckCircle2 className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_CLASSES[item.variant]}`} aria-hidden="true" />
            ) : (
              <XCircle className={`mt-0.5 h-5 w-5 shrink-0 ${ICON_CLASSES[item.variant]}`} aria-hidden="true" />
            )}
            <ToastPrimitive.Title className="text-sm font-medium">
              {item.title}
            </ToastPrimitive.Title>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  )
}
