"use client";

// Sin caracteres ambiguos (0/O, 1/l/I) para poder dictarla o escribirla a mano
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

/** 4 bloques de 5 caracteres ≈ 99 bits de entropía, p. ej. "k7pqm-3xz9r-twh4f-dn2ka" */
export function generatePassword(): string {
  const bytes = new Uint32Array(20);
  crypto.getRandomValues(bytes);
  const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]);
  return [0, 5, 10, 15].map((i) => chars.slice(i, i + 5).join("")).join("-");
}
