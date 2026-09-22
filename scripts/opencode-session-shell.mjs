#!/usr/bin/env node
// scripts/opencode-session-shell.mjs
// Bounded OpenCode SessionShell adapter — Package 022 operational execution.
// OpenCode remains permission authority and process executor.
// This adapter calls SessionShell API only; no direct process execution.

import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve, normalize } from "node:path";
import { realpathSync } from "node:fs";
import { homedir } from "node:os";

// ── Closed operation registry ──────────────────────────────────────────
const OPERATIONS = Object.freeze({
  canary: { agent: "numlock-ops", command: "clasp status" },
  "package022-runner": { agent: "numlock-ops", command: "clasp run runAllBackendTests" },
  "package022-diagnostic": { agent: "numlock-ops", command: "clasp run runAllBackendTestsDiagnostic" },
});

// ── CLI argument parsing ───────────────────────────────────────────────
function parseArgs(argv) {
  const args = argv.slice(2);
  const parsed = { operation: null, session: null };

  let i = 0;
  while (i < args.length) {
    if (args[i] === "--session") {
      if (i + 1 >= args.length) fail("Missing value for --session");
      if (parsed.session !== null) fail("Duplicate --session");
      parsed.session = args[++i];
    } else if (args[i].startsWith("--")) {
      fail(`Unknown flag: ${args[i]}`);
    } else if (parsed.operation !== null) {
      fail(`Unexpected positional argument: ${args[i]}`);
    } else {
      parsed.operation = args[i];
    }
    i++;
  }

  if (!parsed.operation) fail("Missing required operation argument");
  if (!OPERATIONS[parsed.operation]) fail(`Unknown operation: ${parsed.operation}`);
  return parsed;
}

// ── Repository root derivation (portable, no hardcoded user path) ──────
const ADAPTER_PATH = normalize(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = dirname(ADAPTER_PATH);
const REPO_ROOT = realpathSync(resolve(SCRIPTS_DIR, ".."));

// ── SDK resolution — returns filesystem path for dynamic import (ESM) ──
function resolveSDK() {
  // 1. Normal Node module resolution via createRequire().resolve()
  try {
    const req = createRequire(resolve(REPO_ROOT, "package.json"));
    return req.resolve("@opencode-ai/sdk/client");
  } catch { /* fall through */ }

  // 2. OpenCode config directory fallback
  const fallback = resolve(homedir(), ".config", "opencode", "node_modules", "@opencode-ai", "sdk", "dist", "client.js");
  try {
    const req = createRequire(fallback);
    return req.resolve(fallback);
  } catch { /* fall through */ }

  fail("Cannot resolve @opencode-ai/sdk — neither project nor OpenCode config SDK found");
}

// ── Server discovery ───────────────────────────────────────────────────
function resolveServerURL() {
  const raw = process.env.OPENCODE_SERVER_URL || "http://127.0.0.1:4096";
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`Invalid OPENCODE_SERVER_URL: ${raw}`);
  }

  // Loopback-only enforcement
  const loopback = ["127.0.0.1", "::1", "localhost", "[::1]"];
  if (!loopback.includes(url.hostname)) {
    fail(`Non-local server rejected: ${url.hostname}`);
  }

  return url.origin;
}

// ── Result output ──────────────────────────────────────────────────────
function emitResult(data) {
  process.stdout.write(JSON.stringify(data) + "\n");
}

// ── Secret redaction ─────────────────────────────────────────────────
const REDACT_KEYS = new Set([
  "authorization", "cookie", "set-cookie", "token",
  "access_token", "refresh_token", "client_secret", "password", "secret",
]);

