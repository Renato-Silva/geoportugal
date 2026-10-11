export interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
  sticky?: boolean
}

const toasts = ref<Toast[]>([])
let seq = 0

export function useToast() {
  function show(text: string, opts: { tone?: Toast['tone'], sticky?: boolean, id?: number } = {}) {
    const id = opts.id ?? ++seq
    const existing = toasts.value.find(t => t.id === id)
    if (existing) existing.text = text
    else toasts.value.push({ id, text, tone: opts.tone ?? 'info', sticky: opts.sticky })
    if (!opts.sticky) setTimeout(() => dismiss(id), 3500)
    return id
  }
  function dismiss(id: number) {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }
  return { toasts, show, dismiss }
}
