import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import chatRouter from "./chat.js";
import authRouter from "./auth.js";
import sessionsRouter from "./sessions.js";
import assignmentsRouter from "./assignments.js";
import migrateRouter from "./migrate.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(chatRouter);
router.use(authRouter);
router.use(sessionsRouter);
router.use(assignmentsRouter);
router.use(migrateRouter);

export default router;
