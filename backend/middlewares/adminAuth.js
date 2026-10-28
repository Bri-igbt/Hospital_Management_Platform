import { getAuth } from "@clerk/express";
import { createClerkClient, verifyToken } from "@clerk/backend";

const getAdminSecret = () => (process.env.ADMIN_CLERK_SECRET_KEY || "").trim();

let adminClient = null;
const getAdminClient = () => {
  if (!adminClient) {
    adminClient = createClerkClient({
      secretKey: getAdminSecret(),
    });
  }
  return adminClient;
};

const getBearer = (req) => {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
};

const verifyAdminToken = async (req) => {
  const secretKey = getAdminSecret();
  const token = getBearer(req);
  if (!secretKey || !token) return null;

  try {
    const result = await verifyToken(token, { secretKey });
    const payload = result?.data ?? result;
    return payload?.sub || null;
  } catch {
    return null;
  }
};

const hasAdminRole = async (userId) => {
  const user = await getAdminClient().users.getUser(userId);
  return user.publicMetadata?.role === "admin";
};

// Admin only
export const requireAdmin = async (req, res, next) => {
  try {
    if (!getAdminSecret()) {
      return res.status(500).json({
        success: false,
        message: "ADMIN_CLERK_SECRET_KEY is not set on the server",
      });
    }

    const userId = await verifyAdminToken(req);
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized",
      });
    }

    if (!(await hasAdminRole(userId))) {
      return res.status(403).json({
        success: false,
        message: "Admin access only",
      });
    }

    req.isAdmin = true;
    req.adminUserId = userId;
    next();
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};

export const adminOr = (fallback) => async (req, res, next) => {
  try {
    const adminId = await verifyAdminToken(req);

    if (adminId) {
      if (!(await hasAdminRole(adminId))) {
        return res.status(403).json({
          success: false,
          message: "Admin access only",
        });
      }
      req.isAdmin = true;
      req.adminUserId = adminId;
      return next();
    }
  } catch (err) {
    console.error("adminOr error:", err);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }

  return fallback(req, res, next);
};

const requireUser = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Unauthorized",
    });
  }
  next();
};

export const requireUserOrAdmin = adminOr(requireUser);
