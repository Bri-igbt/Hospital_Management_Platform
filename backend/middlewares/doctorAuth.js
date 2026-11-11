import jwt from "jsonwebtoken";
import Doctor from "../models/Doctor.js";

export const doctorAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Doctor not authorized, token missing",
    });
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.error("JWT_SECRET is not set");
    return res.status(500).json({
      success: false,
      message: "Server Misconfigured",
    });
  }

  const token = authHeader.split(" ")[1];

  let payload;
  try {
    payload = jwt.verify(token, secret);
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Token invalid or expired",
    });
  }

  if (payload.role !== "doctor") {
    return res.status(403).json({
      success: false,
      message: "Access denied (not a doctor)",
    });
  }

  try {
    const doctor = await Doctor.findById(payload.id).select("-password");

    if (!doctor) {
      return res.status(401).json({
        success: false,
        message: "Doctor not found",
      });
    }

    req.doctor = doctor;
    return next();
  } catch (error) {
    console.error("doctorAuth lookup failed:", error);
    return res.status(500).json({
      success: false,
      message: "Server Error",
    });
  }
};
