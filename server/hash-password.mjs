// Yangi parol uchun bcrypt hash yaratadi.
// Foydalanish:  node server/hash-password.mjs "yangi-parol"
// Natijani .env faylidagi AUTH_PASSWORD_HASH ga qo'ying (qo'shtirnoq ichida).
import bcrypt from 'bcryptjs';

const password = process.argv[2];
if (!password) {
  console.error('Foydalanish: node server/hash-password.mjs "yangi-parol"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 12);
console.log(hash);
