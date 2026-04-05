import React, { useId, useRef } from "react";

/**
 * Styled file control: hidden native input + dashed drop-style zone.
 * Pass `file` + `onChange` like a controlled value (File | null).
 */
export default function FilePicker({
  accept,
  file,
  onChange,
  chooseLabel = "Choose file",
  emptySub = "Tap to browse — your device file picker will open",
  hint,
  className = "",
}) {
  const fid = `fp-${useId().replace(/:/g, "")}`;
  const inputRef = useRef(null);

  function clear() {
    onChange(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  return (
    <div className={`filePicker ${className}`.trim()}>
      <input
        ref={inputRef}
        id={fid}
        type="file"
        className="filePickerNative"
        accept={accept}
        onChange={(e) => onChange(e.target.files?.[0] || null)}
      />
      <label htmlFor={fid} className="filePickerZone">
        <span className="filePickerIcon" aria-hidden>
          📎
        </span>
        <span className="filePickerTitle">{file ? file.name : chooseLabel}</span>
        <span className="filePickerSub muted">
          {file ? "Tap the zone to pick a different file" : emptySub}
        </span>
        <span className="filePickerPill">{file ? "Replace" : "Browse"}</span>
      </label>
      {file && (
        <button type="button" className="filePickerClear" onClick={clear}>
          Remove attachment
        </button>
      )}
      {hint && (
        <p className="muted filePickerHint" style={{ fontSize: "0.78rem", margin: "0.4rem 0 0" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
