import { Router, type IRouter, type Request, type Response } from "express";
import { readFile } from "fs/promises";
import { fileURLToPath } from "url";
import path from "path";

const router: IRouter = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// POST /api/admin/migrate — run initial migration using SUPABASE_DB_URL
// This endpoint is for one-time setup. Requires SUPABASE_DB_URL secret.
router.post("/admin/migrate", async (req: Request, res: Response) => {
  const adminKey = req.headers["x-admin-key"];
  if (!adminKey || adminKey !== process.env.ADMIN_MIGRATE_KEY) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const dbUrl = process.env.SUPABASE_DB_URL;
  if (!dbUrl) {
    res.status(400).json({
      error: "SUPABASE_DB_URL not set",
      instructions: "Add your Supabase direct connection string as SUPABASE_DB_URL in Replit Secrets. Find it in: Supabase Dashboard → Settings → Database → Connection string → Session mode",
    });
    return;
  }

  try {
    const { default: pg } = await import("pg");
    const client = new pg.Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const sqlPath = path.resolve(__dirname, "../../../../supabase/migrations/001_initial.sql");
    let sql: string;
    try {
      sql = await readFile(sqlPath, "utf8");
    } catch {
      const altPath = path.resolve(process.cwd(), "../../supabase/migrations/001_initial.sql");
      sql = await readFile(altPath, "utf8");
    }

    await client.query(sql);
    await client.end();

    res.json({ success: true, message: "Migration completed successfully" });
  } catch (err) {
    req.log.error({ err }, "Migration error");
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: "Migration failed", details: message });
  }
});

// POST /api/admin/test-user — create an auto-confirmed test user (dev only)
// Used by e2e tests to bypass email confirmation. NOT available in production.
router.post("/admin/test-user", async (req: Request, res: Response) => {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Not available in production" });
    return;
  }
  const body = req.body && typeof req.body === "object" ? req.body : {};
  const email = typeof body.email === "string" ? body.email.slice(0, 200) : "";
  const password = typeof body.password === "string" ? body.password.slice(0, 200) : "";
  if (!email || !password) { res.status(400).json({ error: "email and password required" }); return; }

  try {
    const { supabase } = await import("../lib/supabase.js");
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.toLowerCase().includes("already been registered") || error.message.toLowerCase().includes("already registered")) {
        // User exists — find them by email and update their password
        const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        const existing = list?.users?.find((u: { email?: string }) => u.email === email);
        if (existing) {
          await supabase.auth.admin.updateUserById(existing.id, { password, email_confirm: true });
          res.json({ userId: existing.id, email, message: "Test user already exists — password reset" });
          return;
        }
      }
      res.status(400).json({ error: error.message });
      return;
    }

    res.json({ userId: data.user.id, email, message: "Test user created and confirmed" });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.status(500).json({ error: message });
  }
});

// GET /api/admin/health — check if tables are set up
router.get("/admin/health", async (req: Request, res: Response) => {
  try {
    const { supabase } = await import("../lib/supabase.js");
    const { error } = await supabase.from("user_profiles").select("id").limit(1);
    res.json({
      tablesReady: !error,
      error: error?.message ?? null,
      instructions: error ? "Run the database migration. See supabase/migrations/001_initial.sql" : null,
    });
  } catch (err) {
    res.status(500).json({ error: "Health check failed" });
  }
});

export default router;
