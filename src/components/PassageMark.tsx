// The Passage mark: a great-circle arc across a globe. Matches the gt.json icon
// so the app looks the same in the sidebar and inside its own chrome. Tintable
// (currentColor); set a text colour on the parent.
export function PassageMark({ size = 22 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M5 14c4-9 10-9 14-4" />
      <circle cx="5" cy="14" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="19" cy="10" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}
