import React, { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  IoHomeOutline,
  IoCalendarOutline,
  IoRestaurantOutline,
  IoMoonOutline,
  IoPersonOutline,
  IoStatsChartOutline,
  IoMenuOutline,
  IoCloseOutline,
  IoNotificationsOutline,
  IoSparklesOutline,
  IoChatbubblesOutline,
  IoBulbOutline,
  IoBasketOutline,
  IoClipboardOutline,
  IoSwapHorizontal,
  IoQrCodeOutline,
  IoThumbsUpOutline,
} from "react-icons/io5";
import api from "../api/client.js";
import styles from "./StudentLayout.module.css";

const bottomNav = [
  { to: "/app", end: true, label: "Home", icon: IoHomeOutline },
  { to: "/app/menu", label: "Menu", icon: IoRestaurantOutline },
  { to: "/app/calories", label: "Calories", icon: IoStatsChartOutline },
  { to: "/app/profile", label: "Profile", icon: IoPersonOutline },
];

const drawerSections = [
  {
    title: "Explore",
    items: [
      { to: "/app", end: true, label: "Home", sub: "Dashboard & today’s meals", icon: IoHomeOutline },
      { to: "/app/voting", label: "Menu voting", sub: "Vote dishes for next month", icon: IoThumbsUpOutline },
      { to: "/app/menu", label: "Daily feedback", sub: "Rate dishes & menu", icon: IoRestaurantOutline },
      { to: "/app/calendar", label: "Calendar", sub: "Plan ahead", icon: IoCalendarOutline },
      { to: "/app/calories", label: "Calorie tracker", sub: "Log what you eat", icon: IoStatsChartOutline },
      { to: "/app/night", label: "Night mess", sub: "Late-night menu", icon: IoMoonOutline },
      {
        to: "/app/leftovers",
        label: "Leftovers",
        sub: "Surplus logged by mess",
        icon: IoBasketOutline,
      },
      {
        to: "/app/mess-swap",
        label: "Mess / caterer swap",
        sub: "Caterer FCFS & mess upgrade",
        icon: IoSwapHorizontal,
      },
      {
        to: "/app/attendance",
        label: "Attendance",
        sub: "QR, OTP & meal status",
        icon: IoQrCodeOutline,
      },
    ],
  },
  {
    title: "Tools & community",
    items: [
      { to: "/app/ai", label: "AI assistant", sub: "Meal ideas & questions", icon: IoSparklesOutline },
      { to: "/app/community", label: "Community", sub: "Posts & discussion", icon: IoChatbubblesOutline },
      { to: "/app/suggestions", label: "Ideas", sub: "Suggest improvements", icon: IoBulbOutline },
    ],
  },
  {
    title: "You",
    items: [
      {
        to: "/app/notifications",
        label: "Notifications",
        sub: "Alerts & updates",
        icon: IoNotificationsOutline,
      },
      {
        to: "/app/advanced-requests",
        label: "Advanced requests",
        sub: "Delivery & menu change",
        icon: IoClipboardOutline,
      },
      { to: "/app/profile", label: "Profile", sub: "Health goal & settings", icon: IoPersonOutline },
    ],
  },
];

export default function StudentLayout() {
  const loc = useLocation();
  const hideBottom = loc.pathname.startsWith("/app/item");
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifCount, setNotifCount] = useState(0);

  useEffect(() => {
    api
      .get("/notifications")
      .then((r) => setNotifCount(r.data.filter((n) => !n.read).length))
      .catch(() => {});
  }, [loc.pathname]);

  useEffect(() => {
    setMenuOpen(false);
  }, [loc.pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  return (
    <div className={styles.shell}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="student-drawer"
          aria-label="Open menu"
        >
          <IoMenuOutline size={26} />
        </button>
        <span className={styles.brand}>NutriGuide</span>
        <NavLink
          to="/app/notifications"
          className={({ isActive }) => `${styles.notifBtn} ${isActive ? styles.notifActive : ""}`}
          aria-label="Notifications"
        >
          <IoNotificationsOutline size={24} />
          {notifCount > 0 && <span className={styles.badge}>{notifCount > 9 ? "9+" : notifCount}</span>}
        </NavLink>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside id="student-drawer" className={styles.drawer} role="dialog" aria-modal="true">
            <div className={styles.drawerHead}>
              <div>
                <p className={styles.drawerKicker}>Navigate</p>
                <p className={styles.drawerTitle}>Everything in one place</p>
              </div>
              <button
                type="button"
                className={styles.drawerClose}
                onClick={() => setMenuOpen(false)}
                aria-label="Close menu"
              >
                <IoCloseOutline size={28} />
              </button>
            </div>
            <nav className={styles.drawerNav} aria-label="App sections">
              {drawerSections.map((section) => (
                <div key={section.title} className={styles.drawerSection}>
                  <p className={styles.sectionLabel}>{section.title}</p>
                  <ul className={styles.drawerList}>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <li key={item.to + (item.end ? "-home" : "")}>
                          <NavLink
                            to={item.to}
                            end={item.end}
                            className={({ isActive }) =>
                              `${styles.drawerLink} ${isActive ? styles.drawerLinkActive : ""}`
                            }
                            onClick={() => setMenuOpen(false)}
                          >
                            <span className={styles.drawerIcon}>
                              <Icon size={22} />
                            </span>
                            <span className={styles.drawerText}>
                              <span className={styles.drawerLabel}>{item.label}</span>
                              <span className={styles.drawerSub}>{item.sub}</span>
                            </span>
                          </NavLink>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </aside>
        </>
      )}

      <main className={styles.main}>
        <Outlet />
      </main>

      {!hideBottom && (
        <nav className={styles.bottom} aria-label="Quick navigation">
          {bottomNav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.navActive : ""}`
              }
            >
              <Icon size={22} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
