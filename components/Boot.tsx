"use client"

import { useRef } from "react"
import { Console, SCREEN_HEIGHT, useTerminal } from "./Machine"

/**
 * The first thing anyone sees: the machine, powered and idle, waiting for
 * Enter. Same console as the input terminal, so the screen doesn't jump when
 * it starts.
 */
export function Boot({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useTerminal(root, { onEnter: onStart })

  return (
    <div ref={root}>
      <Console captions={["Display 01", "Amber phosphor · 80 col"]} legend={[["Enter", "Start", true]]}>
        <div className={`flex ${SCREEN_HEIGHT} flex-col items-center justify-center text-center font-crt`}>
          <div className="text-[56px] leading-none tracking-[0.12em] sm:text-[128px]">ROBOT MODE</div>
          <div className="mt-4 text-[20px] tracking-[0.2em] text-ink/70 sm:text-[32px]">PERSONAL SCHEDULING COMPUTER</div>
          <div className="mt-14 text-[24px] tracking-[0.2em] sm:text-[36px]">SYSTEM READY</div>
          <button
            type="button"
            data-nav
            onClick={onStart}
            className="mt-4 px-3 text-[22px] tracking-[0.2em] text-ink/80 sm:text-[30px]"
          >
            PRESS ENTER TO START<span className="blink">_</span>
          </button>
        </div>
      </Console>
    </div>
  )
}
