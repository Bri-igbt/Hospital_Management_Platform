"use client";

import React, { useEffect, useRef } from "react";
import { testimonialStyles as s } from "@/app/assets/dummyStyles.js";
import { Star } from "lucide-react";
import Image from "next/image";

const testimonials = [
  {
    id: 1,
    name: "Dr. Sarah Johnson",
    role: "Cardiologist",
    rating: 5,
    text: "The appointment booking system is incredibly efficient. It saves me valuable time and helps me focus on patient care.",
    image:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
    type: "doctor",
  },
  {
    id: 2,
    name: "Michael Chen",
    role: "Patient",
    rating: 5,
    text: "Scheduling appointments has never been easier. The interface is intuitive and reminders are very helpful!",
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80",
    type: "patient",
  },
  {
    id: 3,
    name: "Dr. Robert Martinez",
    role: "Pediatrician",
    rating: 4,
    text: "This platform has streamlined our clinic operations significantly. Patient management is much more organized.",
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80",
    type: "doctor",
  },
  {
    id: 4,
    name: "Emily Williams",
    role: "Patient",
    rating: 5,
    text: "Booking appointments online 24/7 is a game-changer. The confirmation system gives me peace of mind.",
    image:
      "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=400&q=80",
    type: "patient",
  },
  {
    id: 5,
    name: "Dr. Amanda Lee",
    role: "Dermatologist",
    rating: 5,
    text: "Excellent platform for managing appointments. Automated reminders reduce no-shows dramatically.",
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80",
    type: "doctor",
  },
  {
    id: 6,
    name: "David Thompson",
    role: "Patient",
    rating: 5,
    text: "The wait time has reduced significantly since using this platform. Very convenient and user-friendly!",
    image:
      "https://images.unsplash.com/photo-1607746882042-944635dfe10e?auto=format&fit=crop&w=400&q=80",
    type: "patient",
  },
];

const leftTestimonials = testimonials.filter((t) => t.type === "doctor");
const rightTestimonials = testimonials.filter((t) => t.type === "patient");

const SCROLL_SPEED = 0.5;

function renderStars(rating) {
  return (
    <div className="flex" role="img" aria-label={`${rating} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, i) => (
        <span key={i} className={i < rating ? s.activeStar : s.inactiveStar}>
          <Star className={s.star} />
        </span>
      ))}
    </div>
  );
}

function TestimonialCard({ testimonial, direction, hidden = false }) {
  const isLeft = direction === "left";

  return (
    <div
      aria-hidden={hidden || undefined}
      className={`${s.testimonialCard} ${
        isLeft ? s.leftCardBorder : s.rightCardBorder
      }`}
    >
      <div className={s.cardContent}>
        <Image
          src={testimonial.image}
          alt={hidden ? "" : testimonial.name}
          className={s.avatar}
          width={160}
          height={160}
          quality={90}
        />
        <div className={s.textContainer}>
          <div className={s.nameRoleContainer}>
            <div>
              <h4 className={`${s.name} ${isLeft ? s.leftName : s.rightName}`}>
                {testimonial.name}
              </h4>
              <p className={s.role}>{testimonial.role}</p>
            </div>
            <div className={s.starsContainer}>
              {renderStars(testimonial.rating)}
            </div>
          </div>

          <p className={s.quote}>&ldquo;{testimonial.text}&rdquo;</p>

          <div className={s.mobileStarsContainer}>
            {renderStars(testimonial.rating)}
          </div>
        </div>
      </div>
    </div>
  );
}

const Testimonial = () => {
  const scrollRefLeft = useRef(null);
  const scrollRefRight = useRef(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const left = scrollRefLeft.current;
    const right = scrollRefRight.current;
    if (!left || !right) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let leftPos = left.scrollTop;
    let rightPos = right.scrollHeight / 2;
    right.scrollTop = rightPos;

    let rafId;
    const tick = () => {
      if (pausedRef.current) {
        leftPos = left.scrollTop;
        rightPos = right.scrollTop;
      } else {
        const leftHalf = left.scrollHeight / 2;
        const rightHalf = right.scrollHeight / 2;

        leftPos += SCROLL_SPEED;
        if (leftPos >= leftHalf) leftPos -= leftHalf;

        rightPos -= SCROLL_SPEED;
        if (rightPos <= 0) rightPos += rightHalf;

        left.scrollTop = leftPos;
        right.scrollTop = rightPos;
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, []);

  const pause = () => {
    pausedRef.current = true;
  };
  const resume = () => {
    pausedRef.current = false;
  };

  return (
    <div className={s.container}>
      <div className={s.headerContainer}>
        <h2 className={s.title}>Voice of Trust</h2>
        <p className={s.subtitle}>
          Real stories from doctors and patients sharing their positive
          experience with our healthcare platform.
        </p>
      </div>

      <div className={s.grid} onMouseEnter={pause} onMouseLeave={resume}>
        <div className={`${s.columnContainer} ${s.leftColumnBorder}`}>
          <div className={`${s.columnHeader} ${s.leftColumnHeader}`}>
            👩‍⚕️ Medical Professionals
          </div>

          <div
            ref={scrollRefLeft}
            className={s.scrollContainer}
            onTouchStart={pause}
            onTouchEnd={resume}
          >
            {[...leftTestimonials, ...leftTestimonials].map((t, i) => (
              <TestimonialCard
                key={`L-${i}`}
                testimonial={t}
                direction="left"
                hidden={i >= leftTestimonials.length}
              />
            ))}
          </div>
        </div>

        <div className={`${s.columnContainer} ${s.rightColumnBorder}`}>
          <div className={`${s.columnHeader} ${s.rightColumnHeader}`}>
            🧑‍💼 Patients
          </div>

          <div
            ref={scrollRefRight}
            className={s.scrollContainer}
            onTouchStart={pause}
            onTouchEnd={resume}
          >
            {[...rightTestimonials, ...rightTestimonials].map((t, i) => (
              <TestimonialCard
                key={`R-${i}`}
                testimonial={t}
                direction="right"
                hidden={i >= rightTestimonials.length}
              />
            ))}
          </div>
        </div>
      </div>

      <style>{s.animationStyles}</style>
    </div>
  );
};

export default Testimonial;
