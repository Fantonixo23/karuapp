export function requireJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET ausente o con menos de 32 caracteres. Generalo con: openssl rand -hex 32',
    );
  }
  return secret;
}
