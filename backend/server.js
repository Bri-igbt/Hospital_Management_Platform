import express from 'express'
import cors from 'cors'
import 'dotenv/config'
import { clerkMiddleware } from "@clerk/express";
import { connectDB } from './configs/db.js';
import doctorRouter from './routes/doctorRoutes.js';
import serviceRouter from './routes/serviceRoutes.js';
import appointmentRouter from './routes/appointmentRoutes.js';

const app = express();
const PORT = 8000;

// MIDDLEWARE
app.use(cors());
app.use(clerkMiddleware());
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ limit: "20mb", extended: true }));


// DB
connectDB();

// ROUTES
app.use("/api/doctors", doctorRouter);
app.use("/api/services", serviceRouter);
app.use("/api/appointments", appointmentRouter);

app.get("/", (req, res) => {
  res.send("API WORKING")
});

app.listen(PORT, () => {
  console.log(`Server Started on http://localhost:${PORT}`)
});