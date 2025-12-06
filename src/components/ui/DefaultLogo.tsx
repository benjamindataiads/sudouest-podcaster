/**
 * Default logo: Black microphone with purple spark
 * Used when organization hasn't set a custom logo
 */
export default function DefaultLogo({ 
  width = 40, 
  height = 40,
  className = '' 
}: { 
  width?: number
  height?: number
  className?: string 
}) {
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Microphone body */}
      <rect x="16" y="8" width="16" height="24" rx="8" fill="#1a1a1a" />
      
      {/* Microphone grille lines */}
      <line x1="18" y1="14" x2="30" y2="14" stroke="#333" strokeWidth="1" />
      <line x1="18" y1="18" x2="30" y2="18" stroke="#333" strokeWidth="1" />
      <line x1="18" y1="22" x2="30" y2="22" stroke="#333" strokeWidth="1" />
      <line x1="18" y1="26" x2="30" y2="26" stroke="#333" strokeWidth="1" />
      
      {/* Microphone stand */}
      <path 
        d="M24 32 L24 38" 
        stroke="#1a1a1a" 
        strokeWidth="3" 
        strokeLinecap="round" 
      />
      <path 
        d="M18 38 L30 38" 
        stroke="#1a1a1a" 
        strokeWidth="3" 
        strokeLinecap="round" 
      />
      
      {/* Purple spark/star */}
      <path
        d="M36 8 L38 12 L42 12 L39 15 L40 19 L36 16 L32 19 L33 15 L30 12 L34 12 Z"
        fill="#8B5CF6"
      />
      
      {/* Small sparkles */}
      <circle cx="40" cy="6" r="1.5" fill="#A78BFA" />
      <circle cx="44" cy="14" r="1" fill="#A78BFA" />
    </svg>
  )
}

