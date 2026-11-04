"use client";

import React from "react";
import { bannerStyles as s } from "@/app/assets/dummyStyles.js";
import { Calendar, Clock, Phone, Ribbon, Star, Stethoscope } from "lucide-react";
import { useRouter } from "next/navigation.js";
import banner from '@/app/assets/BannerImg.png'
import Image from "next/image.js";

const Banner = () => {
  const router = useRouter();
  return (
    <div className={s.bannerContainer}>
      <div className={s.mainContainer}>
        <div className={s.borderOutline}>
          <div className={s.outerAnimatedBand}></div>
          <div className={s.innerWhiteBorder}></div>
        </div>

        <div className={s.contentContainer}>
          <div className={s.flexContainer}>
            <div className={s.leftContent}>
              <div className={s.headerBadgeContainer}>
                <div className={s.stethoscopeContainer}>
                  <div className={s.stethoscopeInner}>
                    <Stethoscope className={s.stethoscopeIcon} />
                  </div>
                </div>

                <div className={s.titleContainer}>
                  <h1 className={s.title}>
                    Medi
                    <span className={s.titleGradient}>Care+</span>
                  </h1>

                  <div className={s.starsContainer}>
                    <div className={s.starsInner}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star className={s.starIcon} key={star} />
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <p className={s.tagline}>
                Premium Healthcare
                <span className={`block ${s.taglineHighlight}`}>
                  At Your Fingertips
                </span>
              </p>

              <div className={s.featuresGrid}>
                <div className={`${s.featureItem} ${s.featureBorderGreen}`}>
                  <Ribbon className={s.featureIcon} />
                  <span className={s.featureText}>Certified Specialists</span>
                </div>

                <div className={`${s.featureItem} ${s.featureBorderBlue}`}>
                  <Clock className={s.featureIcon} />
                  <span className={s.featureText}>24/7 Availability</span>
                </div>

                <div className={`${s.featureItem} ${s.featureBorderEmerald}`}>
                  <Ribbon className={s.featureIcon} />
                  <span className={s.featureText}>Safe &amp; Secure</span>
                </div>

                <div className={`${s.featureItem} ${s.featureBorderPurple}`}>
                  <Ribbon className={s.featureIcon} />
                  <span className={s.featureText}>500+ Doctors</span>
                </div>
              </div>

              <div className={s.ctaButtonsContainer}>
                <button 
                  onClick={() => router.push('/doctors')}
                  className={s.bookButton}
                >
                  <div className={s.bookButtonOverlay}></div>
                  <div className={s.bookButtonContent}>
                    <Calendar className={s.bookButtonIcon} />
                    <span>Book Appointment Now</span>
                  </div>
                </button>

                <button
                  onClick={() => (window.location.href = "tel:+2348117862013")}
                  className={s.emergencyButton}
                >
                  <div className={s.emergencyButtonContent}>
                    <Phone className={s.emergencyButtonIcon} />
                    <span>Emergency Call</span>
                  </div>
                </button>
              </div>
            </div>

            <div className={s.rightImageSection}>
              <div className={s.imageContainer}>
                <div className={s.imageFrame}>
                  <Image src={banner} alt="banner" className={s.image} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Banner;
