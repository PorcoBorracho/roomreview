// Genera un hash scrypt para ADMIN_PASSWORD_HASH / VIEWER_PASSWORD_HASH.
// Uso: npm run hash-password   (te pedirá la contraseña sin mostrarla)
import { scryptSync, randomBytes } from "node:crypto";
import { createInterface } from "node:readline";

const N = 2 ** 15, r = 8, p = 1, keyLen = 64;

function hash(pw) {
  const salt = randomBytes(16);
  const key = scryptSync(pw.normalize("NFKC"), salt, keyLen, { N, r, p, maxmem: 128 * N * r * 2 });
  return `scrypt:${N}:${r}:${p}:${salt.toString("base64url")}:${key.toString("base64url")}`;
}

const arg = process.argv[2];
if (arg) {
  console.log(hash(arg));
} else {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  rl._writeToOutput = (s) => { if (s.includes("Contraseña")) process.stdout.write(s); };
  rl.question("Contraseña (mín. 12 caracteres): ", (pw) => {
    rl.close();
    process.stdout.write("\n");
    if (pw.length < 12) { console.error("Demasiado corta: usa al menos 12 caracteres."); process.exit(1); }
    console.log("\nCopia este valor en la variable de entorno:\n");
    console.log(hash(pw));
  });
}
