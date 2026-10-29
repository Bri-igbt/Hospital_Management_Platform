"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@clerk/nextjs";
import { dashboardStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Banknote,
  CalendarRange,
  CheckCircle,
  Search,
  User,
  UserRoundCheck,
  XCircle,
} from "lucide-react";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PATIENT_COUNT_API = `${API_BASE}/api/appointments/patients/count`;
const INITIAL_COUNT = 8;

const safeNumber = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

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

  let earnings = 0;
  if (doc.earnings !== undefined && doc.earnings !== null)
    earnings = safeNumber(doc.earnings, 0);
  else if (doc.revenue !== undefined && doc.revenue !== null)
    earnings = safeNumber(doc.revenue, 0);
  else if (appointments.completed && fee)
    earnings = fee * safeNumber(appointments.completed, 0);

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [patientCount, setPatientCount] = useState(null);
  const [patientCountLoading, setPatientCountLoading] = useState(false);

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
        console.warn("Failed to load doctors:", err);
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
        console.warn("Failed to fetch patient count:", err);
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

  const filteredDoctors = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return doctors;
    const qNum = Number(q);
    return doctors.filter((d) => {
      if (d.name.toLowerCase().includes(q)) return true;
      if ((d.specialization || "").toLowerCase().includes(q)) return true;
      if (d.fee.toString().includes(q)) return true;
      if (!Number.isNaN(qNum) && d.fee <= qNum) return true;
      return false;
    });
  }, [doctors, query]);

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

        <div className={s.statsGrid}>
          <StatCard
            icon={<User className="w-6 h-6" />}
            label="Total Doctors"
            value={totals.totalDoctors}
          />

          <StatCard
            icon={<UserRoundCheck className="w-6 h-6" />}
            label="Total Registered Users"
            value={patientCountLoading ? "Loading..." : patientCount ?? 0}
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

        <div className="mb-6">
          <div className={s.searchLabel}>Search Doctors</div>
          <div className={s.searchContainer}>
            <div className={s.searchInputContainer}>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className={s.searchInput}
                placeholder="Search name / Specialization"
              />
              <Search className={s.searchIcon} />
            </div>

            <button
              className={s.clearButton + " " + s.cursorPointer}
              onClick={() => {
                setQuery("");
                setShowAll(false);
              }}
            >
              Clear
            </button>
          </div>
        </div>

        <div className={s.tableContainer}>
          <div className={s.tableHeader}>
            <h2 className={s.tableTitle}>Doctors</h2>
            <p className={s.tableCount}>
              {loading
                ? "Loading"
                : `Showing ${visibleDoctors.length} of ${filteredDoctors.length}`}
            </p>
          </div>

          {error && (
            <div className={s.errorContainer}>
              Error loading doctors: {error}
            </div>
          )}

          <div className={s.tableWrapper}>
            <table className={s.table}>
              <thead className={s.tableHead}>
                <tr>
                  <th className={s.tableHeaderCell}>Doctor</th>
                  <th className={s.tableHeaderCell}>Specialization</th>
                  <th className={s.tableHeaderCell}>Fee</th>
                  <th className={s.tableHeaderCell}>Appointments</th>
                  <th className={s.tableHeaderCell}>Completed</th>
                  <th className={s.tableHeaderCell}>Canceled</th>
                  <th className={s.tableHeaderCell}>Total Earnings</th>
                </tr>
              </thead>

              <tbody className={s.tableBody}>
                {visibleDoctors.map((d, idx) => (
                  <tr
                    key={d.id}
                    className={
                      s.tableRow +
                      " " +
                      (idx % 2 === 0 ? s.tableRowEven : s.tableRowOdd)
                    }
                  >
                    <td className={s.tableCell + " " + s.tableCellFlex}>
                      <div className={s.verticalLine} />
                      <img
                        src={d.image}
                        alt={d.name}
                        className={s.doctorImage}
                      />
                      <div>
                        <div className={s.doctorName}>{d.name}</div>
                        <div className={s.doctorId}>ID: {d.id}</div>
                      </div>
                    </td>

                    <td className={s.tableCell + " " + s.doctorSpecialization}>
                      {d.specialization}
                    </td>

                    <td className={s.tableCell + " " + s.feeText}>
                      {formatMoney(d.fee)}
                    </td>

                    <td className={s.tableCell + " " + s.appointmentsText}>
                      {d.appointments.total}
                    </td>

                    <td className={s.tableCell + " " + s.completedText}>
                      {d.appointments.completed}
                    </td>

                    <td className={s.tableCell + " " + s.canceledText}>
                      {d.appointments.canceled}
                    </td>

                    <td className={s.tableCell + " " + s.earningsText}>
                      {formatMoney(d.earnings)}
                    </td>
                  </tr>
                ))}

                {!loading && visibleDoctors.length === 0 && (
                  <tr>
                    <td colSpan={7} className={s.tableCell}>
                      No doctors found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className={s.mobileDoctorContainer}>
            <div className={s.mobileDoctorGrid}>
              {visibleDoctors.map((doc) => (
                <MobileDoctorCard key={doc.id} doc={doc} />
              ))}
            </div>
          </div>

          {filteredDoctors.length > INITIAL_COUNT && (
            <div className={s.showMoreContainer}>
              <button
                className={s.showMoreButton + " " + s.cursorPointer}
                onClick={() => setShowAll((prev) => !prev)}
              >
                {showAll
                  ? "Show less"
                  : `Show more (${filteredDoctors.length - INITIAL_COUNT})`}
              </button>
            </div>
          )}
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

function MobileDoctorCard({ doc }) {
  return (
    <div className={s.mobileDoctorCard}>
      <div className={s.mobileDoctorHeader}>
        <div className="flex items-center gap-3">
          <Image
            src={doc.image}
            alt={doc.name}
            className={s.mobileDoctorImage}
            width={128}
            height={128}
          />

          <div>
            <div className={s.mobileDoctorName}>{doc.name}</div>
            <div className={s.mobileDoctorSpecialization}>
              {doc.specialization}
            </div>
          </div>
        </div>

        <div className={s.mobileDoctorFee}>{formatMoney(doc.fee)}</div>
      </div>

      <div className={s.mobileStatsGrid}>
        <div>
          <div className={s.mobileStatLabel}>Appts</div>
          <div className={s.mobileStatValue}>{doc.appointments.total}</div>
        </div>

        <div>
          <div className={s.mobileStatLabel}>Done</div>
          <div className={s.mobileStatValue + " " + s.textEmerald600}>
            {doc.appointments.completed}
          </div>
        </div>

        <div>
          <div className={s.mobileStatLabel}>Cancel</div>
          <div className={s.mobileStatValue + " " + s.textRose500}>
            {doc.appointments.canceled}
          </div>
        </div>
      </div>

      <div className={s.mobileEarningsContainer}>
        <div>Earned</div>
        <div className="font-semibold">{formatMoney(doc.earnings)}</div>
      </div>
    </div>
  );
}
