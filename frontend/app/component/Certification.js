"use client";

import React from "react";
import { certificationStyles as s } from "../assets/dummyStyles.js";
import C3 from "@/app/assets/C3.png";
import C1 from "@/app/assets/C1.png";
import C2 from "@/app/assets/C2.png";
import C4 from "@/app/assets/C4.svg";
import C5 from "@/app/assets/C5.png";
import C6 from "@/app/assets/C6.png";
import C7 from "@/app/assets/C7.svg";
import Image from "next/image.js";

const Certification = () => {
  const certifications = [
    { id: 1, 
      name: "Medical Commission", 
      image: C1, 
      type: "international" 
    },
    { 
      id: 2, 
      name: "Government Approved", 
      image: C2, 
      type: "government" 
    },
    {
      id: 3,
      name: "NABH Accredited",
      image: C3,
      alt: "NABH Accreditation",
      type: "healthcare",
    },
    { id: 4, name: "Medical Council", image: C4, type: "government" },
    {
      id: 5,
      name: "Quality Healthcare",
      image: C5,
      alt: "Quality Healthcare",
      type: "healthcare",
    },
    {
      id: 6,
      name: "Paramedical Council",
      image: C6,
      alt: "Patient Safety",
      type: "healthcare",
    },
    {
      id: 7,
      name: "Ministry of Health",
      image: C7,
      alt: "Ministry of Health",
      type: "government",
    },
  ];

  const duplicatedCertifications = [
    ...certifications,
    ...certifications,
    ...certifications,
  ];

  return (
    <div className={s.container}>
      <div className={s.backgroundGrid}>
        <div className={s.topLine}></div>
        <div className={s.gridContainer}>
          <div className={s.grid}>
            {Array.from({ length: 144 }).map((_, i) => (
              <div key={i} className={s.gridCell} />
            ))}
          </div>
        </div>
      </div>

      <div className={s.contentWrapper}>
        <div className={s.headingContainer}>
          <div className={s.headingInner}>
            <div className={s.leftLine} />
            <div className={s.rightLine} />

            <h2 className={s.title}>
              <span className={s.titleText}>
                CERTIFIED & EXCELLENCE
              </span>
            </h2>
          </div>

          <p className={s.subtitle}>
            Government recognized and internationally accredited healthcare standards
          </p>

          <div className={s.badgeContainer}>
            <div className={s.badgeDot}></div>
            <span className={s.badgeText}>
              OFFICIALLY CERTIFIED
            </span>
          </div>
        </div>

        <div className={s.logosContainer}>
          <div className={s.logosInner}>
            <div className={s.logosFlexContainer}>
              <div className={s.logosMarquee}>
                {duplicatedCertifications.map((cert, index) => (
                  <div 
                    key={`cert-${cert.id}-${index}`}
                    className={s.logoItem}
                  >
                    <div className="relative">
                      <Image 
                        src={cert.image}
                        alt={cert.image}
                        className={s.logoImage}
                        width={120}
                        height={120}
                      />
                    </div>

                    <span className={s.logoText}> {cert.name} </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      <style>{s.animationStyles}</style>
    </div>
  );
};

export default Certification;
