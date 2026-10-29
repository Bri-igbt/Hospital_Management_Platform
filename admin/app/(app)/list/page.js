"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@clerk/nextjs";
import { doctorListStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Banknote,
  EyeClosed,
  Search,
  Star,
  Trash2,
  User,
  Users,
} from "lucide-react";
import Image from "next/image";

function formatDateISO(iso) {
  if (!iso || typeof iso !== "string") return iso;
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  const [y, m, d] = parts;
  const dateObj = new Date(Number(y), Number(m) - 1, Number(d));
  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "June",
    "July",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const day = String(Number(d));
  const month = monthNames[dateObj.getMonth()] || "";
  return `${day} ${month} ${y}`;
}

function normalizeToDateString(d) {
  if (!d) return null;
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString().split("T")[0];
}

function buildScheduleMap(schedule) {
  const map = {};
  if (!schedule || typeof schedule !== "object") return map;
  Object.entries(schedule).forEach(([k, v]) => {
    const nd = normalizeToDateString(k) || String(k);
    map[nd] = Array.isArray(v) ? v.slice() : [];
  });
  return map;
}

function getSortedScheduleDates(scheduleLike) {
  let keys = [];
  if (Array.isArray(scheduleLike)) {
    keys = scheduleLike.map(normalizeToDateString).filter(Boolean);
  } else if (scheduleLike && typeof scheduleLike === "object") {
    keys = Object.keys(scheduleLike).map(normalizeToDateString).filter(Boolean);
  }

  keys = Array.from(new Set(keys));
  const parsed = keys.map((ds) => ({ ds, date: new Date(ds) }));
  const dateVal = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

  const today = new Date();
  const todayVal = dateVal(today);

  const past = parsed
    .filter((p) => dateVal(p.date) < todayVal)
    .sort((a, b) => dateVal(b.date) - dateVal(a.date));

  const future = parsed
    .filter((p) => dateVal(p.date) >= todayVal)
    .sort((a, b) => dateVal(a.date) - dateVal(b.date));

  return [...past, ...future].map((p) => p.ds);
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const Page = () => {
  const { getToken } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [expanded, setExpanded] = useState(null);
  const [query, setQuery] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [loading, setLoading] = useState(false);

  const [isMobileScreen, setIsMobileScreen] = useState(false);
  useEffect(() => {
    function onResize() {
      if (typeof window === "undefined") return;
      setIsMobileScreen(window.innerWidth < 640);
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  async function fetchDoctors() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/doctors`);
      const body = await res.json().catch(() => null);

      if (res.ok && body && body.success) {
        const list = Array.isArray(body.data)
          ? body.data
          : Array.isArray(body.doctors)
          ? body.doctors
          : [];
        const normalized = list.map((d) => {
          const scheduleMap = buildScheduleMap(d.schedule || {});
          return {
            ...d,
            schedule: scheduleMap,
          };
        });
        setDoctors(normalized);
      } else {
        console.error("Failed to fetch doctors", { status: res.status, body });
        setDoctors([]);
      }
    } catch (err) {
      console.error("Network error fetching doctors", err);
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchDoctors();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = doctors;
    if (filterStatus === "available") {
      list = list.filter(
        (d) => (d.availability || "").toString().toLowerCase() === "available"
      );
    } else if (filterStatus === "unavailable") {
      list = list.filter(
        (d) => (d.availability || "").toString().toLowerCase() !== "available"
      );
    }
    if (!q) return list;
    return list.filter((d) => {
      return (
        (d.name || "").toLowerCase().includes(q) ||
        (d.specialization || "").toLowerCase().includes(q)
      );
    });
  }, [doctors, query, filterStatus]);

  const displayed = useMemo(() => {
    if (showAll) return filtered;
    return filtered.slice(0, 6);
  }, [filtered, showAll]);

  function toggle(id) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  async function removeDoctor(id) {
    const doc = doctors.find((d) => (d._id || d.id) === id);
    if (!doc) return;
    const ok = window.confirm(`Delete ${doc.name}? This cannot be undone.`);
    if (!ok) return;

    try {
      const token = await getToken();
      if (!token) {
        alert("Please sign in again");
        return;
      }

      const res = await fetch(`${API_BASE}/api/doctors/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        alert(body?.message || "Failed to delete");
        return;
      }
      setDoctors((prev) => prev.filter((p) => (p._id || p.id) !== id));
      if (expanded === id) setExpanded(null);
    } catch (err) {
      console.error("delete error", err);
      alert("Network error deleting doctor");
    }
  }

  function applyStatusFilter(status) {
    setFilterStatus((prev) => (prev === status ? "all" : status));
    setExpanded(null);
    setShowAll(false);
  }

  return (
    <div className={s.container}>
      <header className={s.headerContainer}>
        <div className={s.headerTopSection}>
          <div className={s.headerIconContainer}>
            <div className={s.headerIcon}>
              <User size={20} className={s.headerIconSvg} />
            </div>

            <div>
              <h1 className={s.headerTitle}>Find a Doctor</h1>
              <p className={s.headerSubtitle}>
                Search by name or specialization
              </p>
            </div>
          </div>

          <div className={s.headerSearchContainer}>
            <div className={s.searchBox}>
              <Search size={16} className={s.searchIcon} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search Doctors, specialization"
                className={s.searchInput}
              />
            </div>

            <button
              onClick={() => {
                setQuery("");
                setExpanded(null);
                setShowAll(false);
                setFilterStatus("all");
              }}
              className={s.clearButton}
            >
              Clear
            </button>
          </div>
        </div>

        <div className={s.filterContainer}>
          <button
            onClick={() => applyStatusFilter("available")}
            className={s.filterButton(filterStatus === "available", "emerald")}
          >
            Available
          </button>

          <button
            onClick={() => applyStatusFilter("unavailable")}
            className={s.filterButton(filterStatus === "unavailable", "red")}
          >
            Unavailable
          </button>
        </div>
      </header>

      <main className={s.gridContainer}>
        {loading && (
          <div className={s.loadingContainer}>Loading Doctors...</div>
        )}

        {!loading && filtered.length === 0 && (
          <div className={s.noResultsContainer}>
            No doctors match your search.
          </div>
        )}

        {displayed.map((doc) => {
          const id = doc._id || doc.id;
          const isOpen = expanded === id;
          const isAvailable = doc.availability === "Available";

          const scheduleMap = buildScheduleMap(doc.schedule || {});
          const sortedDates = getSortedScheduleDates(scheduleMap);

          return (
            <article key={id} className={s.article}>
              <div className={s.articleContent}>
                <Image
                  src={
                    doc.imageUrl ||
                    doc.image ||
                    `https://i.pravatar.cc/150?u=${id}`
                  }
                  alt={doc.name}
                  className={s.doctorImage}
                  width={120}
                  height={120}
                />

                <div className={s.doctorInfoContainer}>
                  <div className={s.doctorHeader}>
                    <div className="min-w-0 w-full">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className={s.doctorName}>{doc.name}</h3>

                        <span className={s.availabilityBadge(isAvailable)}>
                          <span className={s.availabilityDot(isAvailable)} />
                          {isAvailable ? "Available" : "Unavailable"}
                        </span>
                      </div>

                      <div className={s.doctorDetails}>
                        {doc.specialization} • {doc.experience} years
                      </div>
                    </div>

                    <div className={s.ratingContainer}>
                      <div className={s.rating}>
                        <Star size={14} /> {doc.rating}
                      </div>

                      <button
                        onClick={() => toggle(id)}
                        className={s.toggleButton(isOpen)}
                      >
                        <EyeClosed size={18} />
                      </button>
                    </div>
                  </div>

                  <div className={s.statsContainer}>
                    <div className={s.statsLabel}>Patients</div>
                    <div className={s.statsValue}>
                      <Users size={14} /> {doc.patients}
                    </div>

                    <div className={s.actionContainer}>
                      <div className="flex items-center gap-2">
                        <button
                          className={s.deleteButton}
                          onClick={() => removeDoctor(id)}
                        >
                          <Trash2 size={14} /> Delete
                        </button>

                        <div className={s.feesLabel}>Fees:</div>
                        <div className={s.feesValue}>
                          <Banknote /> {doc.fee}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div
                className={s.expandableContent}
                style={{
                  maxHeight: isOpen ? (isMobileScreen ? 320 : 600) : 0,
                  transition:
                    "max-height 420ms cubic-bezier(.2,.9,.2,1), padding 220ms ease",
                  paddingTop: isOpen ? 16 : 0,
                  paddingBottom: isOpen ? 16 : 0,
                }}
              >
                {isOpen && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                    <div className={s.aboutSection}>
                      <h4 className={s.aboutHeading}>About</h4>
                      <p className={s.aboutText}>{doc.about}</p>

                      <div className="mt-4">
                        <div className={s.qualificationsHeading}>
                          Qualifications
                        </div>
                        <div className={s.qualificationsText}>
                          {doc.qualifications}
                        </div>
                      </div>

                      <div className="mt-4">
                        <div className={s.scheduleHeading}>Schedule</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sortedDates.map((date) => {
                            const slots = scheduleMap[date] || [];
                            return (
                              <div key={date} className="min-w-full md:min-w-0">
                                <div className={s.scheduleDate}>
                                  {formatDateISO(date)}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-2">
                                  {slots.map((slot, i) => (
                                    <span key={i} className={s.scheduleSlot}>
                                      {slot}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    <aside className={s.statsSidebar}>
                      <div className={s.statsItemHeading}>Success</div>
                      <div className={s.statsItemValue}>{doc.success}%</div>

                      <div className={s.statsItemHeading}>Patients</div>
                      <div className={s.statsItemValue}>{doc.patients}</div>

                      <div className={s.statsItemHeading}>Location</div>
                      <div className={s.locationValue}>{doc.location}</div>
                    </aside>
                  </div>
                )}
              </div>
            </article>
          );
        })}

        {filtered.length > 6 && (
          <div className={s.showMoreContainer}>
            <button
              className={s.showMoreButton}
              onClick={() => setShowAll((prev) => !prev)}
            >
              {showAll ? "Show Less" : `Show More (${filtered.length - 6})`}
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default Page;
