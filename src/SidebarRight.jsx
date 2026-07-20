import { useState, useEffect, useRef, memo } from "react";
import { RouteOff } from 'lucide-react';

function SidebarRightComponent({
  selectedNodeIds = [],
  onUpdateNodes,
  isEdgeSelectMode,
  setIsEdgeSelectMode,
}) {
  const isOpen = selectedNodeIds.length > 0 && !isEdgeSelectMode;
  const [SBRisHovered, setSBRisHovered] = useState(false);
  const [verbindungenAuswählenIsHovered, setVerbindungenAuswählenIsHovered] = useState(false);

  const [nodesVersion, setNodesVersion] = useState(0);

  const allNodesRef = useRef(new Map());

  const selectedNodeIdsRef = useRef(selectedNodeIds);
  useEffect(() => {
    selectedNodeIdsRef.current = selectedNodeIds;
  }, [selectedNodeIds]);

  useEffect(() => {
    const handleUpdateNodesData = (e) => {
      const { nodeIds, field, value } = e.detail;
      const updatedMap = new Map(allNodesRef.current);
      let isRelevantChange = false;

      nodeIds.forEach((id) => {
        const currentNode = updatedMap.get(id) || { id, data: {}, style: {} };
        let newData = { ...currentNode.data };
        let newStyle = { ...currentNode.style };

        if (field === "label") {
          newData.label = value;
        } else if (field === "borderColor") {
          newData.borderColor = value;
          newStyle.borderColor = value;
        }
        updatedMap.set(id, { ...currentNode, data: newData, style: newStyle });

        // Nutze die Ref statt der State-Variable
        if (selectedNodeIdsRef.current.includes(id)) {
          isRelevantChange = true;
        }
      });
      allNodesRef.current = updatedMap;

      if (isRelevantChange) {
        setNodesVersion((v) => v + 1);
      }
    };

    const initialNodesEvent = new CustomEvent("reactflow-get-all-nodes");
    window.dispatchEvent(initialNodesEvent);

    const handleAllNodes = (e) => {
      allNodesRef.current = new Map(
        e.detail.nodes.map((node) => [node.id, node]),
      );
      setNodesVersion((v) => v + 1);
    };

    window.addEventListener("reactflow-update-nodes-data", handleUpdateNodesData);
    window.addEventListener("reactflow-all-nodes-init", handleAllNodes);

    return () => {
      window.removeEventListener("reactflow-update-nodes-data", handleUpdateNodesData);
      window.removeEventListener("reactflow-all-nodes-init", handleAllNodes);
    };
  }, []);

  // Helferfunktion, um die Farbe eines Knotens zu bestimmen
  const getNodeColor = (node) => {
    if (node?.style?.borderColor) return node.style.borderColor;
    if (node?.data?.borderColor) return node.data.borderColor;
    return "var(--default-node-border)";
  };

  const firstNode = selectedNodeIds.length > 0 ? allNodesRef.current?.get(selectedNodeIds[0]) : null;

  const [currentColor, setCurrentColor] = useState("");
  const [localLabel, setLocalLabel] = useState("");

  // Der optimierte, abbrechbare Sync-Effekt für Farbe und Text
  useEffect(() => {
    if (!isOpen || selectedNodeIds.length === 0) {
      setCurrentColor("");
      setLocalLabel("");
      return;
    }

    const firstNodeFromRef = allNodesRef.current?.get(selectedNodeIds[0]);
    if (!firstNodeFromRef) return;

    const firstLabel = firstNodeFromRef?.data?.label || "";
    const firstColor = getNodeColor(firstNodeFromRef);

    let shareColor = true;
    let shareLabel = true;

    for (let i = 1; i < selectedNodeIds.length; i++) {
      const node = allNodesRef.current?.get(selectedNodeIds[i]);
      
      if (shareLabel && (node?.data?.label || "") !== firstLabel) {
        shareLabel = false;
      }
      if (shareColor && getNodeColor(node) !== firstColor) {
        shareColor = false;
      }

      // Performance-Booster: Sobald feststeht, dass nichts matcht -> Schleife sofort abbrechen!
      if (!shareColor && !shareLabel) break;
    }

    setCurrentColor(shareColor ? firstColor : "");
    setLocalLabel(shareLabel ? firstLabel : "");
  }, [selectedNodeIds, isOpen, nodesVersion]); // nodesVersion sorgt für Live-Updates bei Events

  // Hotkey-Fokus-Handler
  useEffect(() => {
    if (!isOpen) return;

    const handleGlobalKeyDown = (e) => {
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
      if (e.ctrlKey || e.altKey || e.metaKey || e.key.length > 1) return;

      const inputEl = document.getElementById("sidebarRight_Input");
      if (inputEl) {
        inputEl.focus();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [isOpen]);

  // =============================================== RETURN ============================================

  return (
    <div
      onMouseEnter={() => setSBRisHovered(true)}
      onMouseLeave={() => setSBRisHovered(false)}
      style={{
        width: isOpen ? "200px" : "20px",
        maxWidth: isOpen ? "200px" : "20px",
        background: "var(--code-bg)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flex: "1 0 auto",
        padding: isOpen ? "16px" : "0",
        boxSizing: "border-box",
        transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1), padding 0.3s ease",
        position: "relative",
        overflow: "hidden",
      }}
    >
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

        {/* EIGENSCHAFT: NAME / LABEL (Auskommentiert, aber voll funktionstüchtig verknüpft) */}
        {/* <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <label style={{ fontSize: "12px", textTransform: "uppercase", letterSpacing: "0.04em", opacity: 0.8 }}>
            Titel
          </label>
          <input
            id="sidebarRight_Input"
            type="text"
            value={localLabel}
            placeholder={localLabel ? "Knotenname eingeben..." : "— Mehrere Werte —"}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent)";
              e.target.select();
            }}
            onChange={(e) => {
              setLocalLabel(e.target.value);
              if (selectedNodeIds.length === 1) {
                const liveEvent = new CustomEvent("reactflow-live-label", {
                  detail: { nodeIds: [selectedNodeIds[0]], field: "label", value: e.target.value },
                });
                window.dispatchEvent(liveEvent);
              }
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border)";
              onUpdateNodes("label", localLabel);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
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
        </div> */}

        {/* FELD: FARBEN */}
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

          <div
            style={{
              width: "100%",
              background: "var(--bg)",
              padding: "6px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "6px",
                width: "100%",
                justifyItems: "stretch",
              }}
              >
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
                  currentColor !== "" &&
                  currentColor.toLowerCase() === color.toLowerCase();
                const showDefaultTitle = color === "var(--default-node-border)" ? "Standardfarbe" : '';
                return (
                  <button
                    className="sideBarRight_colorButton"
                    key={color}
                    // title={color}
                    title={showDefaultTitle}
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

        {/* Button EdgeSelection */}
        <button
          onClick={() => setIsEdgeSelectMode(!isEdgeSelectMode)}
          onMouseEnter={() => setVerbindungenAuswählenIsHovered(true)}
          onMouseLeave={() => setVerbindungenAuswählenIsHovered(false)}
          title="Verbindungen durch Markieren der dazugehörigen Knoten auswählen"
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            border: '1px solid',
            transition: 'background-color 0.2s ease, border-color 0.2s ease, color 0.2s ease',
            borderColor: isEdgeSelectMode ? 'var(--edgeDelete)' : 'var(--border)',
            color: isEdgeSelectMode ? 'var(--edgeDelete)' : 'var(--text)',
            backgroundColor: isEdgeSelectMode
              ? (verbindungenAuswählenIsHovered 
                  ? 'color-mix(in srgb, var(--edgeDelete) 20%, transparent)' 
                  : 'color-mix(in srgb, var(--edgeDelete) 10%, transparent)')
              : (verbindungenAuswählenIsHovered 
                  ? 'color-mix(in srgb, var(--text) 8%, transparent)' 
                  : 'transparent')
          }}
        >
          <RouteOff color="var(--edgeDelete)" />Verbindungen auswählen
        </button>
      </div>

      {/* INDIKATOR WENN GESCHLOSSEN */}
      {!isOpen && (
        <div
          style={{
            position: "absolute",
            top: "20px",
            bottom: "20px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "2px",
            background: SBRisHovered ? "var(--accent)" : "var(--border)",
            borderRadius: "2px",
            opacity: SBRisHovered ? 1 : 0.6,
            transition: "background 0.2s ease, opacity 0.2s ease",
            pointerEvents: "none",
          }}
        />
      )}
    </div>
  );
}

export const SidebarRight = memo(SidebarRightComponent);