// Uso: node scripts/verify-password.mjs "scrypt:..."
// Te pedirá la contraseña sin mostrarla y dirá si coincide con el hash.
import { scryptSync, timingSafeEqual } from "node:crypto";
import { createInterface } from "node:readline";

const stored = process.argv[2];
const parts = stored?.split(":") ?? [];
if (parts.length !== 6 || parts[0] !== "scrypt") {
  console.error('Pasa el hash completo entre comillas: node scripts/verify-password.mjs "scrypt:..."');
  process.exit(1);
}
const [, N, r, p, saltB64, keyB64] = parts;
const salt = Buffer.from(saltB64, "base64url");
const expected = Buffer.from(keyB64, "base64url");

const rl = createInterface({ input: process.stdin, output: process.stdout });
rl._writeToOutput = (s) => { if (s.includes("Contraseña")) process.stdout.write(s); };
rl.question("Contraseña a comprobar: ", (pw) => {
  rl.close();
  process.stdout.write("\n");
  const key = scryptSync(pw.normalize("NFKC"), salt, expected.length, {
    N: +N, r: +r, p: +p, maxmem: 128 * +N * +r * 2,
  });
  console.log(timingSafeEqual(key, expected) ? "✅ Coincide" : "❌ No coincide");
});