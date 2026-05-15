import jwt from "jsonwebtoken";

export function requireAuth(req, res, next) {
  try {
    const auth = req.headers.authorization;

    if (!auth?.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Bearer token required.",
      });
    }

    const token = auth.replace("Bearer ", "");

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.operator = decoded;

    next();
  } catch (err) {
    return res.status(401).json({
      error: "Invalid token.",
    });
  }
}
