"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
} from "react";
import { useAuth } from "@clerk/nextjs";
import { serviceDashboardStyles as s } from "@/app/assets/dummyStyles.js";
import {
  Banknote,
  Calendar,
  CheckCircle,
  ClipboardList,
  Search,
  XCircle,
} from "lucide-react";
import Image from "next/image";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const INITIAL_COUNT = 8;

function formatCurrency(v) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);
}

function normalizeService(doc) {
  if (!doc) return null;
  const id = doc._id || doc.id || String(Math.random()).slice(2);
  const name = doc.name || doc.title || doc.serviceName || "Untitled Service";
  const price =
    Number(doc.price ?? doc.fee ?? doc.fees ?? doc.cost ?? doc.amount) || 0;
  const image =
    doc.imageUrl ||
    doc.image ||
    doc.avatar ||
    `https://i.pravatar.cc/150?u=${id}`;

  const totalAppointments =
    Number(
      doc.totalAppointments ??
        doc.appointments?.total ??
        doc.count ??
        doc.stats?.total ??
        doc.bookings ??
        0
    ) || 0;
  const completed =
    Number(
      doc.completed ??
        doc.appointments?.completed ??
        doc.stats?.completed ??
        doc.completedAppointments ??
        0
    ) || 0;
  const canceled =
    Number(
      doc.canceled ??
        doc.appointments?.canceled ??
        doc.stats?.canceled ??
        doc.canceledAppointments ??
        0
    ) || 0;

  // Prefer the earning total calculated by the backend
  const earningRaw = doc.earning ?? doc.earnings ?? doc.revenue;
  const earning =
    earningRaw !== undefined && earningRaw !== null
      ? Number(earningRaw) || 0
      : completed * price;

  return {
    id,
    name,
    price,
    image,
    totalAppointments,
    completed,
    canceled,
    earning,
    raw: doc,
  };
}

function StatCard({ icon, label, value }) {
  return (
    <div className={s.statCard.container}>
      <div className={s.statCard.iconContainer}>{icon}</div>
      <div className={s.statCard.label}>{label}</div>
      <div className={s.statCard.value}>{value}</div>
    </div>
  );
}

