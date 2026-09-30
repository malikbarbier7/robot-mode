import type { ReactNode } from "react"

export const inputClass =
  "w-full border border-ink/30 bg-transparent px-1.5 py-1 font-mono text-[12px] tabular-nums placeholder:text-ink/35"

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label mb-1 block text-ink/50">{label}</span>
      {children}
    </label>
  )
}

export function Button({
  children,
  onClick,
  variant = "outline",
  type = "button",
  title,
  disabled,
}: {
  children: ReactNode
  onClick?: () => void
  variant?: "outline" | "solid" | "bare"
  type?: "button" | "submit"
  title?: string
  disabled?: boolean
}) {
  const styles = {
    outline: "key px-2.5 py-1",
    solid: "key key-dark px-2.5 py-1",
    bare: "label px-1 text-ink/55 hover:text-ink",
  }[variant]

  return (
    <button
      type={type}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={styles}
    >
      {children}
    </button>
  )
}
