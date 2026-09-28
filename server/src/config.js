import "dotenv/config";
import mongoose from "mongoose";
export const config = {
  port: Number(process.env.PORT || 4000),
  mongo: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/infralife",
  jwt: process.env.JWT_SECRET || "development-secret",
  clientUrl: process.env.CLIENT_URL || "http://localhost:5173",
};
export const connectDb = () => mongoose.connect(config.mongo);
