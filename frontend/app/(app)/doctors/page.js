"use client";

import { doctorsPageStyles, doctorsPageStyles as s } from "@/app/assets/dummyStyles.js";
import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import { Search, X } from "lucide-react";
import Image from "next/image.js";
import Link from "next/link.js";
import { useEffect, useMemo, useState } from "react";

const page = () => {
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  const [allDoctors, setAllDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`${API_BASE}/api/doctors`);
        const json = await res.json().catch(() => null);

        if (!res.ok) {
          const msg =
            (json && json.message) || `Failed to load doctors (${res.status})`;
          if (mounted) {
            setError(msg);
            setAllDoctors([]);
            setLoading(false);
          }
          return;
        }

        const items = (json && (json.data || json)) || [];
        const normalized = (Array.isArray(items) ? items : []).map((d) => {
          const id = d._id || d.id;
          const image =
            d.imageUrl || d.image || d.imageSmall || d.imageSrc || "";
          let available = true;
          if (typeof d.availability === "string") {
            available = d.availability.toLowerCase() === "available";
          } else if (typeof d.available === "boolean") {
            available = d.available;
          } else if (typeof d.availability === "boolean") {
            available = d.availability;
          } else {
            available = d.availability === "Available" || d.available === true;
          }
          return {
            id,
            name: d.name || "Unknown",
            specialization: d.specialization || "",
            image,
            experience:
              d.experience ?? d.experience === 0 ? String(d.experience) : "—",
            fee: d.fee ?? d.price ?? 0,
            available,
            raw: d,
          };
        });

        if (mounted) {
          setAllDoctors(normalized);
          setError("");
        }
      } catch (err) {
        console.error("load doctors error:", err);
        if (mounted) {
          setError("Network error while loading doctors.");
          setAllDoctors([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [API_BASE]);

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
    : filteredDoctors.slice(0, 8);

  const retry = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/doctors`);
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError((json && json.message) || `Failed to load (${res.status})`);
        setAllDoctors([]);
        return;
      }
      const items = (json && (json.data || json)) || [];
      const normalized = (Array.isArray(items) ? items : []).map((d) => {
        const id = d._id || d.id;
        const image = d.imageUrl || d.image || "";
        let available = true;
        if (typeof d.availability === "string") {
          available = d.availability.toLowerCase() === "available";
        } else if (typeof d.available === "boolean") {
          available = d.available;
        } else {
          available = d.availability === "Available" || d.available === true;
        }
        return {
          id,
          name: d.name || "Unknown",
          specialization: d.specialization || "",
          image,
          experience: d.experience ?? "—",
          fee: d.fee ?? d.price ?? 0,
          available,
          raw: d,
        };
      });
      setAllDoctors(normalized);
      setError("");
    } catch (e) {
      console.error(e);
      setError("Network error while loading doctors.");
      setAllDoctors([]);
    } finally {
      setLoading(false);
    }
  };

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
              Find your ideal doctor ny name or specialization
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
                <button onClick={retry} className={s.retryButton}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {loading ? (
            <div className={s.skeletonGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={s.skeletonCard}>
                  <div className={s.skeletonImage} />
                  <div className={s.skeletonName} />
                  <div className={s.specialization} />
                  <div className={s.skeletonButton} />
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`${s.doctorsGrid} ${
                filteredDoctors.length === 0 ? "opacity-70" : "opacity-100"
              }`}
            >
              {displayedDoctors.length > 0 ? (
                displayedDoctors.map((doctor, index) => (
                  <div 
                    key={doctor.id || `${doctor.name}-${index}`}
                    className={`${s.doctorCard} ${
                      !doctor.available ? s.doctorCardUnavailable : ""
                    }`}
                    style={{
                      animationDelay: `${index * 90}ms`
                    }}
                    role="article"
                  >
                    {doctor.available ? (
                    <Link
                      to={`/doctors/${doctor.id}`}
                      state={{ doctor: doctor.raw || doctor }}
                      className={s.focusRing}
                    >
                      <div className={s.imageContainer}>
                        <Image
                          src={doctor.image || "/placeholder-doctor.jpg"}
                          alt={doctor.name}
                          loading="lazy"
                          className={s.doctorImage}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = "/placeholder-doctor.jpg";
                          }}
                        />
                      </div>
                    </Link>
                  ) : (
                    <div
                      className={`${s.imageContainer} ${s.imageContainerUnavailable}`}
                    >
                      <Image
                        src={doctor.image || "/placeholder-doctor.jpg"}
                        alt={doctor.name}
                        loading="lazy"
                        className={s.doctorImageUnavailable}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/placeholder-doctor.jpg";
                        }}
                      />
                    </div>
                  )}

                  <h3></h3>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
};

export default page;