const Page = ({ services: servicesProp = null }) => {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const hasProp = Array.isArray(servicesProp);

  const [fetched, setFetched] = useState([]);
  const [loading, setLoading] = useState(!hasProp);
  const [error, setError] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showAll, setShowAll] = useState(false);

  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const propServices = useMemo(
    () => (hasProp ? servicesProp.map(normalizeService).filter(Boolean) : null),
    [hasProp, servicesProp]
  );
  const services = propServices ?? fetched;
  const isLoading = hasProp ? false : loading;

  const fetchServices = useCallback(
    async ({ showLoading = true } = {}) => {
      if (fetchingRef.current) return;
      fetchingRef.current = true;
      try {
        if (showLoading) {
          setLoading(true);
          setError(null);
        }

        const token = await getToken();
        if (!token) throw new Error("Please sign in again");

        const res = await fetch(
          `${API_BASE}/api/service-appointments/stats/summary`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body?.message || `Failed to fetch services (${res.status})`
          );
        }
        const body = await res.json();

        let list = [];
        if (Array.isArray(body)) list = body;
        else if (Array.isArray(body.services)) list = body.services;
        else if (Array.isArray(body.data)) list = body.data;
        else if (Array.isArray(body.items)) list = body.items;
        else {
          const maybeArray = Object.values(body).find((v) => Array.isArray(v));
          if (maybeArray) list = maybeArray;
        }

        if (mountedRef.current) {
          setFetched((list || []).map(normalizeService).filter(Boolean));
          setError(null);
        }
      } catch (err) {
        console.error("Service fetch error:", err);
        if (mountedRef.current) {
          setError(err.message || "Failed to load services");
        }
      } finally {
        if (mountedRef.current && showLoading) setLoading(false);
        fetchingRef.current = false;
      }
    },
    [getToken]
  );

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Lets other pages call window.refreshServices()
  useEffect(() => {
    window.refreshServices = () => fetchServices({ showLoading: true });
    return () => {
      try {
        delete window.refreshServices;
      } catch {}
    };
  }, [fetchServices]);

  useEffect(() => {
    if (hasProp) return;
    if (!isLoaded || !isSignedIn) return;

    fetchServices({ showLoading: true });

    const refresh = () => fetchServices({ showLoading: false });

    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 10000);

    const onStorage = (e) => {
      if (e?.key === "service_bookings_updated") refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", refresh);
    window.addEventListener("services:updated", refresh);
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(poll);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("services:updated", refresh);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [hasProp, isLoaded, isSignedIn, fetchServices]);

  const filteredServices = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return services;
    const qNum = Number(q);
    return services.filter((svc) => {
      if (svc.name.toLowerCase().includes(q)) return true;
      if (!Number.isNaN(qNum) && svc.price <= qNum) return true;
      if (svc.price.toString().includes(q)) return true;
      return false;
    });
  }, [services, searchQuery]);

  const visibleServices = showAll
    ? filteredServices
    : filteredServices.slice(0, INITIAL_COUNT);

  const totals = useMemo(() => {
    return filteredServices.reduce(
      (acc, svc) => {
        acc.totalServices += 1;
        acc.totalAppointments += svc.totalAppointments;
        acc.totalCompleted += svc.completed;
        acc.totalCanceled += svc.canceled;
        acc.totalEarning += svc.earning;
        return acc;
      },
      {
        totalServices: 0,
        totalAppointments: 0,
        totalCompleted: 0,
        totalCanceled: 0,
        totalEarning: 0,
      }
    );
  }, [filteredServices]);

  const count = filteredServices.length;

  return (
    <div className={s.container}>
      <div className={s.innerContainer}>
        <div className={s.header.container}>
          <div>
            <h1 className={s.header.title}>Service Dashboard</h1>
            <p className={s.header.subtitle}>
              Overview of services, appointments and earnings
            </p>
          </div>

          <div className={s.refresh.container}>
            <div className={s.refresh.countText}>
              {isLoading
                ? "Loading..."
                : `${count} service${count !== 1 ? "s" : ""}`}
            </div>

            <button
              onClick={() => {
                if (hasProp) return;
                fetchServices({ showLoading: true });
              }}
              className={s.refresh.button(hasProp)}
              title={
                hasProp ? "Services provided by parent component" : "Refresh"
              }
            >
              Refresh
            </button>
          </div>
        </div>

        {error && services.length > 0 && (
          <div className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
            Couldn&apos;t refresh: {error}
          </div>
        )}

        <div className={s.statGrid}>
          <StatCard
            icon={<ClipboardList size={18} />}
            label="Total Services"
            value={totals.totalServices}
          />

          <StatCard
            icon={<Calendar size={18} />}
            label="Total Appointment"
            value={totals.totalAppointments}
          />

          <StatCard
            icon={<Banknote size={18} />}
            label="Total Earnings"
            value={formatCurrency(totals.totalEarning)}
          />

          <StatCard
            icon={<CheckCircle size={18} />}
            label="Completed"
            value={totals.totalCompleted}
          />

          <StatCard
            icon={<XCircle size={18} />}
            label="Canceled"
            value={totals.totalCanceled}
          />
        </div>

        <div className={s.search.container}>
          <div className={s.search.inputContainer}>
            <Search size={16} className="text-emerald-700" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowAll(false);
              }}
              className={s.search.input}
            />

            {searchQuery.length > 0 && (
              <XCircle
                size={16}
                className="text-red-500 cursor-pointer"
                onClick={() => {
                  setSearchQuery("");
                  setShowAll(false);
                }}
              />
            )}
          </div>
        </div>

        <div className={s.table.container}>
          <div className={s.table.headerMd}>
            <div className={s.table.headerText}>Service</div>
            <div className={s.table.headerText}>Appointments</div>
            <div className={s.table.headerText}>Completed</div>
            <div className={s.table.headerText}>Canceled</div>
            <div className={s.table.headerText}>Earning</div>
          </div>

          <div className={s.table.headerLg}>
            <div className="col-span-5">Service</div>
            <div className="col-span-2">Price</div>
            <div className={s.table.headerTextLg(1)}>Appointments</div>
            <div className={s.table.headerTextLg(1)}>Completed</div>
            <div className={s.table.headerTextLg(1)}>Canceled</div>
            <div className="col-span-2 text-right">Earning</div>
          </div>

          <div className={s.table.body}>
            {isLoading ? (
              <div className={s.states.loading}>Loading services...</div>
            ) : error && services.length === 0 ? (
              <div className={s.states.error}>Error: {error}</div>
            ) : visibleServices.length === 0 ? (
              <div className={s.states.empty}>No services found.</div>
            ) : (
              visibleServices.map((d) => (
                <div key={d.id} className={s.table.row}>
                  {/* Tablet view */}
                  <div className={s.table.tabletView}>
                    <div className="grid grid-cols-5 items-center gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className={s.table.tabletImage}>
                          <Image
                            src={d.image}
                            alt={d.name}
                            className="w-full h-full object-cover"
                            width={120}
                            height={120}
                          />
                        </div>
                        <div className={s.table.tabletTextContainer}>
                          <div className={s.table.tabletServiceName}>
                            {d.name}
                          </div>
                          <div className={s.table.tabletPrice}>
                            {formatCurrency(d.price)}
                          </div>
                        </div>
                      </div>

                      <div>{d.totalAppointments}</div>
                      <div>{d.completed}</div>
                      <div>{d.canceled}</div>
                      <div>{formatCurrency(d.earning)}</div>
                    </div>
                  </div>

                  {/* Desktop view */}
                  <div className={s.table.desktopView}>
                    <div className="col-span-5 flex items-center gap-4">
                      <div className={s.table.desktopImage}>
                        <Image
                          src={d.image}
                          alt={d.name}
                          className="w-full h-full object-cover"
                          width={120}
                          height={120}
                        />
                      </div>

                      <h3 className={s.table.desktopServiceName}>{d.name}</h3>
                    </div>

                    <div className={s.table.desktopCell(2)}>
                      {formatCurrency(d.price)}
                    </div>

                    <div className={s.table.desktopCell(1)}>
                      {d.totalAppointments}
                    </div>

                    <div className={s.table.desktopCell(1)}>{d.completed}</div>

                    <div className={s.table.desktopCell(1)}>{d.canceled}</div>

                    <div className={`${s.table.desktopCell(2)} text-right`}>
                      {formatCurrency(d.earning)}
                    </div>
                  </div>

                  {/* Mobile view */}
                  <div className={s.table.mobileView}>
                    <div className="flex items-start gap-3">
                      <div className={s.table.mobileImage}>
                        <Image
                          src={d.image}
                          alt={d.name}
                          className="w-full h-full object-cover"
                          width={120}
                          height={120}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className={s.table.mobileServiceHeader}>
                          <h3 className={s.table.mobileServiceName}>
                            {d.name}
                          </h3>
                          <div className="text-sm font-medium">
                            {formatCurrency(d.price)}
                          </div>
                        </div>

                        <div className={s.table.mobileStatsContainer}>
                          <div className={s.table.mobileStatItem("emerald")}>
                            <Calendar size={14} />
                            <span className="leading-none">
                              {d.totalAppointments} Appointments
                            </span>
                          </div>

                          <div className={s.table.mobileStatItem("emerald")}>
                            <CheckCircle size={14} />
                            <span className="leading-none text-emerald-700">
                              {d.completed} Completed
                            </span>
                          </div>

                          <div className={s.table.mobileStatItem("red")}>
                            <XCircle size={14} />
                            <span className="leading-none text-red-500">
                              {d.canceled} Canceled
                            </span>
                          </div>

                          <div className={s.table.mobileStatItem("emerald")}>
                            <Banknote size={14} />
                            <span className="leading-none">
                              Total Earning : {formatCurrency(d.earning)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {filteredServices.length > INITIAL_COUNT && (
          <div className={s.showMore.container}>
            <button
              onClick={() => setShowAll((prev) => !prev)}
              className={s.showMore.button}
            >
              {showAll
                ? "Show Less"
                : `Show More (${filteredServices.length - INITIAL_COUNT})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Page;
