"use client";

import React from "react";
import { footerStyles as s } from "@/app/assets/dummyStyles.js";
import logo from "@/app/assets/logo.png";
import {
  Activity,
  ArrowRight,
  Mail,
  MapPin,
  Phone,
  Send,
  Stethoscope,
} from "lucide-react";
import {
  FaFacebookF,
  FaTwitter,
  FaInstagram,
  FaLinkedinIn,
  FaYoutube,
} from "react-icons/fa";
import Image from "next/image";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  const quickLinks = [
    { name: "Home", href: "/" },
    { name: "Doctors", href: "/doctors" },
    { name: "Services", href: "/services" },
    { name: "Contact", href: "/contact" },
    { name: "Appointments", href: "/appointments" },
  ];

  const services = [
    { name: "Blood Pressure Check", href: "/services" },
    { name: "Blood Sugar Test", href: "/services" },
    { name: "Full Blood Count", href: "/services" },
    { name: "X-Ray Scan", href: "/services" },
    { name: "Urine Test", href: "/services" },
  ];

  const socialLinks = [
    {
      Icon: FaFacebookF,
      color: s.facebookColor,
      name: "Facebook",
      href: "https://www.facebook.com/people/Hexagon-Digital-Services/61567156598660/",
    },
    {
      Icon: FaTwitter,
      color: s.twitterColor,
      name: "Twitter",
      // TODO: replace with your real Twitter/X profile URL
      href: "https://twitter.com/yourhandle",
    },
    {
      Icon: FaInstagram,
      color: s.instagramColor,
      name: "Instagram",
      href: "http://instagram.com/hexagondigitalservices?igsh=MWp2NG1oNTlibWVnZA%3D%3D",
    },
    {
      Icon: FaLinkedinIn,
      color: s.linkedinColor,
      name: "LinkedIn",
      // Verify this slug: "hexagondigtial" may be missing an "i"
      href: "https://www.linkedin.com/company/hexagondigtial-services/",
    },
    {
      Icon: FaYoutube,
      color: s.youtubeColor,
      name: "YouTube",
      href: "https://youtube.com/@hexagondigitalservices?si=lxEFYNCP42t6AoDJ",
    },
  ];

  return (
    <footer className={s.footerContainer}>
      <div className={s.floatingIcon1}>
        <Stethoscope className={s.stethoscopeIcon} />
      </div>

      <div
        className={s.floatingIcon2}
        style={{
          animationDelay: "3s",
        }}
      >
        <Activity className={s.activityIcon} />
      </div>

      <div className={s.mainContent}>
        <div className={s.gridContainer}>
          <div className={s.companySection}>
            <div className={s.logoWrapper}>
              <div className={s.logoImageContainer}>
                <Image
                  src={logo}
                  alt="MediCare logo"
                  className={s.logoImage}
                  width={120}
                  height={120}
                />
              </div>
            </div>

            <div>
              <h2 className={s.companyName}>MediCare</h2>
              <p className={s.companyTagline}>Healthcare Solutions</p>
            </div>
            <p className={s.companyDescription}>
              Your trusted partner in healthcare innovation. We&apos;re
              committed to providing exceptional medical care with cutting edge
              technology and compassionate service.
            </p>

            <div className={s.contactContainer}>
              <div className={s.contactItem}>
                <div className={s.contactIconWrapper}>
                  <Phone className={s.contactIcon} />
                </div>
                <span className={s.contactText}>+2348117862013</span>
              </div>

              <div className={s.contactItem}>
                <div className={s.contactIconWrapper}>
                  <Mail className={s.contactIcon} />
                </div>
                <span className={s.contactText}>blakechima@gmail.com</span>
              </div>

              <div className={s.contactItem}>
                <div className={s.contactIconWrapper}>
                  <MapPin className={s.contactIcon} />
                </div>
                <span className={s.contactText}>Lagos, Nigeria</span>
              </div>
            </div>
          </div>

          <div className={s.linksSection}>
            <h3 className={s.sectionTitle}>Quick Links</h3>
            <ul className={s.linksList}>
              {quickLinks.map((link, index) => (
                <li key={link.name} className={s.linkItem}>
                  <a
                    href={link.href}
                    className={s.quickLink}
                    style={{
                      animationDelay: `${index * 60}ms`,
                    }}
                  >
                    <div className={s.quickLinkIconWrapper}>
                      <ArrowRight className={s.quickLinkIcon} />
                    </div>
                    <span>{link.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className={s.linksSection}>
            <h3 className={s.sectionTitle}>Our Services</h3>
            <ul className={s.linksList}>
              {services.map((service) => (
                <li key={service.name}>
                  <a href={service.href} className={s.serviceLink}>
                    <div className={s.serviceIcon}></div>
                    <span>{service.name}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className={s.newsletterSection}>
            <h3 className={s.newsletterTitle}>Stay Connected</h3>
            <p className={s.newsletterDescription}>
              Subscribe for health tips, medical updates, and wellness insights
              delivered to your inbox.
            </p>

            <div className={s.newsletterForm}>
              <div className={s.mobileNewsletterContainer}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  aria-label="Email address"
                  className={s.emailInput}
                />
                <button type="button" className={s.mobileSubscribeButton}>
                  <Send className={s.mobileButtonIcon} />
                  Subscribe
                </button>
              </div>

              <div className={s.desktopNewsletterContainer}>
                <input
                  type="email"
                  placeholder="Enter your email"
                  aria-label="Email address"
                  className={s.desktopEmailInput}
                />
                <button type="button" className={s.desktopSubscribeButton}>
                  <Send className={s.desktopButtonIcon} />
                  <span className={s.desktopButtonText}>Subscribe</span>
                </button>
              </div>

              <div className={s.socialContainer}>
                {socialLinks.map(({ Icon, color, name, href }, index) => (
                  <a
                    key={name}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={name}
                    className={s.socialLink}
                    style={{ animationDelay: `${index * 120}ms` }}
                  >
                    <div className={s.socialIconBackground} />
                    <Icon className={`${s.socialIcon} ${color}`} />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <p className="mt-8 text-center text-sm opacity-70">
          &copy; {currentYear} MediCare. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
