import { useEffect } from "react"

interface KeyboardShortcut {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  callback: () => void
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const isCtrlPressed = shortcut.ctrl ? event.ctrlKey : true
        const isMetaPressed = shortcut.meta ? event.metaKey : true
        const isShiftPressed = shortcut.shift ? event.shiftKey : true

        if (
          event.key.toLowerCase() === shortcut.key.toLowerCase() &&
          isCtrlPressed &&
          isMetaPressed &&
          isShiftPressed
        ) {
          event.preventDefault()
          shortcut.callback()
        }
      })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [shortcuts])
}