function redactSecrets(value) {
  if (value === null || value === undefined || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redactSecrets);
  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      out[k] = redactSecrets(v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

function sanitizeError(err) {
  if (err == null) return "Unknown error";
  if (err instanceof Error) return err.message || "Unknown error";
  if (typeof err === "string") return err || "Unknown error";
  if (typeof err === "object") {
    // SDK tuple-path errors are POJOs: { data: { message }, message, name, ... }
    // Extract safe diagnostic fields without leaking secrets.
    const safe = ["message", "name", "code", "status", "statusCode", "type", "detail"];
    const parts = [];
    for (const key of safe) {
      if (typeof err[key] === "string" && err[key]) parts.push(`${key}: ${err[key]}`);
    }
    // Handle nested data.message (common NamedError shape from opencode server)
    if (err.data && typeof err.data === "object") {
      if (typeof err.data.message === "string" && err.data.message) {
        parts.push(`data.message: ${err.data.message}`);
      }
      if (typeof err.data.code === "string" && err.data.code) parts.push(`data.code: ${err.data.code}`);
    }
    // Handle .cause from wrapClientError (throwOnError path)
    if (err.cause && typeof err.cause === "object") {
      if (typeof err.cause.status === "number") parts.push(`httpStatus: ${err.cause.status}`);
    }
    return parts.length > 0 ? parts.join("; ") : "Unknown error";
  }
  return "Unknown error";
}

function fail(message) {
  emitResult({ error: message });
  process.exit(1);
}

// ── Main ───────────────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);
  const op = OPERATIONS[args.operation];
  const serverURL = resolveServerURL();

  // SDK — resolve path, convert to file URL, dynamic ESM import
  let createOpencodeClient;
  try {
    const sdkPath = resolveSDK();
    const sdkModule = await import(pathToFileURL(sdkPath).href);
    createOpencodeClient = sdkModule.createOpencodeClient;
  } catch (err) {
    fail(`SDK import failed: ${sanitizeError(err)}`);
  }

  const client = createOpencodeClient({
    baseUrl: serverURL,
    directory: REPO_ROOT,
  });

  // ── Session discovery ──────────────────────────────────────────────
  let sessionID;
  try {
    if (args.session) {
      // Manual session — still validate directory binding
      const { data: session, error: sessErr } = await client.session.get({
        path: { id: args.session },
        query: { directory: REPO_ROOT },
      });
      if (sessErr || !session) fail(`Session ${args.session} not found`);
      const sessionDir = normalize(session.directory || session.worktree || "");
      if (!sessionDir || normalize(sessionDir) !== REPO_ROOT) {
        fail(`Directory mismatch: session="${sessionDir}" expected="${REPO_ROOT}"`);
      }
      sessionID = session.id;
    } else {
      // Auto-discover: list sessions filtered by directory
      const { data: sessions, error: listErr } = await client.session.list({
        query: { directory: REPO_ROOT },
      });
      if (listErr) fail(`Session list failed: ${sanitizeError(listErr)}`);
      if (!sessions || !Array.isArray(sessions)) fail("Session list returned invalid data");

      const matches = sessions.filter((s) => {
        const dir = normalize(s.directory || s.worktree || "");
        return dir && normalize(dir) === REPO_ROOT;
      });

      if (matches.length === 0) fail("No sessions match NUMLOCK repository");
      if (matches.length > 1) fail(`Ambiguous sessions (${matches.length}) match NUMLOCK repository`);
      sessionID = matches[0].id;
    }
  } catch (err) {
    fail(`Session discovery failed: ${sanitizeError(err)}`);
  }

  // ── SessionShell invocation ────────────────────────────────────────
  const result = {
    operation: args.operation,
    agent: op.agent,
    command: op.command,
    sessionID,
    directory: REPO_ROOT,
    serverURL,
    shellInvocationAttempted: false,
    permissionOutcome: "unproven",
    processStarted: "unproven",
    shellCompleted: false,
    exitCode: null,
    stdout: "",
    stderr: "",
    error: null,
  };

  try {
    result.shellInvocationAttempted = true;
    const response = await client.session.shell({
      path: { id: sessionID },
      body: { agent: op.agent, command: op.command },
      query: { directory: REPO_ROOT },
    });

    if (response.error) {
      const errMsg = sanitizeError(redactSecrets(response.error));
      if (errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("permission")) {
        result.permissionOutcome = "deny";
      }
      result.error = errMsg;
      emitResult(result);
      process.exit(1);
    }

    // Extract shell output from response
    const shellData = response.data;
    if (shellData) {
      // SessionShell returns { info: Message, parts: Array<Part> }
      // Look for shell-type parts containing output
      const parts = shellData.parts || [];
      for (const part of parts) {
        if (part.type === "tool" && part.tool === "bash") {
          const state = part.state;
          if (state && state.status === "completed") {
            result.processStarted = true;
            result.shellCompleted = true;
            result.stdout = state.output || "";
          } else if (state && state.status === "error") {
            result.processStarted = "unproven";
            result.error = state.error || "Shell process error";
          }
        }
      }

      // If we got a response but couldn't extract structured shell data,
      // report what we can observe
      if (result.processStarted === "unproven" && !result.error) {
        result.error = "Shell response received but output structure unrecognizable";
        result.permissionOutcome = result.permissionOutcome === "unproven" ? "allow" : result.permissionOutcome;
      } else if (result.processStarted === true && result.permissionOutcome === "unproven") {
        result.permissionOutcome = "allow";
      }
    }
  } catch (err) {
    // SDK errors from throwOnError path carry { cause: { body, status } }
    // from wrapClientError — surface body fields for diagnostics.
    const diagnostic = (err && typeof err === "object" && err.cause)
      ? redactSecrets(err.cause.body || err.cause) : err;
    const errMsg = sanitizeError(diagnostic);
    if (errMsg.toLowerCase().includes("denied") || errMsg.toLowerCase().includes("permission")) {
      result.permissionOutcome = "deny";
    }
    result.error = errMsg;
    emitResult(result);
    process.exit(1);
  }

  emitResult(result);

  if (result.error || !result.shellCompleted) {
    process.exit(1);
  }
}

main().catch((err) => {
  const diagnostic = (err && typeof err === "object" && err.cause)
    ? redactSecrets(err.cause.body || err.cause) : err;
  emitResult({ error: sanitizeError(diagnostic) });
  process.exit(1);
});
