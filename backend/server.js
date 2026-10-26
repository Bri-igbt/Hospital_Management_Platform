import express from "express";
import cors from "cors";
import multer from "multer";
import "dotenv/config";
import { clerkMiddleware } from "@clerk/express";
import { connectDB } from "./configs/db.js";
import doctorRouter from "./routes/doctorRoutes.js";
import serviceRouter from "./routes/serviceRoutes.js";
import appointmentRouter from "./routes/appointmentRoutes.js";
import serviceAppointmentRouter from "./routes/serviceAppointmentRoutes.js";

const app = express();
const PORT = process.env.PORT || 8000;

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL, 
  process.env.ADMIN_URL, 
]
  .filter(Boolean)
  .map((o) => o.replace(/\/$/, ""));

// MIDDLEWARE
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use(clerkMiddleware());
app.use(express.json({ limit: "1mb" }));
app.use(
  express.urlencoded({
    limit: "1mb",
    extended: true,
  })
);

// ROUTES
app.use("/api/doctors", doctorRouter);
app.use("/api/services", serviceRouter);
app.use("/api/appointments", appointmentRouter);
app.use("/api/service-appointments", serviceAppointmentRouter);

app.get("/", (req, res) => {
  res.send("API WORKING");
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err?.message?.includes("images are allowed")) {
    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err?.type === "entity.parse.failed") {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON body",
    });
  }

  console.error("Unhandled error:", err);
  return res.status(500).json({
    success: false,
    message: "Server Error",
  });
});

const startServer = async () => {
  try {
    await connectDB();
    app.listen(PORT, () => {
      console.log(`Server Started on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
};

startServer();
