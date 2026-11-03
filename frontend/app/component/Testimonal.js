"use client";

import React, { useEffect, useRef, useState } from "react";
import { testimonialStyles as s } from "../assets/dummyStyles.js";
import { Star } from "lucide-react";
import Image from "next/image.js";

const Testimonal = () => {
  const scrollRefLeft = useRef(null);
  const scrollRefRight = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

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

  useEffect(() => {
    const scrollLeft = scrollRefLeft.current;
    const scrollRight = scrollRefRight.current;
    if (!scrollLeft || !scrollRight) return;

    let scrollSpeed = 0.5; // preserved animation speed
    let rafId;

    const smoothScroll = () => {
      if (!isPaused) {
        scrollLeft.scrollTop += scrollSpeed;
        scrollRight.scrollTop -= scrollSpeed;

        // seamless infinite loop
        if (scrollLeft.scrollTop >= scrollLeft.scrollHeight / 2) {
          scrollLeft.scrollTop = 0;
        }
        if (scrollRight.scrollTop <= 0) {
          scrollRight.scrollTop = scrollRight.scrollHeight / 2;
        }
      }
      rafId = requestAnimationFrame(smoothScroll);
    };

    rafId = requestAnimationFrame(smoothScroll);
    return () => cancelAnimationFrame(rafId);
  }, [isPaused]);

  const renderStars = (rating) =>
    Array.from({ length: 5 }, (_, i) => (
      <span key={i} className={i < rating ? s.activeStar : s.inactiveStar}>
        <Star className={s.star} />
      </span>
    ));

  const TestimonialCard = ({ testimonial, direction }) => (
    <div
      className={`${s.testimonialCard} ${
        direction === "left"
          ? s.leftCardBorder
          : s.rightCardBorder
      }`}
    >
      <div className={s.cardContent}>
        <Image
          src={testimonial.image}
          alt={testimonial.name}
          className={s.avatar}
          width={540}
          height={540}
        />
        <div className={s.textContainer}>
          <div className={s.nameRoleContainer}>
            <div>
              <h4
                className={`${s.name} ${
                  direction === "left"
                    ? s.leftName
                    : s.rightName
                }`}
              >
                {testimonial.name}
              </h4>
              <p className={s.role}>{testimonial.role}</p>
            </div>
            <div className={s.starsContainer}>
              {renderStars(testimonial.rating)}
            </div>
          </div>

          <p className={s.quote}>"{testimonial.text}"</p>

          <div className={s.mobileStarsContainer}>
            {renderStars(testimonial.rating)}
          </div>
        </div>
      </div>
    </div>
  );
  return (
    <div className={s.container}>
      <div className={s.headerContainer}>
        <h2 className={s.title}>
          Voice of Trust
        </h2>
        <p className={s.subtitle}>
          Real stories from doctors and patients sharing their positive experience with out healthcare platform.
        </p>
      </div>
    </div>
  );
};

export default Testimonal;
