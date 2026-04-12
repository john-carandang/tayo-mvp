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
