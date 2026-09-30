"use client"

import { useRef } from "react"
import { Legend, Screen, useTerminal } from "./Machine"

/**
 * The first thing anyone sees: the machine, powered and idle, waiting for
 * Enter. Laid out exactly like the input terminal, so the screen doesn't jump
 * when it starts.
 */
export function Boot({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useTerminal(root, { onEnter: onStart })

  return (
    <div ref={root} className="mx-auto w-full max-w-[1440px] px-6 py-6">
      <Screen
        padding="px-6 py-6 sm:px-14 sm:py-12"
        caption={
          <>
            <span>Display 01</span>
            <span>Amber phosphor · 80 col</span>
          </>
        }
      >
        <div className="flex min-h-[max(480px,calc(100vh-350px))] flex-col items-center justify-center text-center font-crt">
          <div className="text-[64px] leading-none tracking-[0.12em] sm:text-[160px]">ROBOT MODE</div>
          <div className="mt-4 text-[22px] tracking-[0.2em] text-ink/70 sm:text-[38px]">PERSONAL SCHEDULING COMPUTER</div>
          <div className="mt-16 text-[24px] tracking-[0.2em] sm:text-[40px]">SYSTEM READY</div>
          <button
            type="button"
            data-nav
            onClick={onStart}
            className="mt-4 px-3 text-[24px] tracking-[0.2em] text-ink/80 sm:text-[32px]"
          >
            PRESS ENTER TO START<span className="blink">_</span>
          </button>
        </div>
      </Screen>

      <Legend keys={[["Enter", "Start"]]} />
    </div>
  )
}
