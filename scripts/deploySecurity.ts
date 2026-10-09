import type { HeaderRule } from './deployRules.ts'

export const cspDirectives = {
  'default-src': "'none'",
  // Basis generates Embind functions in its blob worker as well as compiling
  // WASM. unsafe-eval permits both; wasm-unsafe-eval alone cannot run it.
  'script-src': "'self' 'unsafe-eval'",
  'script-src-attr': "'none'",
  'style-src': "'self'",
  'style-src-attr': "'none'",
  'font-src': "'self'",
  'img-src': "'self' data:",
  'connect-src': "'self' blob:",
  'worker-src': 'blob:',
  'base-uri': "'none'",
  'form-action': "'none'",
  'frame-ancestors': "'none'",
} as const

export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy':
    'accelerometer=(), autoplay=(), camera=(), display-capture=(), encrypted-media=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), midi=(), payment=(), picture-in-picture=(), screen-wake-lock=(), usb=(), xr-spatial-tracking=()',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': Object.entries(cspDirectives)
    .map(([name, sources]) => `${name} ${sources}`)
    .join('; '),
} as const

export type SecurityFinding = {
  readonly kind: 'requiredSecurityHeader'
  readonly header: string
  readonly detail: string
}

// A universal rule protects extensionless routes, unknown paths and future
// assets as well as today's files. Narrow overrides must never weaken it.
export function checkSecurityHeaders(rules: readonly HeaderRule[]): SecurityFinding[] {
  return Object.entries(securityHeaders).flatMap(([name, value]): SecurityFinding[] => {
    const settings = rules.flatMap((rule) =>
      rule.headers
        .filter((header) => header.name.toLowerCase() === name.toLowerCase())
        .map((header) => ({ pattern: rule.pattern, value: header.value })),
    )
    if (settings.length === 1 && settings[0]?.pattern === '/*' && settings[0].value === value) {
      return []
    }
    return [
      {
        kind: 'requiredSecurityHeader',
        header: name,
        detail: 'must occur once on /* with the required policy',
      },
    ]
  })
}
