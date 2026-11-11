"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  Clock,
  FileText,
  Phone,
  Send,
} from "lucide-react";
import { useAuth } from "@clerk/nextjs";
import toast, { Toaster } from "react-hot-toast";
import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import {
  serviceDetailStyles as s,
  iconSize,
} from "@/app/assets/dummyStyles.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PLACEHOLDER_IMG = "/placeholder-service.jpg";

const pad2 = (n) => String(n).padStart(2, "0");

const toKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function parseKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(k));
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function formatDateLabel(key) {
  const d = parseKey(key);
  if (!d) return key;
  return d.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function slotMinutes(slot) {
  const m = String(slot).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
}

const formatNaira = (v) =>
  new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(v) || 0);

function normalizePhone(phone) {
  if (!phone) return "";
  let digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("234") && digits.length >= 13) {
    digits = "0" + digits.slice(3, 13);
  } else if (digits.length === 10 && !digits.startsWith("0")) {
    digits = "0" + digits;
  }
  return digits.slice(0, 11);
}

const isValidMobile = (m) => /^0\d{10}$/.test(m);

const isValidAge = (a) => {
  if (a === "" || a === null || a === undefined) return false;
  const n = Number(a);
  return Number.isInteger(n) && n > 0 && n <= 130;
};

function transformService(doc) {
  const slotsMap = {};

  if (doc.slots && typeof doc.slots === "object" && !Array.isArray(doc.slots)) {
    Object.entries(doc.slots).forEach(([k, v]) => {
      const date = parseKey(k);
      if (!date || !Array.isArray(v)) return;
      const key = toKey(date);
      slotsMap[key] = Array.from(new Set([...(slotsMap[key] || []), ...v]));
    });
  }

  const todayKey = toKey(new Date());
  const dates = Object.keys(slotsMap)
    .filter((k) => k >= todayKey)
    .sort();

  dates.forEach((k) => {
    slotsMap[k].sort(
      (a, b) =>
        (slotMinutes(a) ?? Number.MAX_SAFE_INTEGER) -
        (slotMinutes(b) ?? Number.MAX_SAFE_INTEGER)
    );
  });

  const available =
    typeof doc.available === "boolean"
      ? doc.available
      : String(doc.availability ?? "available").toLowerCase() !== "unavailable";

  return {
    id: doc._id ?? doc.id,
    name: doc.name ?? doc.title ?? "Service",
    image: doc.imageUrl || doc.image || null,
    price: Number(doc.price) || 0,
    about: doc.about ?? doc.description ?? doc.shortDescription ?? "",
    instructions: Array.isArray(doc.instructions) ? doc.instructions : [],
    available,
    dates,
    slots: slotsMap,
  };
}

function ServiceImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={failed || !src ? PLACEHOLDER_IMG : src}
      alt={alt}
      className={s.image}
      onError={() => setFailed(true)}
    />
  );
}

