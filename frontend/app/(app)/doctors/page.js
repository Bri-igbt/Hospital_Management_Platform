"use client";

import { doctorsPageStyles as s } from "@/app/assets/dummyStyles.js";
import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import {
  ChevronRight,
  CircleChevronDown,
  CircleChevronUp,
  Medal,
  MousePointer2Off,
  Search,
  X,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FALLBACK_IMAGE = "/placeholder-doctor.jpg";
const INITIAL_COUNT = 8;

function isAvailable(d) {
  if (typeof d.availability === "string") {
    return d.availability.toLowerCase() === "available";
  }
  if (typeof d.available === "boolean") return d.available;
  return d.availability === true;
}

function normalizeDoctor(d) {
  const hasExperience =
    d.experience !== undefined && d.experience !== null && d.experience !== "";

  return {
    id: d._id || d.id,
    name: d.name || "Unknown",
    specialization: d.specialization || "",
    image: d.imageUrl || d.image || d.imageSmall || d.imageSrc || "",
    experience: hasExperience ? String(d.experience) : "",
    fee: d.fee ?? d.price ?? 0,
    available: isAvailable(d),
  };
}

function DoctorImage({ src, alt, className }) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      src={failed || !src ? FALLBACK_IMAGE : src}
      alt={alt}
      className={className}
      onError={() => setFailed(true)}
      width={500}
      height={500}
      quality={90}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    />
  );
}

const Page = () => {
  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);

  const loadDoctors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/doctors`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          (json && json.message) || `Failed to load doctors (${res.status})`
        );
        setAllDoctors([]);
        return;
      }

      const items =
        json?.data || json?.doctors || (Array.isArray(json) ? json : []);
      setAllDoctors((Array.isArray(items) ? items : []).map(normalizeDoctor));
    } catch (err) {
      console.error("load doctors error:", err);
      setError("Network error while loading doctors.");
      setAllDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const filteredDoctors = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return allDoctors;
    return allDoctors.filter(
      (doctor) =>
        (doctor.name || "").toLowerCase().includes(q) ||
        (doctor.specialization || "").toLowerCase().includes(q)
    );
  }, [allDoctors, searchTerm]);

  const displayedDoctors = showAll
    ? filteredDoctors
    : filteredDoctors.slice(0, INITIAL_COUNT);

  return (
    <div>
      <Navbar />
      <div className={s.mainContainer}>
        <div className={s.backgroundShape1} />
        <div className={s.backgroundShape2} />

        <div className={s.wrapper}>
          <div className={s.headerContainer}>
            <h1 className={s.headerTitle}>Our Medical Experts</h1>
            <p className={s.headerSubtitle}>
              Find your ideal doctor by name or specialization
            </p>
          </div>

          <div className={s.searchContainer}>
            <div className={s.searchWrapper}>
              <input
                type="text"
                placeholder="Search doctors by name or specialization"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={s.searchInput}
              />

              <Search className={s.searchIcon} />
              {searchTerm.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  className={s.clearButton}
                  onClick={() => setSearchTerm("")}
                >
                  <X size={20} strokeWidth={3.5} />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className={s.errorContainer}>
              <div className={s.errorText}>{error}</div>
              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={loadDoctors}
                  className={s.retryButton}
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className={s.skeletonGrid}>
              {Array.from({ length: INITIAL_COUNT }).map((_, i) => (
                <div key={i} className={s.skeletonCard}>
                  <div className={s.skeletonImage} />
                  <div className={s.skeletonName} />
                  <div className={s.specialization} />
                  <div className={s.skeletonButton} />
                </div>
              ))}
            </div>
          ) : error ? null : (
            <div
              className={`${s.doctorsGrid} ${
                filteredDoctors.length === 0 ? "opacity-70" : "opacity-100"
              }`}
            >
              {displayedDoctors.length > 0 ? (
                displayedDoctors.map((doctor, index) => (
                  <article
                    key={doctor.id || `${doctor.name}-${index}`}
                    className={`${s.doctorCard} ${
                      !doctor.available ? s.doctorCardUnavailable : ""
                    }`}
                    style={{
                      animationDelay: `${Math.min(index, 8) * 90}ms`,
                    }}
                  >
                    {doctor.available ? (
                      <Link
                        href={`/doctors/${doctor.id}`}
                        className={s.focusRing}
                      >
                        <div className={s.imageContainer}>
                          <DoctorImage
                            key={doctor.image}
                            src={doctor.image}
                            alt={doctor.name}
                            className={s.doctorImage}
                          />
                        </div>
                      </Link>
                    ) : (
                      <div
                        className={`${s.imageContainer} ${s.imageContainerUnavailable}`}
                      >
                        <DoctorImage
                          key={doctor.image}
                          src={doctor.image}
                          alt={doctor.name}
                          className={s.doctorImageUnavailable}
                        />
                      </div>
                    )}

                    <h3 className={s.doctorName}>{doctor.name}</h3>
                    <p className={s.doctorSpecialization}>
                      {doctor.specialization}
                    </p>

                    {doctor.experience && (
                      <div className={s.experienceBadge}>
                        <Medal className={s.experienceIcon} />
                        <span>{doctor.experience} years Experience</span>
                      </div>
                    )}

                    {doctor.available ? (
                      <Link
                        href={`/doctors/${doctor.id}`}
                        aria-label={`Book an appointment with ${doctor.name}`}
                        className={s.bookButton}
                      >
                        <ChevronRight className={s.bookButtonIcon} />
                      </Link>
                    ) : (
                      <button disabled className={s.notAvailableButton}>
                        <MousePointer2Off className={s.notAvailableIcon} />
                        Not Available
                      </button>
                    )}
                  </article>
                ))
              ) : (
                <div className={s.noResults}>
                  No doctors found matching your search criteria
                </div>
              )}
            </div>
          )}

          {filteredDoctors.length > INITIAL_COUNT && (
            <div className={s.showMoreContainer}>
              <button
                type="button"
                onClick={() => setShowAll((prev) => !prev)}
                className={s.showMoreButton}
              >
                {showAll ? (
                  <>
                    <CircleChevronUp className={s.showMoreIcon} />
                    Hide
                  </>
                ) : (
                  <>
                    <CircleChevronDown className={s.showMoreIcon} />
                    Show More
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />

      <style>{`
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in { animation: fade-in 0.9s ease-out; }
        .animate-fade-in-up { animation: fade-in-up 0.9s ease-out both; }
        .animate-slide-up { animation: slide-up 0.8s ease-out; }

        @media (max-width: 420px) {
          .max-w-7xl { padding-left: 10px; padding-right: 10px; }
        }

        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </div>
  );
};

export default Page;
