import { Link, useNavigate } from "react-router-dom";
import { IoChevronBack } from "react-icons/io5";
import styles from "./BackLink.module.css";

/** Student / in-app: link to a route (default home `/app`). */
export function BackLink({ to = "/app", children = "Back" }) {
  return (
    <Link to={to} className={styles.back}>
      <IoChevronBack className={styles.backIcon} aria-hidden />
      {children}
    </Link>
  );
}

/** Mess / Admin: browser history back (e.g. return to login after navigating from there). */
export function BackNavigate() {
  const navigate = useNavigate();
  return (
    <button type="button" className={styles.back} onClick={() => navigate(-1)}>
      <IoChevronBack className={styles.backIcon} aria-hidden />
      Back
    </button>
  );
}
