import express, { type Express } from "express";
import cors from "cors";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pinoHttp = require("pino-http");
import { logger } from "./lib/logger";
import router from "./routes";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
	req(req: any) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
	res(res: any) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/api", router);

export default app;
