import { defaultIconSize, type IconProps } from './iconProps'

export function ResetIcon({ size = defaultIconSize }: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 8a6 6 0 1 0 6-6 6.5 6.5 0 0 0-4.49 1.83L2 5.33" />
      <path d="M2 2v3.33h3.33" />
    </svg>
  )
}
