import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  IoSunnyOutline,
  IoRestaurantOutline,
  IoCafeOutline,
  IoFastFoodOutline,
} from "react-icons/io5";
import { BackLink } from "../../components/BackLink.jsx";
import api from "../../api/client.js";
import styles from "./StudentMenu.module.css";

const MEAL_ICON = {
  BREAKFAST: IoSunnyOutline,
  LUNCH: IoRestaurantOutline,
  SNACKS: IoCafeOutline,
  DINNER: IoFastFoodOutline,
};

const MEAL_ORDER = ["BREAKFAST", "LUNCH", "SNACKS", "DINNER"];

export default function StudentMenu() {
  const [menu, setMenu] = useState(null);
  const date = new Date().toISOString().slice(0, 10);

  useEffect(() => {
    api.get(`/menus/day?date=${date}`).then((r) => setMenu(r.data));
  }, [date]);

  return (
    <div className={`page ${styles.page}`}>
      <BackLink to="/app" />
      <header className={styles.pageHead}>
        <h1>Daily feedback</h1>
        <p className="muted">{date} · filtered by your mess type</p>
      </header>
      {!menu && (
        <div className="emptyState" role="status">
          Loading menu…
        </div>
      )}
      {menu && (
        <p className={styles.sourceLine}>
          <span className="chipNeutral">
            {menu.source === "date_override" ? "Date-specific menu" : "Weekly template"}
          </span>
        </p>
      )}
      {menu && (
        <div className={styles.mealsGrid}>
          {menu.meals
            .filter((m) => m.mealSlot !== "FEAST")
            .sort(
              (a, b) =>
                MEAL_ORDER.indexOf(a.mealSlot) - MEAL_ORDER.indexOf(b.mealSlot)
            )
            .map((m) => {
            const MealIcon = MEAL_ICON[m.mealSlot] || IoRestaurantOutline;
            return (
              <div key={m.mealSlot} className={`card ${styles.mealBlock}`}>
                <div className={styles.mealHead}>
                  <span className={styles.mealIcon} aria-hidden>
                    <MealIcon size={20} />
                  </span>
                  <h2>{m.mealSlot.replace(/_/g, " ")}</h2>
                </div>
                {m.items.map((it) => (
                  <Link
                    key={it.id + m.mealSlot}
                    className={styles.row}
                    to={`/app/item/${it.id}?date=${menu.date}`}
                  >
                    <div className={styles.rowMain}>
                      <div className={styles.nameRow}>
                        <div className={styles.name}>{it.name}</div>
                        {typeof it.isVeg === "boolean" && (
                          <span className={it.isVeg ? "chipVeg" : "chipNonVeg"}>
                            {it.isVeg ? "Veg" : "Non-veg"}
                          </span>
                        )}
                      </div>
                      <div className={styles.macros}>
                        <span>P {it.proteinG}g</span>
                        <span>C {it.carbsG}g</span>
                        <span>F {it.fatsG}g</span>
                      </div>
                      {Array.isArray(it.tags) &&
                        it.tags.map((t) => (
                          <span key={t} className={styles.tag}>
                            {t}
                          </span>
                        ))}
                    </div>
                    <div className={styles.calWrap}>
                      <span className={styles.cal}>{Math.round(it.calories)}</span>
                      <span className={styles.calLabel}>kcal</span>
                    </div>
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