const Page = () => {
  const { id } = useParams();
  const router = useRouter();
  const { isLoaded, isSignedIn, getToken } = useAuth();

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [age, setAge] = useState("");
  const [gender, setGender] = useState("");
  const [email, setEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Online");

  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  useEffect(() => {
    if (!id) return;
    const controller = new AbortController();

    async function loadService() {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await fetch(
          `${API_BASE}/api/services/${encodeURIComponent(id)}`,
          {
            headers: { Accept: "application/json" },
            signal: controller.signal,
          }
        );
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          setService(null);
          setFetchError(
            res.status === 404
              ? "Service not found"
              : json?.message || `Failed to load service (${res.status})`
          );
          return;
        }

        const doc = json?.data ?? json?.service ?? null;
        if (!doc) {
          setService(null);
          setFetchError("Service not found");
          return;
        }

        const transformed = transformService(doc);
        setService(transformed);
        setSelectedDate(transformed.dates[0] || "");
        setSelectedTime("");
      } catch (err) {
        if (err.name === "AbortError") return;
        console.error("load service error:", err);
        setService(null);
        setFetchError("Network error while loading the service.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadService();
    return () => controller.abort();
  }, [id]);

  const slots = useMemo(() => {
    if (!service || !selectedDate) return [];
    const list = service.slots[selectedDate] || [];
    const now = new Date();
    if (selectedDate !== toKey(now)) return list;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return list.filter((t) => {
      const mins = slotMinutes(t);
      return mins === null || mins > nowMinutes;
    });
  }, [service, selectedDate]);

  function getMissingFields() {
    const missing = [];
    if (!customerName.trim()) missing.push("name");
    if (!isValidMobile(normalizePhone(mobile)))
      missing.push("mobile (11 digits)");
    if (!isValidAge(age)) missing.push("age");
    if (!gender) missing.push("gender");
    if (!selectedDate) missing.push("date");
    if (!selectedTime) missing.push("time");
    return missing;
  }

  const formValid = getMissingFields().length === 0;
  const canSubmit = formValid && !submitting && !!service?.available;

  async function handleSubmit(e) {
    if (e) e.preventDefault();
    setSubmitError(null);

    if (!service) return;

    if (!service.available) {
      setSubmitError("This service is currently unavailable.");
      return;
    }

    const missing = getMissingFields();
    if (missing.length > 0) {
      setSubmitError(
        `${missing.join(", ")} ${missing.length > 1 ? "are" : "is"} required`
      );
      return;
    }

    if (!isLoaded || !isSignedIn) {
      toast.error("Please sign in to create a booking.");
      return;
    }

    setSubmitting(true);
    try {
      const token = await getToken();
      if (!token) {
        toast.error(
          "Authentication token not available. Please sign in again."
        );
        return;
      }

      const payload = {
        serviceId: service.id,
        patientName: customerName.trim(),
        mobile: normalizePhone(mobile),
        age: Number(age),
        gender,
        date: selectedDate,
        time: selectedTime,
        paymentMethod: paymentMethod === "Cash" ? "Cash" : "Online",
        email: email.trim() || undefined,
      };

      const res = await fetch(`${API_BASE}/api/service-appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setSubmitError(
          json?.message || json?.error || `Server returned ${res.status}`
        );
        return;
      }

      if (json?.checkoutUrl) {
        window.location.href = json.checkoutUrl;
        return;
      }

      toast.success("Booking created successfully. Redirecting...");
      setTimeout(() => {
        router.replace("/appointments?payment_status=Pending");
      }, 700);
    } catch (err) {
      console.error("Booking submit error:", err);
      setSubmitError("Network error while creating booking.");
    } finally {
      setSubmitting(false);
    }
  }

  let body;

  if (loading) {
    body = (
      <div className={s.loadingContainer}>
        <div className={s.loadingCard}>
          <h2 className={s.loadingTitle}>Loading service...</h2>
          <p className={s.loadingText}>Fetching details from server</p>
        </div>
      </div>
    );
  } else if (!service) {
    body = (
      <div className={s.loadingContainer}>
        <div className={s.loadingCard}>
          <h2 className={s.loadingTitle}>
            {fetchError || "Service not found"}
          </h2>
          <p className={s.loadingText}>
            Please go back and select a valid service.
          </p>
          <Link href="/services" className={s.backToServices}>
            Back to Services
          </Link>
        </div>
      </div>
    );
  } else {
    body = (
      <div className={s.pageContainer}>
        <Toaster />
        <div className={s.navBar}>
          <div className={s.navContainer}>
            <Link href="/services" className={s.backButton}>
              <ArrowLeft size={18} />
              Back
            </Link>
          </div>
        </div>

        <div className={s.mainGrid}>
          <div className={s.leftColumn}>
            <div className={s.imageContainer}>
              <ServiceImage
                key={service.image}
                src={service.image}
                alt={service.name}
              />
            </div>

            <div className={s.detailsContainer}>
              <h3 className={s.detailsTitle}>
                <Phone size={20} />
                Your Details
              </h3>

              <div className={s.detailsGrid}>
                <input
                  type="text"
                  placeholder="Full Name *"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className={s.input}
                />

                <input
                  type="tel"
                  inputMode="numeric"
                  placeholder="Mobile (e.g. 08012345678) *"
                  maxLength={11}
                  value={mobile}
                  onChange={(e) =>
                    setMobile(e.target.value.replace(/\D/g, "").slice(0, 11))
                  }
                  onPaste={(e) => {
                    e.preventDefault();
                    const pasted = (
                      e.clipboardData || window.clipboardData
                    ).getData("text");
                    setMobile(normalizePhone(pasted));
                  }}
                  className={
                    mobile.length === 11 && !isValidMobile(mobile)
                      ? s.invalidInput
                      : s.input
                  }
                />

                <input
                  type="number"
                  min="1"
                  max="130"
                  placeholder="Age *"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className={s.input}
                />

                <select
                  value={gender}
                  onChange={(e) => setGender(e.target.value)}
                  className={s.input}
                >
                  <option value="">Select Gender *</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>

                <input
                  type="email"
                  placeholder="Email (optional)"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={s.emailInput}
                />
              </div>

              <div className={s.dateSection}>
                <label className={s.paymentLabel}>Payment Method</label>
                <div className={s.paymentOptions}>
                  <label className={s.paymentOption(paymentMethod === "Cash")}>
                    <input
                      type="radio"
                      name="payment"
                      value="Cash"
                      checked={paymentMethod === "Cash"}
                      onChange={() => setPaymentMethod("Cash")}
                      className={s.paymentInput}
                    />
                    Cash
                  </label>
                  <label
                    className={s.paymentOption(paymentMethod === "Online")}
                  >
                    <input
                      type="radio"
                      name="payment"
                      value="Online"
                      checked={paymentMethod === "Online"}
                      onChange={() => setPaymentMethod("Online")}
                      className={s.paymentInput}
                    />
                    Online
                  </label>
                </div>
              </div>
            </div>

            <div>
              <h2 className={s.dateTitle}>Select Date *</h2>
              <div className={s.dateScrollContainer}>
                <div className={s.dateButtonsContainer}>
                  {service.dates.length === 0 && (
                    <div className={s.noSlotsMessage}>
                      No upcoming dates available.
                    </div>
                  )}

                  {service.dates.map((d) => (
                    <button
                      type="button"
                      key={d}
                      onClick={() => {
                        setSelectedDate(d);
                        setSelectedTime("");
                      }}
                      className={s.dateButton(selectedDate === d)}
                    >
                      {formatDateLabel(d)}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {selectedDate && (
              <div className={s.timeSection}>
                <h2 className={s.timeTitle}>Select Time *</h2>
                <div className={s.timeScrollContainer}>
                  <div className={s.timeButtonsContainer}>
                    {slots.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => setSelectedTime(t)}
                        className={s.timeButton(selectedTime === t)}
                      >
                        <Clock className={`${iconSize.small} mr-1`} />
                        {t}
                      </button>
                    ))}
                    {slots.length === 0 && (
                      <div className={s.noSlotsMessage}>
                        No slots left for this date.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div>
              {!service.available && (
                <div className={s.errorMessage}>
                  This service is currently unavailable.
                </div>
              )}
              {submitError && (
                <div className={s.errorMessage}>{submitError}</div>
              )}
              <button
                type="button"
                disabled={!canSubmit}
                onClick={handleSubmit}
                className={s.submitButton(canSubmit, submitting)}
              >
                <Send />
                {submitting
                  ? "Submitting..."
                  : `Confirm Booking • ${
                      service.price ? formatNaira(service.price) : "Free"
                    }`}
              </button>
            </div>
          </div>

          <div className={s.rightColumn}>
            <h1 className={s.serviceName}>{service.name}</h1>

            <div className={s.aboutContainer}>
              <h2 className={s.aboutTitle}>
                <FileText /> About This Service
              </h2>
              <p className={s.aboutText}>{service.about}</p>
            </div>

            <div className={s.priceContainer}>
              <Banknote />
              <span className={s.priceText}>
                {service.price ? formatNaira(service.price) : "Free"}
              </span>
            </div>

            <div className={s.instructionsContainer}>
              <h3 className={s.instructionsTitle}>Pre-Test Instructions</h3>
              <ul className={s.instructionsList}>
                {service.instructions.map((ins, idx) => (
                  <li key={idx}>{ins}</li>
                ))}
              </ul>
            </div>

            <div className={s.summaryContainer}>
              <h3 className={s.summaryTitle}>Booking Summary</h3>
              <div className={s.summaryContent}>
                <p>
                  <b>Name:</b> {customerName || "Not filled"}
                </p>
                <p>
                  <b>Mobile:</b> {mobile || "Not filled"}
                </p>
                <p>
                  <b>Age:</b> {age || "Not filled"}
                </p>
                <p>
                  <b>Gender:</b> {gender || "Not filled"}
                </p>
                <p>
                  <b>Date:</b>{" "}
                  {selectedDate
                    ? formatDateLabel(selectedDate)
                    : "Not selected"}
                </p>
                <p>
                  <b>Time:</b> {selectedTime || "Not selected"}
                </p>
                <p>
                  <b>Payment:</b> {paymentMethod}
                </p>
                <p>
                  <b>Price:</b>{" "}
                  {service.price ? formatNaira(service.price) : "Free"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar />
      {body}
      <Footer />
    </div>
  );
};

export default Page;
