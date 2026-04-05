import type { HookInput } from "../types.js";

export async function readStdin(): Promise<HookInput> {
  return new Promise((resolve, reject) => {
    let data = "";

    process.stdin.setEncoding("utf-8");
    process.stdin.on("data", (chunk) => {
      data += chunk;
    });

    process.stdin.on("end", () => {
      try {
        const parsed = JSON.parse(data) as HookInput;
        resolve(parsed);
      } catch (err) {
        reject(new Error(`Failed to parse hook stdin JSON: ${err}`));
      }
    });

    process.stdin.on("error", (err) => {
      reject(new Error(`Failed to read stdin: ${err.message}`));
    });

    setTimeout(() => {
      reject(new Error("Stdin read timed out after 5s"));
    }, 5000);
  });
}
