"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  CalendarCheck,
  MapPin,
  BadgeInfo,
  GraduationCap,
  Award,
  Clock,
  Star,
  Heart,
  Zap,
  Shield,
  Users,
  Phone,
} from "lucide-react";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAuth, useUser } from "@clerk/nextjs";
import { doctorDetailStyles as s } from "@/app/assets/dummyStyles.js";
import Navbar from "@/app/component/Navbar.js";
import Footer from "@/app/component/Footer.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const pad2 = (n) => String(n).padStart(2, "0");

const toKey = (d) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

function parseKey(k) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(k));
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(k);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
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

const Page = () => {
  const { id } = useParams();
  const router = useRouter();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedKey, setSelectedKey] = useState("");
  const [selectedSlot, setSelectedSlot] = useState("");
  const [isVisible, setIsVisible] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    age: "",
    mobile: "",
    gender: "",
    email: "",
  });

  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { getToken, isLoaded: authLoaded } = useAuth();
  const { isSignedIn, user, isLoaded: userLoaded } = useUser();

  useEffect(() => {
    setIsVisible(true);
  }, []);

  useEffect(() => {
    if (!userLoaded || !user) return;

    const fullName =
      user.fullName ||
      `${user.firstName || ""} ${user.lastName || ""}`.trim() ||
      "";
    const rawPhone =
      user.primaryPhoneNumber?.phoneNumber ||
      user.phoneNumbers?.[0]?.phoneNumber ||
      "";
    const email =
      user.primaryEmailAddress?.emailAddress ||
      user.emailAddresses?.[0]?.emailAddress ||
      "";

    setFormData((prev) => ({
      ...prev,
      name: prev.name || fullName,
      mobile: prev.mobile || normalizePhone(rawPhone),
      email: prev.email || email,
    }));
  }, [userLoaded, user]);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    async function fetchDoctor() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_BASE}/api/doctors/${id}`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(
            body.message || `Failed to fetch (status ${res.status})`
          );
        }
        const payload = await res.json();
        if (mounted) setDoctor(payload?.data || null);
      } catch (err) {
        if (mounted) setError(err.message || "Failed to fetch doctor");
      } finally {
        if (mounted) setLoading(false);
      }
    }
    fetchDoctor();
    return () => {
      mounted = false;
    };
  }, [id]);

  const days = useMemo(() => {
    const schedule = doctor?.schedule;
    if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) {
      return [];
    }

    const byKey = new Map();
    Object.entries(schedule).forEach(([k, v]) => {
      const date = parseKey(k);
      if (!date) return;
      const key = toKey(date);
      const list = Array.isArray(v) ? v : [];
      byKey.set(key, {
        key,
        date,
        slots: [...(byKey.get(key)?.slots || []), ...list],
      });
    });

    const todayKey = toKey(new Date());
    return Array.from(byKey.values())
      .filter((d) => d.key >= todayKey)
      .map((d) => ({
        ...d,
        slots: Array.from(new Set(d.slots)).sort(
          (a, b) =>
            (slotMinutes(a) ?? Number.MAX_SAFE_INTEGER) -
            (slotMinutes(b) ?? Number.MAX_SAFE_INTEGER)
        ),
      }))
      .sort((a, b) => a.key.localeCompare(b.key));
  }, [doctor]);

  const selectedDay = days.find((d) => d.key === selectedKey) || null;

  const slots = useMemo(() => {
    if (!selectedDay) return [];
    const now = new Date();
    if (selectedDay.key !== toKey(now)) return selectedDay.slots;

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    return selectedDay.slots.filter((slot) => {
      const mins = slotMinutes(slot);
      return mins === null || mins > nowMinutes;
    });
  }, [selectedDay]);

  const fee = Number(doctor?.fee ?? doctor?.fees ?? 0);
  const doctorAvailable =
    String(doctor?.availability ?? "Available").toLowerCase() !==
      "unavailable" && doctor?.available !== false;

  const handleSelectDay = (key) => {
    setSelectedKey(key);
    setSelectedSlot("");
  };

  const handleMobileChange = (value) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    setFormData((prev) => ({ ...prev, mobile: digits }));
  };

  const handleMobilePaste = (e) => {
    e.preventDefault();
    const pasted = (e.clipboardData || window.clipboardData).getData("text");
    setFormData((prev) => ({ ...prev, mobile: normalizePhone(pasted) }));
  };

  const handleBooking = async () => {
    if (isSubmitting) return;

    if (!doctorAvailable) {
      toast.error("This doctor is currently unavailable.", {
        position: "top-center",
        autoClose: 2500,
      });
      return;
    }

    if (
      !formData.name.trim() ||
      !formData.age ||
      !formData.mobile ||
      !formData.gender
    ) {
      toast.error("Please fill all patient details!", {
        position: "top-center",
        autoClose: 2000,
      });
      return;
    }

    const ageNum = Number(formData.age);
    if (!Number.isInteger(ageNum) || ageNum < 0 || ageNum > 130) {
      toast.error("Please enter a valid age.", {
        position: "top-center",
        autoClose: 2200,
      });
      return;
    }

    const mobile = normalizePhone(formData.mobile);
    if (!/^0\d{10}$/.test(mobile)) {
      toast.error("Enter an 11-digit mobile number, e.g. 08012345678.", {
        position: "top-center",
        autoClose: 2800,
      });
      return;
    }

    if (!selectedDay || !selectedSlot) {
      toast.error("Please select a date and time slot", {
        position: "top-center",
        autoClose: 2000,
      });
      return;
    }

    if (!authLoaded || !userLoaded) {
      toast.error("Authentication not ready. Please try again in a moment.", {
        position: "top-center",
        autoClose: 2000,
      });
      return;
    }

    if (!isSignedIn) {
      toast.error("You must sign in to create an appointment.", {
        position: "top-center",
        autoClose: 2200,
      });
      return;
    }

    setIsSubmitting(true);

    const payload = {
      doctorId: doctor._id || doctor.id,
      patientName: formData.name.trim(),
      mobile,
      age: ageNum,
      gender: formData.gender,
      date: selectedDay.key,
      time: selectedSlot,
      paymentMethod: paymentMethod || "Online",
      email: formData.email || undefined,
    };

    try {
      const token = await getToken();
      if (!token) {
        throw new Error("Failed to obtain authentication token.");
      }

      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) {
        const message =
          body?.message || body?.error || `Booking failed (${res.status})`;
        toast.error(message, { position: "top-center" });
        return;
      }

      if (body?.checkoutUrl) {
        window.location.href = body.checkoutUrl;
        return;
      }

      toast.success("Booking successful", {
        position: "top-center",
        autoClose: 1500,
      });

      setTimeout(() => {
        router.push("/appointments?payment_status=Pending");
      }, 700);
    } catch (err) {
      console.error("Booking error:", err);
      toast.error(
        err?.message || "Network error - booking failed (auth or server issue)",
        { position: "top-center" }
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading)
    return (
      <div className={s.loadingContainer}>
        <div>Loading doctor...</div>
      </div>
    );

  if (error)
    return (
      <div className={s.errorContainer}>
        <div className={s.errorContent}>
          <div className={s.errorText}>Error</div>
          <div className={s.errorMessage}>{error}</div>
          <Link href="/doctors" className={s.backButton}>
            <ArrowLeft size={20} />
            Back to Doctors
          </Link>
        </div>
      </div>
    );

  if (!doctor)
    return (
      <div className={s.notFoundContainer}>
        <div className={s.notFoundContent}>
          <div className={s.notFoundEmoji}>😷</div>
          <h1 className={s.notFoundTitle}>Doctor Not Found</h1>
          <Link href="/doctors" className={s.backButton}>
            <ArrowLeft size={20} />
            Back to Doctors
          </Link>
        </div>
      </div>
    );

  const bookingDisabled =
    !selectedDay || !selectedSlot || isSubmitting || !doctorAvailable;

  return (
    <div>
      <Navbar />

      <div className={s.pageContainer}>
        <ToastContainer />
        <div className={s.headerContainer}>
          <div className={s.headerContent}>
            <div className={s.headerFlex}>
              <Link href="/doctors" className={s.headerBackButton}>
                <ArrowLeft size={18} />
                <span className={s.headerBackButtonText}>Back</span>
              </Link>

              <div className="flex items-center gap-3">
                <h1 className={s.headerTitle}>Doctor Profile</h1>
              </div>

              <div className={s.headerRatingContainer}>
                <Star className={s.headerRatingIcon} size={18} />
                <span className={s.headerRatingText}>{doctor.rating ?? 0}</span>
              </div>
            </div>
          </div>
        </div>

        <div
          className={`${s.mainContent} ${
            isVisible ? s.visibleState : s.hiddenState
          }`}
        >
          <div className={s.profileCard}>
            <div className={s.profileGrid}>
              <div className={s.leftColumn}>
                <div className={s.avatarContainer}>
                  <div className={s.avatarGlow}></div>

                  <img
                    src={
                      doctor.imageUrl ||
                      doctor.image ||
                      "/placeholder-doctor.jpg"
                    }
                    alt={doctor.name}
                    className={s.avatarImage}
                    style={{ objectPosition: "center" }}
                  />
                </div>

                <div className={s.statsGrid}>
                  <div className={s.statBox}>
                    <Heart className={`${s.statIcon} ${s.heartIcon}`} />
                    <div className={s.statValue}>
                      {doctor.success !== "" && doctor.success != null
                        ? `${doctor.success}%`
                        : "—"}
                    </div>
                    <div className={s.statLabel}>Success</div>
                  </div>
                  <div className={s.statBox}>
                    <Award className={`${s.statIcon} ${s.awardIcon}`} />
                    <div className={s.statValue}>
                      {doctor.experience ? `${doctor.experience} Years` : "—"}
                    </div>
                    <div className={s.statLabel}>Experience</div>
                  </div>
                  <div className={s.statBox}>
                    <Users className={`${s.statIcon} ${s.usersIcon}`} />
                    <div className={s.statValue}>{doctor.patients || "—"}</div>
                    <div className={s.statLabel}>Patients</div>
                  </div>
                </div>
              </div>

              <div className={s.rightColumn}>
                <div className="space-y-3">
                  <h1 className={s.doctorName}>{doctor.name}</h1>
                  <div className={s.specializationBadge}>
                    <Zap className={s.badgeIcon} />
                    {doctor.specialization || doctor.speciality || "General"}
                  </div>
                </div>

                <div className={s.infoGrid}>
                  <div className={s.infoItem}>
                    <GraduationCap className={s.infoIcon} />
                    <div>
                      <div className={s.infoLabel}>Qualifications</div>
                      <div className={s.infoValue}>{doctor.qualifications}</div>
                    </div>
                  </div>

                  <div className={s.infoItem}>
                    <MapPin className={s.infoIcon} />
                    <div>
                      <div className={s.infoLabel}>Location</div>
                      <div className={s.infoValue}>{doctor.location}</div>
                    </div>
                  </div>

                  <div className={s.infoItem}>
                    <Clock className={s.infoIcon} />
                    <div>
                      <div className={s.infoLabel}>Consultation Fee</div>
                      <div className={s.feeValue}>{formatNaira(fee)}</div>
                    </div>
                  </div>

                  <div className={s.infoItem}>
                    <Shield className={s.infoIcon} />
                    <div>
                      <div className={s.infoLabel}>Availability</div>
                      <div className={s.infoValue}>
                        {doctorAvailable ? "Available" : "Unavailable"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className={s.aboutContainer}>
                  <div className={s.aboutHeader}>
                    <BadgeInfo className={s.aboutIcon} />
                    <h3 className={s.aboutTitle}>About Doctor</h3>
                  </div>
                  <p className={s.aboutText}>{doctor.about || doctor.bio}</p>
                </div>
              </div>
            </div>
          </div>

          <div className={s.appointmentContainer}>
            <div className={s.appointmentContent}>
              <div className={s.appointmentHeader}>
                <CalendarCheck className={s.appointmentIcon} />
                <h2 className={s.appointmentTitle}>Book Your Appointment</h2>
              </div>

              {!doctorAvailable && (
                <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  This doctor is currently unavailable for new appointments.
                </div>
              )}

              <div className={s.appointmentGrid}>
                <div className={s.dateSection}>
                  <h3 className={s.dateTitle}>
                    <CalendarCheck className={s.dateTitleIcon} /> Select Date
                  </h3>

                  <div className={s.dateScrollContainer}>
                    <div className={s.dateButtonsContainer}>
                      {days.length === 0 && (
                        <p className={s.noSlotsMessage}>
                          No upcoming dates available.
                        </p>
                      )}

                      {days.map((day) => {
                        const isSelected = selectedKey === day.key;
                        return (
                          <button
                            type="button"
                            key={day.key}
                            onClick={() => handleSelectDay(day.key)}
                            className={`${s.dateButton} ${
                              isSelected
                                ? s.dateButtonSelected
                                : s.dateButtonUnselected
                            }`}
                          >
                            <div className={s.dateContent}>
                              <div className={s.dateWeekday}>
                                {day.date.toLocaleDateString("en-US", {
                                  weekday: "short",
                                })}
                              </div>
                              <div className={s.dateDay}>
                                {day.date.getDate()}
                              </div>
                              <div className={s.dateMonth}>
                                {day.date.toLocaleDateString("en-US", {
                                  month: "short",
                                })}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className={s.patientForm}>
                    <h3 className={s.patientFormTitle}>Patient Details</h3>

                    <div className={s.patientFormGrid}>
                      <input
                        type="text"
                        placeholder="Full Name"
                        className={s.formInput}
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                      />

                      <input
                        type="number"
                        min="0"
                        max="130"
                        placeholder="Age"
                        className={s.formInput}
                        value={formData.age}
                        onChange={(e) =>
                          setFormData({ ...formData, age: e.target.value })
                        }
                      />

                      <input
                        type="tel"
                        inputMode="numeric"
                        maxLength={11}
                        placeholder="Mobile Number (e.g. 08012345678)"
                        className={s.formInput}
                        value={formData.mobile}
                        onChange={(e) => handleMobileChange(e.target.value)}
                        onPaste={handleMobilePaste}
                      />

                      <select
                        className={s.formSelect}
                        value={formData.gender}
                        onChange={(e) =>
                          setFormData({ ...formData, gender: e.target.value })
                        }
                      >
                        <option value="">Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>

                      <input
                        type="email"
                        placeholder="Email (optional - for receipts)"
                        className={s.emailInput}
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                      />
                    </div>
                  </div>
                </div>

                <div className={s.timeSlotsSection}>
                  <h3 className={s.timeSlotsTitle}>
                    <Clock className={s.timeSlotsIcon} /> Available Time Slots
                  </h3>

                  <div className={s.timeSlotsContainer}>
                    {slots.length === 0 && (
                      <p className={s.noSlotsMessage}>
                        {selectedDay
                          ? "No time slots left for this date."
                          : "Select a date to see time slots."}
                      </p>
                    )}

                    {slots.map((slot) => (
                      <button
                        type="button"
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`${s.timeSlotButton} ${
                          selectedSlot === slot
                            ? s.timeSlotButtonSelected
                            : s.timeSlotButtonUnselected
                        }`}
                      >
                        <div className={s.timeSlotContent}>
                          <Clock className={s.timeSlotIcon} />
                          <span>{slot}</span>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className={s.summaryContainer}>
                    <div className={s.summaryItem}>
                      <div className={s.summaryRow}>
                        <span className={s.summaryLabel}>Selected Doctor:</span>
                        <span className={s.summaryValue}>
                          {doctor?.name || "—"}
                        </span>
                      </div>

                      <div className={s.summaryRow}>
                        <span className={s.summaryLabel}>
                          Doctor Speciality:
                        </span>
                        <span className={s.summaryValue}>
                          {doctor?.specialization || doctor?.speciality || "—"}
                        </span>
                      </div>

                      <div className={s.summaryRow}>
                        <span className={s.summaryLabel}>Selected Date:</span>
                        <span className={s.summaryValue}>
                          {selectedDay
                            ? selectedDay.date.toLocaleDateString("en-US", {
                                weekday: "long",
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "Not selected"}
                        </span>
                      </div>

                      <div className={s.summaryRow}>
                        <span className={s.summaryLabel}>Selected Time:</span>
                        <span className={s.summaryValue}>
                          {selectedSlot || "Not selected"}
                        </span>
                      </div>

                      <div className={s.summaryRow}>
                        <span className={s.summaryLabel}>
                          Consultation Fee:
                        </span>
                        <span className={s.feeDisplay}>{formatNaira(fee)}</span>
                      </div>
                    </div>

                    <div className={s.paymentContainer}>
                      <label className={s.paymentLabel}>Payment:</label>
                      <div className={s.paymentOptions}>
                        <label
                          className={`${s.paymentOption} ${
                            paymentMethod === "Cash"
                              ? s.paymentOptionSelected
                              : s.paymentOptionUnselected
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment"
                            value="Cash"
                            checked={paymentMethod === "Cash"}
                            onChange={() => setPaymentMethod("Cash")}
                            className={s.paymentRadio}
                          />
                          Cash
                        </label>
                        <label
                          className={`${s.paymentOption} ${
                            paymentMethod === "Online"
                              ? s.paymentOptionSelected
                              : s.paymentOptionUnselected
                          }`}
                        >
                          <input
                            type="radio"
                            name="payment"
                            value="Online"
                            checked={paymentMethod === "Online"}
                            onChange={() => setPaymentMethod("Online")}
                            className={s.paymentRadio}
                          />
                          Online
                        </label>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleBooking}
                      disabled={bookingDisabled}
                      className={`${s.bookingButton} ${
                        bookingDisabled
                          ? s.bookingButtonDisabled
                          : s.bookingButtonEnabled
                      }`}
                    >
                      <div className={s.bookingButtonContent}>
                        <Phone className={s.bookingIcon} />
                        <span>
                          {isSubmitting ? "Booking..." : "Confirm Booking"}
                        </span>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Page;
