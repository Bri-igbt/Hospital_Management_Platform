"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { dashboardStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Banknote,
  CalendarRange,
  CheckCircle,
  User,
  UserRoundCheck,
  XCircle,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PATIENT_COUNT_API = `${API_BASE}/api/appointments/patients/count`;

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Formats numbers as Naira, e.g. ₦12,500
const formatMoney = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(safeNumber(amount, 0));

function normalizeDoctor(doc) {
  const id = doc._id || doc.id || String(Math.random()).slice(2);
  const name =
    doc.name ||
    doc.fullName ||
    `${doc.firstName || ""} ${doc.lastName || ""}`.trim() ||
    "Unknown";
  const specialization =
    doc.specialization ||
    doc.speciality ||
    (Array.isArray(doc.specializations)
      ? doc.specializations.join(", ")
      : "") ||
    "General";
  const fee = safeNumber(
    doc.fee ?? doc.fees ?? doc.consultationFee ?? doc.consultation_fee ?? 0,
    0
  );
  const image =
    doc.imageUrl ||
    doc.image ||
    doc.avatar ||
    `https://i.pravatar.cc/150?u=${id}`;

  const appointments = {
    total:
      doc.appointments?.total ??
      doc.totalAppointments ??
      doc.appointmentsTotal ??
      0,
    completed:
      doc.appointments?.completed ??
      doc.completedAppointments ??
      doc.appointmentsCompleted ??
      0,
    canceled:
      doc.appointments?.canceled ??
      doc.canceledAppointments ??
      doc.appointmentsCanceled ??
      0,
  };

  let earnings = null;
  if (doc.earnings !== undefined && doc.earnings !== null)
    earnings = safeNumber(doc.earnings, 0);
  else if (doc.revenue !== undefined && doc.revenue !== null)
    earnings = safeNumber(doc.revenue, 0);
  else if (appointments.completed && fee)
    earnings = fee * safeNumber(appointments.completed, 0);
  else earnings = 0;

  return {
    id,
    name,
    specialization,
    fee,
    image,
    appointments,
    earnings,
    raw: doc,
  };
}

export default function DashboardOverview() {
  const { getToken } = useAuth();

  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [patientCount, setPatientCount] = useState(null);
  const [patientCountLoading, setPatientCountLoading] = useState(false);

  // Doctors
  useEffect(() => {
    let mounted = true;
    async function loadDoctors() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/doctors?limit=200`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || `Failed to fetch doctors (${res.status})`
          );
        }
        const body = await res.json();
        let list = [];
        if (Array.isArray(body)) list = body;
        else if (Array.isArray(body.doctors)) list = body.doctors;
        else if (Array.isArray(body.data)) list = body.data;
        else if (Array.isArray(body.items)) list = body.items;
        else {
          const firstArray = Object.values(body).find((v) => Array.isArray(v));
          if (firstArray) list = firstArray;
        }
        if (mounted) setDoctors(list.map((d) => normalizeDoctor(d)));
      } catch (err) {
        console.error("Failed to load doctors:", err);
        if (mounted) {
          setError(err.message || "Failed to load doctors");
          setDoctors([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    loadDoctors();
    return () => {
      mounted = false;
    };
  }, []);

  // Registered users count (admin-only endpoint, so it needs a fresh Clerk token)
  useEffect(() => {
    let mounted = true;
    async function loadPatientCount() {
      setPatientCountLoading(true);
      try {
        const token = await getToken();
        if (!token) throw new Error("No auth token");

        const res = await fetch(PATIENT_COUNT_API, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          console.warn("Patient count fetch failed:", res.status);
          if (mounted) setPatientCount(null);
          return;
        }

        const body = await res.json().catch(() => ({}));
        const count = Number(body?.totalUsers ?? body?.count ?? body?.data);
        if (mounted) setPatientCount(Number.isFinite(count) ? count : null);
      } catch (err) {
        console.error("Failed to fetch patient count:", err);
        if (mounted) setPatientCount(null);
      } finally {
        if (mounted) setPatientCountLoading(false);
      }
    }
    loadPatientCount();
    return () => {
      mounted = false;
    };
  }, [getToken]);

  const totals = useMemo(() => {
    const sum = (pick) =>
      doctors.reduce((acc, d) => acc + safeNumber(pick(d), 0), 0);

    return {
      totalDoctors: doctors.length,
      totalAppointments: sum((d) => d.appointments?.total),
      totalEarnings: sum((d) => d.earnings),
      completed: sum((d) => d.appointments?.completed),
      canceled: sum((d) => d.appointments?.canceled),
    };
  }, [doctors]);

  // Search + "show more" for the doctor list you add below the stat cards
  const filteredDoctors = useMemo(() => {
    if (!query) return doctors;
    const q = query.trim().toLowerCase();
    const qNum = Number(q);
    return doctors.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      if ((d.specialization || "").toLowerCase().includes(q)) return true;
      if (d.fee.toString().includes(q)) return true;
      if (!Number.isNaN(qNum) && d.fee <= qNum) return true;
      return false;
    });
  }, [doctors, query]);

  const INITIAL_COUNT = 8;
  const visibleDoctors = showAll
    ? filteredDoctors
    : filteredDoctors.slice(0, INITIAL_COUNT);

  return (
    <div className={s.pageContainer}>
      <div className={s.maxWidthContainer}>
        <div className={s.headerContainer}>
          <div>
            <h1 className={s.headerTitle}>DASHBOARD</h1>
            <p className={s.headerSubtitle}>
              Overview of doctors & appointments
            </p>
          </div>
        </div>

        {loading && (
          <p className="text-sm text-gray-500 mb-4">Loading doctors...</p>
        )}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className={s.statsGrid}>
          <StatCard
            icon={<User className="w-6 h-6" />}
            label="Total Doctors"
            value={totals.totalDoctors}
          />

          <StatCard
            icon={<UserRoundCheck className="w-6 h-6" />}
            label="Total Registered Users"
            value={patientCountLoading ? "Loading..." : patientCount ?? "0"}
          />

          <StatCard
            icon={<CalendarRange className="w-6 h-6" />}
            label="Total Appointments"
            value={totals.totalAppointments}
          />

          <StatCard
            icon={<Banknote className="w-6 h-6" />}
            label="Total Earnings"
            value={formatMoney(totals.totalEarnings)}
          />

          <StatCard
            icon={<CheckCircle className="w-6 h-6" />}
            label="Completed"
            value={totals.completed}
          />

          <StatCard
            icon={<XCircle className="w-6 h-6" />}
            label="Canceled"
            value={totals.canceled}
          />
        </div>

        
      </div>
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className={s.statCard}>
      <div className={s.statCardContent}>
        <div className={s.statIconContainer}>{icon}</div>
        <div className="flex-1">
          <div className={s.statLabel}>{label}</div>
          <div className={s.statValue}>{value}</div>
        </div>
      </div>
    </div>
  );
}
