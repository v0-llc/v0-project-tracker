const ALLOWED_EMAILS = new Set(['teddy@v0.run'])

export function isAllowedEmail(email: string | null | undefined): boolean {
  return Boolean(email && ALLOWED_EMAILS.has(email.trim().toLowerCase()))
}
