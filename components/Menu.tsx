"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

/**
 * The panel's one drop-down: settings and file keys that are used rarely
 * enough not to sit on the header. Closes on Esc or a click elsewhere.
 */
export function Menu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !root.current?.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("pointerdown", close)
    window.addEventListener("keydown", close)
    return () => {
      window.removeEventListener("pointerdown", close)
      window.removeEventListener("keydown", close)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="key px-2.5 py-1"
      >
        Menu {open ? "▴" : "▾"}
      </button>
      {open && (
        <div
          role="menu"
          // Any key pressed inside does its job and folds the menu away, except the switches.
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("[data-menu-close]")) setOpen(false)
          }}
          className="absolute right-0 top-full z-20 mt-2 flex w-56 flex-col gap-2 border-2 border-ink bg-paper p-3"
        >
          {children}
        </div>
      )}
    </div>
  )
}

/** A row in the menu: a full-width key that closes the menu when pressed. */
export function MenuItem({
  children,
  onClick,
  disabled,
  title,
}: {
  children: ReactNode
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      role="menuitem"
      data-menu-close
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="key w-full px-2.5 py-1 text-left"
    >
      {children}
    </button>
  )
}
