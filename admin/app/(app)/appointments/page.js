"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@clerk/nextjs";
import {
  pageStyles as s,
  keyframesStyles,
  statusClasses,
} from "@/app/assets/dummyStyles.js";
import { Banknote, Calendar, Search } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INITIAL_COUNT = 8;

function formatDateISO(iso) {
  try {
    const d = new Date(iso + "T00:00:00");
    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch (e) {
    return iso;
  }
}

function dateTimeFromSlot(slot) {
  try {
    const [y, m, d] = slot.date.split("-");
    const base = new Date(Number(y), Number(m) - 1, Number(d), 0, 0, 0, 0);

    const [time, ampm] = slot.time.split(" ");
    let [hh, mm] = time.split(":").map(Number);
    if (ampm === "PM" && hh !== 12) hh += 12;
    if (ampm === "AM" && hh === 12) hh = 0;
    base.setHours(hh, mm || 0, 0, 0);
    return base;
  } catch (e) {
    return new Date(slot.date + "T00:00:00");
  }
}

function normalizeAppointment(a) {
  return {
    id: a._id || a.id,
    patientName: a.patientName || "",
    age: a.age || "",
    gender: a.gender || "",
    mobile: a.mobile || "",
    doctorName: (a.doctorId && a.doctorId.name) || a.doctorName || "",
    speciality:
      (a.doctorId && a.doctorId.specialization) ||
      a.speciality ||
      a.specialization ||
      "General",
    fee: typeof a.fees === "number" ? a.fees : a.fee || 0,
    slot: {
      date: a.date || (a.slot && a.slot.date) || "",
      time: a.time || (a.slot && a.slot.time) || "00:00 AM",
    },
    status: a.status || (a.payment && a.payment.status) || "Pending",
    raw: a,
  };
}

const formatMoney = (amount) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(amount) || 0);

