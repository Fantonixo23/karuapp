const desdeEnv = (
  import.meta.env.VITE_ADMIN_ALLOWED_EMAILS || 'juampabloportillo22@gmail.com'
)
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

export const SUPERADMIN_EMAILS = desdeEnv