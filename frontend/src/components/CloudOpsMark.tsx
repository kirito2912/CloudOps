type CloudOpsMarkProps = { size?: number; className?: string }

export default function CloudOpsMark({ size = 40, className }: CloudOpsMarkProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="CloudOps">
      <defs>
        <linearGradient id="cloudops-mark-gradient" x1="8" y1="5" x2="57" y2="61" gradientUnits="userSpaceOnUse">
          <stop stopColor="#38BDF8" />
          <stop offset=".52" stopColor="#2563EB" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id="cloudops-cloud-gradient" x1="17" y1="22" x2="48" y2="47" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#C7E7FF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="60" height="60" rx="19" fill="url(#cloudops-mark-gradient)" />
      <circle cx="48" cy="15" r="10" fill="#BAE6FD" fillOpacity=".18" />
      <path d="M18 39.5h27a8 8 0 0 0 .5-16 13.5 13.5 0 0 0-25.7 2.2A7 7 0 0 0 18 39.5Z" fill="url(#cloudops-cloud-gradient)" fillOpacity=".16" stroke="white" strokeWidth="2.6" strokeLinejoin="round" />
      <path d="M22 45h20M26 49h12" stroke="white" strokeOpacity=".72" strokeWidth="2.4" strokeLinecap="round" />
      <circle cx="22" cy="31" r="2.1" fill="white" />
      <circle cx="32" cy="24" r="2.1" fill="white" />
      <circle cx="43" cy="31" r="2.1" fill="white" />
      <path d="m24 30 6-4m4 0 7 4" stroke="white" strokeOpacity=".85" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
