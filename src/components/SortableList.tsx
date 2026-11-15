import { useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

interface SortableListProps<T extends string> {
  items: T[]
  onReorder: (items: T[]) => void
  renderItem: (item: T, index: number) => ReactNode
  className: string
  itemClassName: string
}

function reorderAroundTarget<T extends string>(items: T[], sourceId: T, targetId: T, after: boolean) {
  if (sourceId === targetId) return items
  const next = [...items]
  const sourceIndex = next.indexOf(sourceId)
  if (sourceIndex < 0) return items
  next.splice(sourceIndex, 1)
  const targetIndex = next.indexOf(targetId)
  if (targetIndex < 0) return items
  next.splice(targetIndex + (after ? 1 : 0), 0, sourceId)
  return next
}

export function SortableList<T extends string>({ items, onReorder, renderItem, className, itemClassName }: SortableListProps<T>) {
  const [previewItems, setPreviewItems] = useState<T[] | null>(null)
  const [draggedId, setDraggedId] = useState<T | null>(null)
  const dragItems = useRef<T[]>(items)
  const dragState = useRef<{ pointerId: number; sourceId: T; startX: number; startY: number; active: boolean; initialItems: T[] } | null>(null)
  const suppressClick = useRef(false)
  const displayItems = previewItems ?? items

  function startDrag(event: ReactPointerEvent<HTMLLIElement>, item: T) {
    if (event.button !== 0) return
    dragState.current = { pointerId: event.pointerId, sourceId: item, startX: event.clientX, startY: event.clientY, active: false, initialItems: [...items] }
  }

  function moveDrag(event: ReactPointerEvent<HTMLLIElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (!drag.active) {
      if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 7) return
      drag.active = true
      event.preventDefault()
      window.getSelection()?.removeAllRanges()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragItems.current = [...items]
      setDraggedId(drag.sourceId)
    }
    const targetElement = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-sortable-id]')
    const targetId = targetElement?.dataset.sortableId as T | undefined
    if (!targetElement || !targetId || !dragItems.current.includes(targetId)) return
    const bounds = targetElement.getBoundingClientRect()
    const next = reorderAroundTarget(dragItems.current, drag.sourceId, targetId, event.clientY >= bounds.top + bounds.height / 2)
    if (next === dragItems.current || next.every((item, index) => item === dragItems.current[index])) return
    dragItems.current = next
    setPreviewItems(next)
  }

  function finishDrag(event: ReactPointerEvent<HTMLLIElement>) {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId) return
    if (drag.active) {
      suppressClick.current = true
      window.setTimeout(() => { suppressClick.current = false }, 0)
      if (dragItems.current.some((item, index) => item !== drag.initialItems[index])) onReorder(dragItems.current)
    }
    dragState.current = null
    setPreviewItems(null)
    setDraggedId(null)
  }

  function cancelDrag(event: ReactPointerEvent<HTMLLIElement>) {
    if (dragState.current?.pointerId !== event.pointerId) return
    dragState.current = null
    dragItems.current = items
    setPreviewItems(null)
    setDraggedId(null)
  }

  return <ol className={`${className}${draggedId ? ' is-dragging' : ''}`}>
    {displayItems.map((item, index) => <li
      key={item}
      data-sortable-id={item}
      className={`${itemClassName}${draggedId === item ? ' is-dragged' : ''}`}
      onPointerDown={(event) => startDrag(event, item)}
      onPointerMove={moveDrag}
      onPointerUp={finishDrag}
      onPointerCancel={cancelDrag}
      onClickCapture={(event) => {
        if (!suppressClick.current) return
        event.preventDefault()
        event.stopPropagation()
        suppressClick.current = false
      }}
    >{renderItem(item, index)}</li>)}
  </ol>
}
