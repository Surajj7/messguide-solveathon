import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoRestaurantOutline,
  IoNutritionOutline,
  IoStatsChartOutline,
  IoMoonOutline,
  IoSparklesOutline,
  IoShieldCheckmarkOutline,
  IoArrowForward,
} from "react-icons/io5";
import styles from "./LandingPage.module.css";

function useReveal() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setVisible(true);
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, visible];
}

function RevealSection({ children, className = "" }) {
  const [ref, visible] = useReveal();
  return (
    <div
      ref={ref}
      className={`${styles.reveal} ${visible ? styles.revealVisible : ""} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export default function LandingPage() {
  function scrollToFeatures(e) {
    e.preventDefault();
    document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
  }

  return (
    <div className={styles.root}>
      <div className={styles.bg} aria-hidden>
        <div className={styles.bgGradient} />
        <div className={styles.bgMesh} />
        <div className={`${styles.orb} ${styles.orb1}`} />
        <div className={`${styles.orb} ${styles.orb2}`} />
        <div className={`${styles.orb} ${styles.orb3}`} />
      </div>

      <header className={styles.nav}>
        <a href="/" className={styles.navBrand}>
          <span className={styles.navLogo} aria-hidden>
            <IoNutritionOutline size={22} />
          </span>
          NutriGuide
        </a>
        <div className={styles.navActions}>
          <a href="#features" className={styles.navGhost} onClick={scrollToFeatures}>
            Features
          </a>
          <Link to="/login" className={styles.navCta}>
            Sign In
          </Link>
        </div>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>
            <span className={styles.eyebrowDot} />
            Smart campus dining
          </p>
          <h1 className={styles.headline}>
            Your mess menu,{" "}
            <span className={styles.headlineAccent}>nutrition intelligence</span>, one app.
          </h1>
          <p className={styles.sub}>
            Plan meals with clarity, track calories with ease, and give feedback that actually reaches
            the mess desk — built for students, operators, and admins.
          </p>
          <div className={styles.heroCtas}>
            <Link to="/login" className={styles.btnPrimary}>
              Sign In <IoArrowForward size={18} />
            </Link>
            <a href="#features" className={styles.btnSecondary} onClick={scrollToFeatures}>
              Explore features
            </a>
          </div>
        </div>

        <div className={styles.heroVisual}>
          <div className={styles.mockFrame}>
            <div className={`${styles.floatCard} ${styles.fc1}`}>
              420 kcal
              <span>Balanced lunch</span>
            </div>
            <div className={`${styles.floatCard} ${styles.fc2}`}>
              High protein
              <span>Today&apos;s pick</span>
            </div>
            <div className={styles.mockInner}>
              <div className={styles.mockBar}>
                <span className={styles.mockDot} />
                <span className={styles.mockDot} />
                <span className={styles.mockDot} />
              </div>
              <div className={styles.mockBody}>
                <div className={styles.mockRow}>
                  <span className={styles.mockLabel}>Masala dosa</span>
                  <span className={styles.mockMeta}>312 kcal</span>
                </div>
                <div className={styles.mockRow}>
                  <span className={styles.mockLabel}>Grilled paneer bowl</span>
                  <span className={styles.mockMeta}>High protein</span>
                </div>
                <div className={styles.mockRow}>
                  <span className={styles.mockLabel}>Night mess · Noodles</span>
                  <span className={styles.mockMeta}>₹80</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className={styles.section}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>Everything you need at the mess</h2>
          <p className={styles.sectionLead}>
            One platform for daily menus, macros, feedback, and operations — designed for speed and
            clarity.
          </p>
          <div className={styles.featureGrid}>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoRestaurantOutline />
              </div>
              <h3 className={styles.featureTitle}>Live menu &amp; meals</h3>
              <p className={styles.featureDesc}>
                Breakfast through dinner, with calories and macros visible before you queue.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoNutritionOutline />
              </div>
              <h3 className={styles.featureTitle}>Nutrition awareness</h3>
              <p className={styles.featureDesc}>
                Understand plates at a glance — protein, carbs, fats, and tags like veg or
                high-protein.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoStatsChartOutline />
              </div>
              <h3 className={styles.featureTitle}>Calorie tracking</h3>
              <p className={styles.featureDesc}>
                Log what you eat and stay aligned with your health goals over time.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoMoonOutline />
              </div>
              <h3 className={styles.featureTitle}>Night mess &amp; more</h3>
              <p className={styles.featureDesc}>
                Late-night options, crowd updates, and a channel for ideas that shape the next menu.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoSparklesOutline />
              </div>
              <h3 className={styles.featureTitle}>AI meal assistant</h3>
              <p className={styles.featureDesc}>
                Ask practical questions about choices on campus — quick, friendly guidance.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IoShieldCheckmarkOutline />
              </div>
              <h3 className={styles.featureTitle}>Roles that fit reality</h3>
              <p className={styles.featureDesc}>
                Tailored dashboards for students, mess in-charge, and admin — same data, right lens.
              </p>
            </article>
          </div>
        </RevealSection>
      </section>

      <section className={styles.section}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>Trusted flow, real impact</h2>
          <p className={styles.sectionLead}>Built for demos, hackathons, and production-minded teams.</p>
          <div className={styles.stats}>
            <div className={styles.statCard}>
              <div className={styles.statValue}>3</div>
              <div className={styles.statLabel}>Role dashboards</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>24/7</div>
              <div className={styles.statLabel}>Menu clarity</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>360°</div>
              <div className={styles.statLabel}>Nutrition view</div>
            </div>
            <div className={styles.statCard}>
              <div className={styles.statValue}>1</div>
              <div className={styles.statLabel}>Unified experience</div>
            </div>
          </div>
        </RevealSection>
      </section>

      <section className={styles.section}>
        <RevealSection>
          <h2 className={styles.sectionTitle}>Why NutriGuide</h2>
          <p className={styles.sectionLead}>
            Less guesswork at the counter. More signal for the kitchen. Happier campuses.
          </p>
          <div className={styles.whyGrid}>
            <div className={styles.whyCard}>
              <ul className={styles.whyList}>
                <li>Students see what&apos;s cooking — macros, tags, and meal slots in one scroll.</li>
                <li>Feedback and complaints route with context so issues get resolved faster.</li>
                <li>Calories and community features keep engagement high without clutter.</li>
              </ul>
            </div>
            <div className={styles.whyCard}>
              <ul className={styles.whyList}>
                <li>Mess teams manage menus, night stock, and waste signals from one desk.</li>
                <li>Admins get overview, PDFs, and moderation tools for a calmer operation.</li>
                <li>Designed mobile-first — the line moves; your UI should too.</li>
              </ul>
            </div>
          </div>
          <div className={styles.ctaBand}>
            <h3>Ready when you are</h3>
            <p>Sign in with your student, mess, or admin portal — same polished experience inside.</p>
            <Link to="/login" className={styles.btnPrimary}>
              Sign In to continue
            </Link>
          </div>
        </RevealSection>
      </section>

      <footer className={styles.footer}>
        <p>
          <strong>NutriGuide</strong> · Smart mess menu &amp; nutrition management
        </p>
        <p style={{ marginTop: "0.35rem" }}>Educational demo · Not medical advice</p>
      </footer>
    </div>
  );
}
