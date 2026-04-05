import React, { useEffect, useState } from "react";
import {
  IoMenuOutline,
  IoCloseOutline,
  IoLogOutOutline,
} from "react-icons/io5";
import styles from "./AppShellLayout.module.css";

/**
 * Top bar + slide-out drawer + optional bottom quick nav for Mess / Admin dashboards.
 * Navigation is by string id (local tab state), not routes.
 */
export default function AppShellLayout({
  brand,
  brandKicker = "Dashboard",
  variant = "mess",
  drawerSections,
  bottomItems = [],
  activeId,
  onNavigate,
  onLogout,
  children,
  drawerFooter,
}) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    setMenuOpen(false);
  }, [activeId]);

  useEffect(() => {
    if (!menuOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  function go(id) {
    onNavigate(id);
    setMenuOpen(false);
  }

  const shellClass =
    variant === "admin" ? `${styles.shell} ${styles.shellAdmin}` : `${styles.shell} ${styles.shellMess}`;

  return (
    <div className={shellClass}>
      <header className={styles.topBar}>
        <button
          type="button"
          className={styles.menuBtn}
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-controls="staff-drawer"
          aria-label="Open menu"
        >
          <IoMenuOutline size={26} />
        </button>
        <div className={styles.brandBlock}>
          <span className={styles.brandKicker}>{brandKicker}</span>
          <span className={styles.brand}>{brand}</span>
        </div>
        <button
          type="button"
          className={styles.logoutBtn}
          onClick={onLogout}
          aria-label="Log out"
        >
          <IoLogOutOutline size={22} />
        </button>
      </header>

      {menuOpen && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <aside id="staff-drawer" className={styles.drawer} role="dialog" aria-modal="true">
            <div className={styles.drawerHead}>
              <div>
                <p className={styles.drawerKicker}>Sections</p>
                <p className={styles.drawerTitle}>{brand}</p>
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
            <nav className={styles.drawerNav} aria-label="Dashboard sections">
              {drawerSections.map((section) => (
                <div key={section.title} className={styles.drawerSection}>
                  <p className={styles.sectionLabel}>{section.title}</p>
                  <ul className={styles.drawerList}>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = activeId === item.id;
                      return (
                        <li key={item.id}>
                          <button
                            type="button"
                            className={`${styles.drawerLink} ${isActive ? styles.drawerLinkActive : ""}`}
                            onClick={() => go(item.id)}
                          >
                            <span className={styles.drawerIcon}>
                              <Icon size={22} />
                            </span>
                            <span className={styles.drawerText}>
                              <span className={styles.drawerLabel}>{item.label}</span>
                              <span className={styles.drawerSub}>{item.sub}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
            {drawerFooter && <div className={styles.drawerFooter}>{drawerFooter}</div>}
          </aside>
        </>
      )}

      <main className={styles.main}>{children}</main>

      {bottomItems.length > 0 && (
        <nav className={styles.bottom} aria-label="Quick sections">
          {bottomItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              className={`${styles.navItem} ${activeId === id ? styles.navActive : ""}`}
              onClick={() => go(id)}
            >
              <Icon size={22} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
