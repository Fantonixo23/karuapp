const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
async function main() {
  const cols = await p.$queryRawUnsafe(
    "SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns WHERE table_name = 'usuarios' ORDER BY ordinal_position"
  );
  for (const c of cols) {
    console.log(c.column_name + ': ' + c.data_type + ' nullable=' + c.is_nullable + ' default=' + (c.column_default || 'NULL'));
  }

  const passwordCol = cols.find(c => c.column_name === 'password');
  if (passwordCol) {
    console.log('\nPassword column exists:', JSON.stringify(passwordCol));
    // Make it nullable or add default
    await p.$executeRawUnsafe('ALTER TABLE usuarios ALTER COLUMN password DROP NOT NULL');
    console.log('password column set to nullable');
  }

  await p.$disconnect();
}
main().catch(e => { console.log('Error: ' + e.message); process.exit(1); });
