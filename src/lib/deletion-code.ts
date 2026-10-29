import "server-only";
import { randomInt } from "node:crypto";
import { sha256 } from "./crypto";

// Sin 0/O, 1/I/L para que se pueda copiar a mano sin errores
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

/** Código de 20 caracteres aleatorios (~99 bits). Solo se guarda su hash. */
export function newDeletionCode() {
  let body = "";
  for (let i = 0; i < 20; i++) body += ALPHABET[randomInt(ALPHABET.length)];
  const code = `RR-${body.slice(0, 5)}-${body.slice(5, 10)}-${body.slice(10, 15)}-${body.slice(15)}`;
  return { code, hash: hashDeletionCode(`RR${body}`) };
}

/** Recibe el código normalizado (sin guiones, en mayúsculas). */
export function hashDeletionCode(normalized: string) {
  return sha256(`deletion:${normalized}`);
}
