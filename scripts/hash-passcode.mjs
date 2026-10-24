#!/usr/bin/env node
// Generates a CLASS_PASSCODE_HASH value. The passcode is read from a hidden prompt
// (or from stdin when piped), so it never lands in shell history.
import { randomBytes, scrypt } from "node:crypto";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";

export const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, keyLength: 32 };

/** Returns `scrypt:N:r:p:saltB64:hashB64` (no `$`, so .env variable expansion leaves it intact). */
export function hashPasscode(passcode, params = SCRYPT_PARAMS) {
  const salt = randomBytes(16);
  const { N, r, p, keyLength } = params;
  return new Promise((resolve, reject) => {
    scrypt(passcode.normalize("NFC"), salt, keyLength, { N, r, p, maxmem: 256 * N * r }, (error, key) => {
      if (error) reject(error);
      else resolve(["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join(":"));
    });
  });
}

function readHidden(prompt) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.startsWith(prompt)) rl.output.write(prompt);
    };
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

async function readPiped() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, "");
}

async function main() {
  let passcode;
  if (process.stdin.isTTY) {
    passcode = await readHidden("Class passcode: ");
    const confirmation = await readHidden("Repeat passcode: ");
    if (passcode !== confirmation) {
      console.error("Passcodes do not match.");
      process.exit(1);
    }
  } else {
    passcode = await readPiped();
  }
  if (passcode.length < 8) {
    console.error("Use a passcode of at least 8 characters.");
    process.exit(1);
  }
  console.log(await hashPasscode(passcode));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
