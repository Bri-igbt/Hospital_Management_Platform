"use client";

import React, { useCallback, useEffect, useState } from "react";
import { homeDoctorsStyles as s, iconSize } from "@/app/assets/dummyStyles.js";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight, Medal, MousePointer2Off } from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const FALLBACK_IMAGE = "/placeholder-doctor.jpg";

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

function DoctorImage({ src, alt, width, height }) {
  const [failed, setFailed] = useState(false);

  return (
    <Image
      src={failed || !src ? FALLBACK_IMAGE : src}
      alt={alt}
      className={s.image}
      onError={() => setFailed(true)}
      width={500}
      height={500}
      quality={90}
      sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
    />
  );
}

const HomeDoctors = ({ previewCount = 8 }) => {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        setDoctors([]);
        return;
      }

      const items =
        json?.data || json?.doctors || (Array.isArray(json) ? json : []);
      setDoctors((Array.isArray(items) ? items : []).map(normalizeDoctor));
    } catch (err) {
      console.error("load doctors error:", err);
      setError("Network error while loading doctors.");
      setDoctors([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoctors();
  }, [loadDoctors]);

  const preview = doctors.slice(0, previewCount);

  return (
    <div className={s.section}>
      <div className={s.container}>
        <div className={s.header}>
          <h1 className={s.title}>
            Our <span className={s.titleSpan}>Medical Team</span>
          </h1>
          <p className={s.subtitle}>
            Book appointments quickly with our verified specialists
          </p>
        </div>

        {error ? (
          <div className={s.errorContainer}>
            <div className={s.errorText}>{error}</div>
            <button
              type="button"
              onClick={loadDoctors}
              className={s.retryButton}
            >
              Retry
            </button>
          </div>
        ) : null}

        {loading ? (
          <div className={s.skeletonGrid}>
            {Array.from({ length: previewCount }).map((_, i) => (
              <div key={i} className={s.skeletonCard}>
                <div className={s.skeletonImage}></div>
                <div className={s.skeletonText1}></div>
                <div className={s.skeletonText2}></div>
                <div className="flex gap-2 mt-auto">
                  <div className={s.skeletonButton}></div>
                </div>
              </div>
            ))}
          </div>
        ) : !error && preview.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            No doctors available right now.
          </div>
        ) : (
          <div className={s.doctorsGrid}>
            {preview.map((doctor) => (
              <article key={doctor.id || doctor.name} className={s.article}>
                {doctor.available ? (
                  <Link href={`/doctors/${doctor.id}`}>
                    <div className={s.imageContainerAvailable}>
                      <DoctorImage
                        key={doctor.image}
                        src={doctor.image}
                        alt={doctor.name}
                        width={540}
                        height={540}
                      />
                    </div>
                  </Link>
                ) : (
                  <div className={s.imageContainerUnavailable}>
                    <DoctorImage
                      key={doctor.image}
                      src={doctor.image}
                      alt={doctor.name}
                      width={540}
                      height={540}
                    />

                    <div className={s.unavailableBadge}>Not Available</div>
                  </div>
                )}

                <div className={s.cardBody}>
                  <h3 className={s.doctorName} id={`doctor-${doctor.id}-name`}>
                    {doctor.name}
                  </h3>

                  <p className={s.specialization}>{doctor.specialization}</p>

                  <div className={s.experienceContainer}>
                    {doctor.experience && (
                      <div className={s.experienceBadge}>
                        <Medal className={`${iconSize.small} h-4`} />
                        <span>{doctor.experience} years Experience</span>
                      </div>
                    )}
                  </div>

                  <div className={s.buttonContainer}>
                    <div className="w-full">
                      {doctor.available ? (
                        <Link
                          href={`/doctors/${doctor.id}`}
                          className={s.buttonAvailable}
                        >
                          <ChevronRight className="w-5 h-5" />
                          Book Now
                        </Link>
                      ) : (
                        <button disabled className={s.buttonUnavailable}>
                          <MousePointer2Off className="w-5 h-5" />
                          Not Available
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
      <style>{s.customCSS}</style>
    </div>
  );
};

export default HomeDoctors;
