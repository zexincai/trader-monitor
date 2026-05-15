import config from "../config.js";

export function requireApiToken(req, res, next) {
  const token = config.server.apiToken;
  if (!token) return next();

  const auth = req.get("authorization") || "";
  const bearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const headerToken = req.get("x-api-token") || "";

  if (bearer === token || headerToken === token) return next();

  return res.status(401).json({ code: -1, msg: "Unauthorized" });
}
