import { useState, useEffect } from "react";

export function SidebarRight({
  selectedNodeIds = [],
  selectedNodes = [],
  onUpdateNodes,
}) {
  const isOpen = selectedNodeIds.length > 0;
  const [isHovered, setIsHovered] = useState(false);
  const firstNode = selectedNodes[0];

  const getNodeColor = (node) => {
  if (!node?.style) return "var(--default-node-border)";
  
  if (node.style.borderColor) return node.style.borderColor;
  
  if (node.style.border && node.style.border.includes("solid")) {
    const parts = node.style.border.split("solid ");
    if (parts[1]) return parts[1].trim();
  }
  
  return "var(--default-node-border)";
};

  // Color ////////////////////
  const realNodeColor = getNodeColor(firstNode);

  const [currentColor, setCurrentColor] = useState("");

  const allShareSameColor = selectedNodes.every(
    (n) => getNodeColor(n) === realNodeColor
  );

  useEffect(() => {
    if (!isOpen || selectedNodes.length === 0) {
      setCurrentColor("");
      return;
    }
    
    const nodeColor = getNodeColor(firstNode);
    setCurrentColor(allShareSameColor ? nodeColor : "");
  }, [selectedNodeIds, allShareSameColor, firstNode, isOpen]);

 // Label //////////////////////
  const [localLabel, setLocalLabel] = useState("");

  const allShareSameLabel = selectedNodes.every(
      (n) => n.data?.label === firstNode?.data?.label,
    );

  useEffect(() => {
    setLocalLabel(allShareSameLabel ? firstNode?.data?.label || "" : "");
  }, [selectedNodeIds, allShareSameLabel, firstNode]);

  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      // Ignorieren, wenn der Nutzer bereits in einem Input/Textarea schreibt
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA")
        return;

      // Ignorieren bei Steuerungs-Tasten (Strg, Alt, Meta, Shift einzeln, Escape, Pfeiltasten etc.)
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;

      const inputEl = document.getElementById("sidebarRight_Input");
      if (inputEl) {
        inputEl.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen]);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        width: isOpen ? "300px" : "20px",
        maxWidth: isOpen ? "300px" : "20px",
        background: "var(--code-bg)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flex: "1 0 auto",
        padding: isOpen ? "24px" : "0",
        boxSizing: "border-box",
        transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1), padding 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* INHALT */}
      <div
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateX(0)" : "translateX(10px)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          height: "100%",
          width: "100%",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        <div>
          <h3
            style={{
              margin: "0 0 4px 0",
              fontSize: "16px",
              color: "var(--text-h)",
              fontWeight: 600,
            }}
          >
            Knoten bearbeiten
          </h3>
          <p
            style={{
              fontSize: "12px",
              color: "var(--text)",
              opacity: 0.8,
              margin: "0",
            }}
          >
            {selectedNodeIds.length} {"Knoten ausgewählt"}
          </p>
        </div>

        {/* 1. EIGENSCHAFT: NAME / LABEL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label
            style={{
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.8,
            }}
          >
            Titel
          </label>
          <input
            id="sidebarRight_Input"
            type="text"
            value={localLabel}
            placeholder={
              allShareSameLabel ? "Knotenname eingeben..." : "— Mehrere Werte —"
            }
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
              e.target.select();
            }}
            onChange={(e) => {
              setLocalLabel(e.target.value);
              if (selectedNodeIds.length === 1) {
                const liveEvent = new CustomEvent("reactflow-live-label", {
                  detail: { nodeId: selectedNodeIds[0], value: e.target.value },
                });
                window.dispatchEvent(liveEvent);
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
              onUpdateNodes("label", localLabel);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.target.blur();
              }
            }}
            style={{
              padding: "10px 12px",
              background: "var(--bg)",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              fontSize: "13px",
              color: "var(--text-h)",
              outline: "none",
              fontFamily: "var(--sans)",
              transition: "border-color 0.2s",
            }}
          />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.8,
            }}
          >
            Farbe
          </label>

          {/* Farb-Quadrate für den schnellen Zugriff */}
          <div style={{
            width: '100%',
            background: 'var(--bg)',
            padding: '12px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '8px', 
              width: '100%',
              justifyItems: 'stretch'
            }}>
            {[
              "var(--default-node-border)",
              "#f59e0b", // Gelb
              "#aa3bff", // Lila
              "#ec4899", // Pink
              "#10b981", // Grün
              "#ff4a4a", // Rot
              "#3b82f6", // Blau
              "#f97316", // Orange
            ].map((color) => {
              const isSelected =
                allShareSameColor &&
                currentColor !== "" &&
                currentColor.toLowerCase() === color.toLowerCase();
              return (
                <button
                  className="sideBarRight_colorButton"
                  key={color}
                  title={color}
                  onClick={() => onUpdateNodes("borderColor", color)}
                  style={{
                    width: "100%",
                    aspectRatio: "1",
                    background: color,
                    border: isSelected
                      ? "2px solid var(--accent)"
                      : "1px solid rgba(0,0,0,0.15)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    transform: isSelected ? "scale(1.1)" : "scale(1)",
                    transition: "transform 0.1s ease, border-color 0.1s ease",
                    boxShadow: isSelected ? "0 0 8px var(--accent)" : "none",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>

        {/* REIN INFORMATIVE ID-LISTE IM FUSSBEREICH */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginTop: "auto",
          }}
        >
          <span
            style={{
              fontSize: "12px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.8,
            }}
          >
            Auswahl-IDs
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "4px",
              maxHeight: "80px",
              overflowY: "auto",
            }}
          >
            {selectedNodeIds.map((id) => (
              <code
                key={id}
                style={{
                  padding: "2px 6px",
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "4px",
                  fontSize: "10px",
                  fontFamily: "var(--mono)",
                }}
              >
                {id}
              </code>
            ))}
          </div>
        </div>
      </div>

      {/* MINIMALER IDE-INDIKATOR WENN GESCHLOSSEN */}
      {!isOpen && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "2px",
            background: isHovered ? "var(--accent)" : "var(--border)",
            borderRadius: "2px",
            opacity: isHovered ? 1 : 0.6,
            transition: "background 0.2s ease, opacity 0.2s ease",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}