const Page = () => {
  const { getToken, isLoaded, isSignedIn } = useAuth();

  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);

  const [query, setQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterSpeciality, setFilterSpeciality] = useState("all");
  const [showAll, setShowAll] = useState(false);

  const loadAppointments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Please sign in again");

      const res = await fetch(`${API_BASE}/api/appointments?limit=200`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to fetch (${res.status})`);
      }
      const data = await res.json();
      setAppointments((data?.appointments || []).map(normalizeAppointment));
    } catch (err) {
      console.error("Load appointments error:", err);
      setError(err.message || "Failed to load appointments");
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    loadAppointments();
  }, [isLoaded, isSignedIn, loadAppointments]);

  const specialities = useMemo(() => {
    const set = new Set(appointments.map((a) => a.speciality || "General"));
    return ["all", ...Array.from(set)];
  }, [appointments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return appointments.filter((a) => {
      if (
        filterSpeciality !== "all" &&
        (a.speciality || "").toLowerCase() !== filterSpeciality.toLowerCase()
      )
        return false;
      if (filterDate && a.slot?.date !== filterDate) return false;
      if (!q) return true;
      return (
        (a.doctorName || "").toLowerCase().includes(q) ||
        (a.speciality || "").toLowerCase().includes(q) ||
        (a.patientName || "").toLowerCase().includes(q) ||
        (a.mobile || "").toLowerCase().includes(q)
      );
    });
  }, [appointments, query, filterDate, filterSpeciality]);

  const sortedFiltered = useMemo(() => {
    return filtered.slice().sort((a, b) => {
      const da = dateTimeFromSlot(a.slot).getTime();
      const db = dateTimeFromSlot(b.slot).getTime();
      return db - da;
    });
  }, [filtered]);

  const displayed = useMemo(
    () => (showAll ? sortedFiltered : sortedFiltered.slice(0, INITIAL_COUNT)),
    [sortedFiltered, showAll]
  );

  async function adminCancelAppointment(id) {
    const appt = appointments.find((x) => x.id === id);
    if (!appt) return;

    const statusLower = (appt.status || "").toLowerCase();
    if (
      statusLower === "canceled" ||
      statusLower === "cancelled" ||
      statusLower === "completed"
    )
      return;

    const ok = window.confirm(
      `Cancel the appointment for ${appt.patientName} with ${
        appt.doctorName
      } on ${formatDateISO(appt.slot.date)} at ${appt.slot.time}?`
    );
    if (!ok) return;

    try {
      setActionError(null);
      const token = await getToken();
      if (!token) throw new Error("Please sign in again");

      const res = await fetch(`${API_BASE}/api/appointments/${id}/cancel`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || `Cancel failed (${res.status})`);
      }
      const data = await res.json().catch(() => ({}));
      const newStatus = data?.appointment?.status || "Canceled";

      setAppointments((prev) =>
        prev.map((p) => (p.id === id ? { ...p, status: newStatus } : p))
      );
    } catch (err) {
      console.error("Cancel error:", err);
      setActionError(err.message || "Failed to cancel appointment");
    }
  }

  return (
    <div className={s.container}>
      <style>{keyframesStyles}</style>
      <div className={s.maxWidthContainer}>
        <header className={s.headerContainer}>
          <div className={s.headerTitleSection}>
            <h1 className={s.headerTitle}>Appointments</h1>
            <p className={s.headerSubtitle}>
              Manage and search upcoming patient appointments
            </p>
          </div>

          <div className={s.headerControlsSection}>
            <div className="flex flex-col md:flex-col sm:flex-row items-center gap-3 w-full sm:w-auto">
              <div className={s.searchContainer}>
                <Search size={16} className={s.searchIcon} />
                <input
                  className={s.searchInput}
                  placeholder="Search doctor, patient, speciality or mobile"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>

              <div className={s.filterContainer}>
                <div className={s.dateFilter}>
                  <Calendar size={14} className={s.dateFilterIcon} />
                  <input
                    type="date"
                    className={s.dateInput}
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                  />
                </div>

                <select
                  className={s.selectFilter}
                  value={filterSpeciality}
                  onChange={(e) => setFilterSpeciality(e.target.value)}
                >
                  {specialities.map((sp) => (
                    <option value={sp} key={sp}>
                      {sp === "all" ? "All Specialties" : sp}
                    </option>
                  ))}
                </select>

                <button
                  className={s.clearButton}
                  onClick={() => {
                    setQuery("");
                    setFilterDate("");
                    setFilterSpeciality("all");
                    setShowAll(false);
                    setError(null);
                    setActionError(null);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
        </header>

        {actionError && <div className={s.errorContainer}>{actionError}</div>}

        {loading ? (
          <div className={s.loadingErrorContainer}>Loading...</div>
        ) : error ? (
          <div className={s.errorContainer}>{error}</div>
        ) : sortedFiltered.length === 0 ? (
          <div className={s.noResultsContainer}>No appointments found.</div>
        ) : (
          <main className={s.gridContainer}>
            {displayed.map((a, idx) => {
              const statusLower = (a.status || "").toLowerCase();
              const isCancelled =
                statusLower === "canceled" || statusLower === "cancelled";
              const isCompleted = statusLower === "completed";
              const isDisabled = isCancelled || isCompleted;

              return (
                <div
                  key={a.id}
                  style={{
                    animation: `fadeUp 420ms cubic-bezier(.2,.9,.2,1) forwards`,
                    animationDelay: `${idx * 70}ms`,
                    opacity: 0,
                  }}
                  className={s.card}
                >
                  <div className={s.cardHeader}>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={s.cardTitle}>{a.patientName}</h3>

                        <div className={s.patientInfo}>
                          <span>{a.age ? `${a.age} yrs` : ""}</span>
                          <span> {a.age ? ":" : ""} </span>
                          <span>{a.gender}</span>
                          <span className="hidden md:inline"> : </span>
                          <span className=" max-w-[120px]">{a.mobile}</span>
                        </div>
                      </div>

                      <div className={s.doctorInfo}>
                        {a.doctorName} :{" "}
                        <span className={s.doctorSpeciality}>
                          {a.speciality}
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className={s.feeLabel}>Fees</div>
                      <div className={s.feeAmount}>
                        <Banknote size={16} />
                        <span>{formatMoney(a.fee)}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className={s.slotContainer}>
                      <Calendar size={14} className={s.slotIcon} />
                      <span>
                        {formatDateISO(a.slot.date)} — {a.slot.time}
                      </span>
                    </div>

                    <div
                      className={`${s.statusBadge} ${statusClasses(a.status)}`}
                    >
                      {a.status ? a.status.toUpperCase() : "PENDING"}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => adminCancelAppointment(a.id)}
                        title={
                          isDisabled
                            ? isCompleted
                              ? "Cannot cancel a completed appointment"
                              : "Already cancelled"
                            : "Admin Cancel (mark as cancelled)"
                        }
                        disabled={isDisabled}
                        aria-disabled={isDisabled}
                        className={s.cancelButton(isDisabled, isCompleted)}
                      >
                        {isDisabled
                          ? isCompleted
                            ? "Completed"
                            : "Admin Cancelled"
                          : "Admin Cancel"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </main>
        )}

        {sortedFiltered.length > INITIAL_COUNT && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={s.showMoreButton}
            >
              {showAll
                ? "Show Less"
                : `Show more (${sortedFiltered.length - INITIAL_COUNT})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
