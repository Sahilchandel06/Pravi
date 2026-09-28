import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";
import { config } from "./config.js";
import { router } from "./routes.js";
import { errorHandler } from "./middleware.js";

export const app = express();
app.set("trust proxy", 1);
app.use(cors({ origin: config.clientUrl }));
app.use(helmet());
app.use(compression());
app.use(morgan("tiny"));
app.use(express.json());
app.use("/api", router);
app.use(errorHandler);
