import jwt from "jsonwebtoken";
import { config } from "./config.js";
export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
export const authenticate = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token)
      return res
        .status(401)
        .json({ success: false, error: "Authentication required" });
    req.user = jwt.verify(token, config.jwt);
    next();
  } catch {
    return res.status(401).json({ success: false, error: "Invalid token" });
  }
};
export const authorize =
  (...roles) =>
  (req, res, next) =>
    roles.includes(req.user.role)
      ? next()
      : res
          .status(403)
          .json({ success: false, error: "Insufficient permissions" });
export const errorHandler = (err, req, res, next) => {
  console.error(err.message);
  res
    .status(err.status || 500)
    .json({
      success: false,
      error:
        process.env.NODE_ENV === "production"
          ? "Server error"
          : err.message || "Server error",
    });
};
export const ok = (res, data, status = 200) =>
  res.status(status).json({ success: true, data });
