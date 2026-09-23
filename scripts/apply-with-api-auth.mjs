/**
 * One-shot helper: wrap AUTH_REQUIRED / AUTH_OPTIONAL route handlers with withApiAuth.
 * Skips PUBLIC and EXTERNAL_INTEGRATION routes from the registry.
 */
import fs from "node:fs";
import path from "node:path";

const root = path.resolve("app/api");
const skipFiles = new Set([
  "auth/login/route.ts",
  "feeds/cian/long-term.xml/route.ts",
  "feeds/cian/sale.xml/route.ts",
  "integrations/avito/callback/route.ts",
]);

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name === "route.ts") out.push(full);
  }
  return out;
}

const importLine = 'import { withApiAuth } from "@/lib/auth/with-api-auth";';

function ensureRequestParam(params) {
  const trimmed = params.trim();
  if (!trimmed) return "request: Request";
  if (/\brequest\s*:/.test(trimmed) || /\brequest\b/.test(trimmed.split(",")[0] || "")) {
    return trimmed;
  }
  return `request: Request, ${trimmed}`;
}

function transform(src) {
  if (src.includes("withApiAuth(") && src.includes("export const GET") || src.includes("export const POST")) {
    // already partially wrapped — still process any remaining function exports
  }

  let next = src;
  if (!next.includes(importLine) && !next.includes('from "@/lib/auth/with-api-auth"')) {
    const lines = next.split("\n");
    let lastImport = -1;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].startsWith("import ")) lastImport = i;
    }
    lines.splice(lastImport + 1, 0, importLine);
    next = lines.join("\n");
  }

  // Convert export async function METHOD(...) { ... } to export const METHOD = withApiAuth(async (...) => { ... });
  // Use brace matching for the function body.
  const methodRe = /export async function (GET|POST|PUT|PATCH|DELETE)\s*\(([^)]*)\)\s*\{/g;
  let match;
  const replacements = [];
  while ((match = methodRe.exec(next)) !== null) {
    const method = match[1];
    const params = ensureRequestParam(match[2]);
    const bodyStart = match.index + match[0].length;
    let depth = 1;
    let i = bodyStart;
    while (i < next.length && depth > 0) {
      const ch = next[i];
      if (ch === "{") depth++;
      else if (ch === "}") depth--;
      i++;
    }
    const bodyEnd = i - 1; // position of closing brace
    const body = next.slice(bodyStart, bodyEnd);
    const fullStart = match.index;
    const fullEnd = i;
    const replacement = `export const ${method} = withApiAuth(async (${params}) => {${body}});`;
    replacements.push({ fullStart, fullEnd, replacement });
  }

  // Apply from end to start so indices stay valid
  for (let r = replacements.length - 1; r >= 0; r--) {
    const { fullStart, fullEnd, replacement } = replacements[r];
    next = next.slice(0, fullStart) + replacement + next.slice(fullEnd);
  }

  return next;
}

const files = walk(root);
let changed = 0;
for (const file of files) {
  const rel = path.relative(root, file).replaceAll("\\", "/");
  if (skipFiles.has(rel)) continue;
  // skip auth/me and auth/logout if already wrapped manually
  const src = fs.readFileSync(file, "utf8");
  if (!/export async function (GET|POST|PUT|PATCH|DELETE)/.test(src)) {
    continue;
  }
  const out = transform(src);
  if (out !== src) {
    fs.writeFileSync(file, out);
    changed++;
    console.log("wrapped", rel);
  }
}
console.log("changed", changed);
