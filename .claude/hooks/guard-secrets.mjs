#!/usr/bin/env node
// PreToolUse : empêche d'écrire une clé secrète dans un fichier du projet ou de la commiter.
// Les clés passent par les variables d'environnement (ANTHROPIC_API_KEY), jamais par le code.
import { execSync } from 'node:child_process';

const PATTERNS = [
  [/sk-ant-(api|admin)\d{2}-[A-Za-z0-9_-]{20,}/, 'clé API Anthropic'],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}\b/, 'jeton GitHub'],
  [/\bAKIA[0-9A-Z]{16}\b/, 'clé AWS'],
  [/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/, 'clé privée'],
];
const find = text => PATTERNS.find(([re]) => re.test(text || ''))?.[1];

let raw = '';
for await (const c of process.stdin) raw += c;
const { tool_name: tool, tool_input: input = {}, cwd } = JSON.parse(raw || '{}');

let found = null, where = '';
if (tool === 'Write') { found = find(input.content); where = input.file_path; }
else if (tool === 'Edit') { found = find(input.new_string); where = input.file_path; }
else if (tool === 'MultiEdit') { found = find((input.edits || []).map(e => e.new_string).join('\n')); where = input.file_path; }
else if (tool === 'Bash' && /\bgit\s+(commit|push)\b/.test(input.command || '')) {
  try {
    const diff = execSync('git diff --cached -U0; git log --branches --not --remotes -p -U0 2>/dev/null', { cwd, encoding: 'utf8', maxBuffer: 64 << 20 });
    found = find(diff.split('\n').filter(l => l.startsWith('+')).join('\n'));
    where = 'les changements à commiter ou à pousser';
  } catch { /* pas un dépôt git : rien à vérifier */ }
}

if (found) {
  console.error(`Bloqué : ${found} détectée dans ${where}. Ne mets jamais de secret dans le dépôt : lis-le depuis une variable d'environnement (ex. ANTHROPIC_API_KEY) et retire-le des changements.`);
  process.exit(2);
}
