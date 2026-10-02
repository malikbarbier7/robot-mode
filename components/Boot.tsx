"use client"

import { useWords } from "@/lib/words"
import { useRef } from "react"
import { Console, SCREEN_HEIGHT, useTerminal } from "./Machine"

/**
 * The first thing anyone sees: the machine, powered and idle, waiting for
 * Enter. Same console as the input terminal, so the screen doesn't jump when
 * it starts.
 */
export function Boot({ onStart }: { onStart: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  const words = useWords()
  useTerminal(root, { onEnter: onStart })

  return (
    <div ref={root}>
      <Console captions={[words.boot.display, words.boot.screen]}>
        <div className={`flex ${SCREEN_HEIGHT} flex-col items-center justify-center text-center font-crt`}>
          <div className="text-[56px] leading-none tracking-[0.12em] sm:text-[128px] uppercase">{words.name}</div>
          <div className="mt-4 text-[20px] tracking-[0.2em] text-ink/70 sm:text-[32px] uppercase">{words.boot.subtitle}</div>
          <div className="mt-14 text-[24px] tracking-[0.2em] sm:text-[36px] uppercase">{words.boot.ready}</div>
          <button
            type="button"
            data-nav
            onClick={onStart}
            className="mt-4 px-3 text-[22px] tracking-[0.2em] text-ink/80 sm:text-[30px]"
          >
            <span className="uppercase pointer-coarse:hidden">{words.boot.start}</span>
            <span className="hidden uppercase pointer-coarse:inline">{words.boot.tap}</span>
            <span className="blink">_</span>
          </button>
        </div>
      </Console>
    </div>
  )
}
