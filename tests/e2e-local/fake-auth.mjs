/**
 * A tiny stand-in for Supabase Auth (GoTrue) so the whole app can run end-to-end on a laptop
 * with plain Postgres. Implements only the endpoints @supabase/ssr + supabase-js call:
 * password sign-in / sign-up (auto-confirmed), refresh, user, logout. Users live in the
 * real `auth.users` table (from tests/setup/supabase-shim.sql), so DB triggers run as usual.
 *
 * NEVER use outside local testing: any password except "wrong-password" is accepted.
 */
import { createHmac, randomUUID } from "node:crypto";
import http from "node:http";
import postgres from "postgres";

const PORT = Number(process.env.FAKE_AUTH_PORT ?? 54321);
const sql = postgres(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/app_e2e", { max: 2, onnotice: () => {} });
const SECRET = "fake-auth-local-secret";
const b64 = (v) => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");

function jwt(user) {
  const now = Math.floor(Date.now() / 1000);
  const head = b64({ alg: "HS256", typ: "JWT" });
  const body = b64({
    sub: user.id, email: user.email, role: "authenticated", aud: "authenticated",
    iat: now, exp: now + 3600, session_id: randomUUID(), user_metadata: user.user_metadata,
  });
  const sig = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}

function verify(token) {
  const [head, body, sig] = (token ?? "").split(".");
  if (!sig) return null;
  const expected = createHmac("sha256", SECRET).update(`${head}.${body}`).digest("base64url");
  if (expected !== sig) return null;
  const payload = JSON.parse(Buffer.from(body, "base64url").toString());
  return payload.exp > Date.now() / 1000 ? payload : null;
}

const toUser = (row) => ({
  id: row.id, aud: "authenticated", role: "authenticated", email: row.email,
  email_confirmed_at: new Date().toISOString(), user_metadata: row.raw_user_meta_data ?? {},
  app_metadata: { provider: "email", providers: ["email"] },
  identities: [{ id: row.id, provider: "email" }], created_at: row.created_at,
});

function session(user) {
  return {
    access_token: jwt(user), token_type: "bearer", expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: `rt.${user.id}.${randomUUID()}`, user,
  };
}

const send = (res, status, body) => {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(body === undefined ? "" : JSON.stringify(body));
};
const readBody = (req) => new Promise((ok) => {
  let data = "";
  req.on("data", (c) => (data += c));
  req.on("end", () => ok(data ? JSON.parse(data) : {}));
});
const findByEmail = async (email) => (await sql`select * from auth.users where lower(email) = lower(${email})`)[0];
const findById = async (id) => (await sql`select * from auth.users where id = ${id}`)[0];

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const path = url.pathname;
    if (req.method === "POST" && path === "/auth/v1/token") {
      const body = await readBody(req);
      const grant = url.searchParams.get("grant_type");
      if (grant === "password") {
        const row = await findByEmail(body.email);
        if (!row || body.password === "wrong-password") {
          return send(res, 400, { code: "invalid_credentials", error_code: "invalid_credentials", msg: "Invalid login credentials" });
        }
        return send(res, 200, session(toUser(row)));
      }
      if (grant === "refresh_token") {
        const id = String(body.refresh_token ?? "").split(".")[1];
        const row = id && (await findById(id));
        if (!row) return send(res, 400, { error_code: "refresh_token_not_found", msg: "Invalid Refresh Token" });
        return send(res, 200, session(toUser(row)));
      }
    }
    if (req.method === "POST" && path === "/auth/v1/signup") {
      const body = await readBody(req);
      if (await findByEmail(body.email)) {
        return send(res, 422, { code: "user_already_exists", error_code: "user_already_exists", msg: "User already registered" });
      }
      const [row] = await sql`insert into auth.users (email, raw_user_meta_data) values (${body.email}, ${sql.json(body.data ?? {})}) returning *`;
      return send(res, 200, session(toUser(row)));
    }
    if (req.method === "GET" && path === "/auth/v1/user") {
      const claims = verify(req.headers.authorization?.replace(/^Bearer /, ""));
      const row = claims && (await findById(claims.sub));
      if (!row) return send(res, 401, { code: "bad_jwt", msg: "invalid JWT" });
      return send(res, 200, toUser(row));
    }
    if (req.method === "POST" && path === "/auth/v1/logout") return send(res, 204);
    if (path === "/auth/v1/.well-known/jwks.json") return send(res, 200, { keys: [] });
    return send(res, 404, { msg: `fake-auth: ${req.method} ${path} not implemented` });
  } catch (err) {
    console.error(err);
    return send(res, 500, { msg: String(err) });
  }
}).listen(PORT, () => console.log(`fake auth on :${PORT}`));

/**
 * Fake Upstash REST (port 54322): every rate-limit script call answers "plenty left".
 * Lets `next start` (production mode, which insists on Upstash) run locally.
 */
const UPSTASH_PORT = Number(process.env.FAKE_UPSTASH_PORT ?? 54322);
http.createServer(async (req, res) => {
  const body = await readBody(req).catch(() => []);
  const commands = Array.isArray(body[0]) ? body : [body];
  const answer = (cmd) => {
    const name = String(cmd[0] ?? "").toLocaleLowerCase("en-US");
    if (name === "evalsha" || name === "eval") return { result: [1000, 1000] };
    return { result: null };
  };
  const pipeline = req.url?.includes("pipeline") || req.url?.includes("multi-exec");
  send(res, 200, pipeline ? commands.map(answer) : answer(commands[0]));
}).listen(UPSTASH_PORT, () => console.log(`fake upstash on :${UPSTASH_PORT}`));
