CREATE UNIQUE INDEX IF NOT EXISTS usuarios_email_unique ON "usuarios" (email) WHERE email IS NOT NULL;
