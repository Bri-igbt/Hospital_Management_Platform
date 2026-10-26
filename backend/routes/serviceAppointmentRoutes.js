import express from "express";
import { getAuth } from "@clerk/express";
import {
  cancelServiceAppointment,
  confirmServicePayment,
  createServiceAppointment,
  getServiceAppointment,
  getServiceAppointmentById,
  getServiceAppointmentByPatient,
  getServiceAppointmentStats,
  updateServiceAppointment,
} from "../controllers/serviceAppointmentController.js";

const serviceAppointmentRouter = express.Router();

const requireUser = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized" 
    });
  }
  next();
};

const requireAdmin = (req, res, next) => {
  const { userId } = getAuth(req);
  if (!userId) {
    return res.status(401).json({ 
      success: false, 
      message: "Unauthorized" 
    });
  }
  if (!process.env.MAJOR_ADMIN_ID || userId !== process.env.MAJOR_ADMIN_ID) {
    return res
      .status(403)
      .json({ 
        success: false, 
        message: "Admin access only" 
      });
  }
  next();
};

serviceAppointmentRouter.get(
  "/", 
  requireAdmin, 
  getServiceAppointment
);

serviceAppointmentRouter.get(
  "/stats/summary",
  requireAdmin,
  getServiceAppointmentStats
);

serviceAppointmentRouter.get(
  "/me",
  requireUser,
  getServiceAppointmentByPatient
);

serviceAppointmentRouter.post(
  "/", 
  requireUser, 
  createServiceAppointment
);

serviceAppointmentRouter.get(
  "/confirm", 
  confirmServicePayment
);

serviceAppointmentRouter.get(
  "/:id", 
  requireUser, 
  getServiceAppointmentById
);

serviceAppointmentRouter.put(
  "/:id", 
  requireUser, 
  updateServiceAppointment
);

serviceAppointmentRouter.post(
  "/:id/cancel",
  requireUser,
  cancelServiceAppointment
);

serviceAppointmentRouter.post(
  "/:id", 
  requireUser, 
  cancelServiceAppointment
);

export default serviceAppointmentRouter;
