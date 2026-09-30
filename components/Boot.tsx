"use client"

import { Lamp, Screen } from "./Machine"

/**
 * The first thing anyone sees: the machine, powered and idle, waiting for START.
 * Laid out exactly like the input terminal, so the screen doesn't jump when
 * START is pressed.
 */
export function Boot({ onStart }: { onStart: () => void }) {
  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6">
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
          <div className="mt-16 text-[24px] tracking-[0.2em] sm:text-[40px]">
            SYSTEM READY<span className="blink">_</span>
          </div>
        </div>
      </Screen>

      <div className="mt-6 flex items-center justify-between gap-6">
        <div className="label flex items-center gap-6">
          <span className="flex items-center gap-2.5">
            Power <Lamp />
          </span>
          <span className="text-ink/60">
            Status: <span className="text-ink">Ready</span>
          </span>
        </div>

        <button type="button" onClick={onStart} className="key key-dark px-10 py-3">
          Start system
        </button>
      </div>
    </div>
  )
}
