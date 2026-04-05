import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import api from "../api/client.js";
import AttendanceOtpForm from "./AttendanceOtpForm.jsx";
import styles from "./MessAttendanceTab.module.css";

const READER_ID = "mess-qr-reader-inline";

export default function MessAttendanceTab() {
  const [cameraOn, setCameraOn] = useState(false);
  const [msg, setMsg] = useState("");
  const [scanErr, setScanErr] = useState("");
  const [scanning, setScanning] = useState(false);
  const qrRef = useRef(null);

  useEffect(() => {
    if (!cameraOn) return undefined;

    let cancelled = false;
    const run = async () => {
      try {
        const dom = document.getElementById(READER_ID);
        if (!dom) return;
        const qr = new Html5Qrcode(READER_ID);
        qrRef.current = qr;
        setScanning(true);
        setScanErr("");
        await qr.start(
          { facingMode: "environment" },
          { fps: 8, qrbox: { width: 240, height: 240 } },
          async (text) => {
            try {
              setScanErr("");
              const { data } = await api.post("/attendance/mark-qr", { raw: text });
              setMsg(
                `Marked present: ${data.student.name} (${data.student.email}) · ${String(data.mealSlot).replace(/_/g, " ")}`
              );
            } catch (e) {
              setScanErr(e.response?.data?.error || e.message || "Scan failed");
            }
          },
          () => {}
        );
      } catch (e) {
        if (!cancelled) {
          setScanErr(
            e?.message ||
              "Camera not available — use OTP on the right or allow browser camera permission."
          );
          setCameraOn(false);
        }
      }
    };
    run();
    return () => {
      cancelled = true;
      const q = qrRef.current;
      if (q) {
        q.stop()
          .then(() => q.clear())
          .catch(() => {});
        qrRef.current = null;
      }
      setScanning(false);
    };
  }, [cameraOn]);

  function stopCamera() {
    const q = qrRef.current;
    if (q) {
      q.stop()
        .then(() => q.clear())
        .catch(() => {});
      qrRef.current = null;
    }
    setScanning(false);
    setScanErr("");
    setCameraOn(false);
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Mark attendance</h2>
      <p className="muted" style={{ fontSize: "0.88rem", marginTop: 0 }}>
        Use <strong>OTP</strong> below (meal + name + code). Optional: start the <strong>camera scanner</strong> only
        when you need to scan a student QR (current meal window only).
      </p>

      <div className={styles.split}>
        <div className={`card ${styles.scanCard}`}>
          <h3 className={styles.subh}>QR scanner (optional)</h3>
          {!cameraOn ? (
            <div className={styles.cameraOff}>
              <p className="muted" style={{ fontSize: "0.85rem", margin: 0 }}>
                Camera stays off until you start it — avoids a blank video box and permission prompts.
              </p>
              <button
                type="button"
                className="btn"
                style={{ marginTop: "0.75rem" }}
                onClick={() => {
                  setScanErr("");
                  setCameraOn(true);
                }}
              >
                Start camera scanner
              </button>
            </div>
          ) : (
            <>
              <div id={READER_ID} className={styles.reader} />
              {!scanning && !scanErr && (
                <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.5rem" }}>
                  Starting camera…
                </p>
              )}
              {scanErr && (
                <p className={styles.err} role="alert" style={{ marginTop: "0.5rem" }}>
                  {scanErr}
                </p>
              )}
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: "0.65rem" }}
                onClick={stopCamera}
              >
                Stop camera
              </button>
            </>
          )}
        </div>
        <div className={`card ${styles.form}`}>
          <AttendanceOtpForm title="OTP verification" />
        </div>
      </div>

      {msg && <p className={styles.ok}>{msg}</p>}
    </div>
  );
}
