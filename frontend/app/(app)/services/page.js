"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ChevronsRight, MousePointer2Off } from "lucide-react";
import Footer from "@/app/component/Footer.js";
import Navbar from "@/app/component/Navbar.js";
import {
  servicePageStyles as s,
  serviceCardStyles as p,
} from "@/app/assets/dummyStyles.js";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const PLACEHOLDER_IMG = "/placeholder-service.jpg";

function isAvailable(item) {
  if (typeof item.available === "boolean") return item.available;
  if (typeof item.availability === "string") {
    return item.availability.toLowerCase() === "available";
  }
  return item.availability === true;
}

function normalizeService(item) {
  return {
    id: item._id || item.id,
    name: item.name || "Service",
    image: item.imageUrl || item.image || item.imageSmall || "",
    price: item.price ?? item.fee ?? 0,
    available: isAvailable(item),
  };
}

function ServiceImage({ src, alt }) {
  const [failed, setFailed] = useState(false);

  return (
    <img
      src={failed || !src ? PLACEHOLDER_IMG : src}
      alt={alt}
      loading="lazy"
      decoding="async"
      className={p.fallbackImage}
      onError={() => setFailed(true)}
    />
  );
}

const ServiceCard = ({ service }) => {
  const { name } = service;

  return (
    <div className={p.card}>
      <div className={p.imageContainer}>
        <ServiceImage key={service.image} src={service.image} alt={name} />
      </div>

      <div className={p.content}>
        <h3 className={p.serviceName}>{name}</h3>

        <div className={p.buttonContainer}>
          {service.available ? (
            <Link
              href={`/services/${service.id}`}
              className={p.buttonAvailable}
              aria-label={`Book ${name}`}
            >
              <ChevronsRight className="w-5 h-5" aria-hidden="true" />
              Book Now
            </Link>
          ) : (
            <button
              disabled
              className={p.buttonUnavailable}
              aria-label={`${name} not available`}
            >
              <MousePointer2Off className="w-5 h-5" aria-hidden="true" />
              Not Available
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Page = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadServices = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API_BASE}/api/services`);
      const json = await res.json().catch(() => null);

      if (!res.ok) {
        setError(
          (json && json.message) || `Failed to load services (${res.status})`
        );
        setServices([]);
        return;
      }

      const items =
        json?.data || json?.services || (Array.isArray(json) ? json : []);
      setServices((Array.isArray(items) ? items : []).map(normalizeService));
    } catch (err) {
      console.error("load services error:", err);
      setError("Network error while loading services.");
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  return (
    <div>
      <Navbar />

      <div className={s.pageContainer}>
        <div className={s.maxWidthContainer}>
          <header className={s.header}>
            <h1 className={s.title}>Our Diagnostic Services</h1>
            <p className={s.subtitle}>Safe, accurate & reliable testing.</p>
          </header>

          {error && (
            <div className={s.errorContainer}>
              <div className={s.errorText}>{error}</div>
              <button
                type="button"
                className={s.retryButton}
                onClick={loadServices}
              >
                Retry
              </button>
            </div>
          )}

          {loading ? (
            <section className={s.skeletonGrid}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className={s.skeletonCard}>
                  <div className={s.skeletonImage} />
                  <div className={s.skeletonText1} />
                  <div className={s.skeletonText2} />
                  <div className={s.skeletonButton} />
                </div>
              ))}
            </section>
          ) : error ? null : (
            <section className={s.servicesGrid}>
              {services.length > 0 ? (
                services.map((service) => (
                  <ServiceCard
                    key={service.id || service.name}
                    service={service}
                  />
                ))
              ) : (
                <div className={s.emptyState}>No services available</div>
              )}
            </section>
          )}
        </div>
      </div>

      <Footer />
    </div>
  );
};

export default Page;
