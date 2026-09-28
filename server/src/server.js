import { app } from "./app.js";
import { config, connectDb } from "./config.js";

try {
  await connectDb();
  app.locals.dbStatus = "connected";
  app.listen(config.port, () => console.log(`InfraLife API on ${config.port}`));
} catch (error) {
  app.locals.dbStatus = "disconnected";
  console.error(error.message);
  process.exit(1);
}
