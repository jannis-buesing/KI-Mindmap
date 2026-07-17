import { useState, useEffect, useRef, useMemo } from "react";

export function SidebarRight({
  selectedNodeIds = [],
  onUpdateNodes,
}) {
  const isOpen = selectedNodeIds.length > 0;
  const [isHovered, setIsHovered] = useState(false);

  // Zustand, um die Details des ersten ausgewählten Knotens zu speichern
  // Dies hilft, übermässige Re-Renders zu vermeiden, wenn sich nur die Referenz von selectedNodes ändert.
  const [firstNodeData, setFirstNodeData] = useState(null);

  // Ref für alle Knoten, um bei Bedarf auf aktuelle Daten zugreifen zu können
  const allNodesRef = useRef(new Map());

  // Abonnieren von Updates der React Flow Nodes, um die Sidebars aktuell zu halten
  useEffect(() => {
    const handleUpdateNodesData = (e) => {
      const { nodeIds, field, value } = e.detail;
      const updatedMap = new Map(allNodesRef.current);

      nodeIds.forEach(id => {
        const currentNode = updatedMap.get(id) || { id, data: {}, style: {} };
        let newData = { ...currentNode.data };
        let newStyle = { ...currentNode.style };

        if (field === 'label') {
          newData.label = value;
        } else if (field === 'borderColor') {
          newStyle.borderColor = value;
        }
        updatedMap.set(id, { ...currentNode, data: newData, style: newStyle });
      });
      allNodesRef.current = updatedMap;

      // Wenn der erste ausgewählte Knoten aktualisiert wurde, aktualisiere firstNodeData
      if (selectedNodeIds.length > 0 && nodeIds.includes(selectedNodeIds[0])) {
        setFirstNodeData(updatedMap.get(selectedNodeIds[0]));
      }
    };

    // Initial alle Nodes aus React Flow abfragen (falls bereits vorhanden)
    const initialNodesEvent = new CustomEvent('reactflow-get-all-nodes');
    window.dispatchEvent(initialNodesEvent);

    const handleAllNodes = (e) => {
      allNodesRef.current = new Map(e.detail.nodes.map(node => [node.id, node]));
      if (selectedNodeIds.length > 0) {
        setFirstNodeData(allNodesRef.current.get(selectedNodeIds[0]));
      }
    };

    window.addEventListener('reactflow-nodes-data-update', handleUpdateNodesData);
    window.addEventListener('reactflow-all-nodes-init', handleAllNodes);
    
    // Cleanup
    return () => {
      window.removeEventListener('reactflow-nodes-data-update', handleUpdateNodesData);
      window.removeEventListener('reactflow-all-nodes-init', handleAllNodes);
    };
  }, [selectedNodeIds]);

  // Wenn sich selectedNodeIds ändert, den firstNodeData aktualisieren
  useEffect(() => {
    if (selectedNodeIds.length > 0) {
      setFirstNodeData(allNodesRef.current.get(selectedNodeIds[0]));
    } else {
      setFirstNodeData(null);
    }
  }, [selectedNodeIds]);

  // Helferfunktion, um die Farbe eines Knotens zu bestimmen
  const getNodeColor = (node) => {
    if (!node?.style) return "var(--default-node-border)";
    if (node.style.borderColor) return node.style.borderColor;
    // Fallback, falls border-color nicht explizit gesetzt ist, aber ein border vorhanden ist
    if (node.style.border && typeof node.style.border === 'string' && node.style.border.includes("solid")) {
      const parts = node.style.border.split("solid ");
      if (parts[1]) return parts[1].trim();
    }
    return "var(--default-node-border)";
  };

  // Aktuelle Daten für den ersten Knoten
  const firstNode = firstNodeData;

  // Color ////////////////////
  const realNodeColor = firstNode ? getNodeColor(firstNode) : "var(--default-node-border)";

  const [currentColor, setCurrentColor] = useState("");

  const allShareSameColor = useMemo(() => {
    if (selectedNodeIds.length === 0) return true;
    const firstColor = firstNode ? getNodeColor(firstNode) : "var(--default-node-border)";
    return selectedNodeIds.every(id => {
      const node = allNodesRef.current.get(id);
      return getNodeColor(node) === firstColor;
    });
  }, [selectedNodeIds, firstNodeData]);

  useEffect(() => {
    if (!isOpen || selectedNodeIds.length === 0) {
      setCurrentColor("");
      return;
    }
    setCurrentColor(allShareSameColor ? realNodeColor : "");
  }, [selectedNodeIds, allShareSameColor, realNodeColor, isOpen]);

 // Label //////////////////////
  const [localLabel, setLocalLabel] = useState("");

  const allShareSameLabel = useMemo(() => {
    if (selectedNodeIds.length === 0) return true;
    const firstLabel = firstNode?.data?.label || "";
    return selectedNodeIds.every(id => {
      const node = allNodesRef.current.get(id);
      return (node?.data?.label || "") === firstLabel;
    });
  }, [selectedNodeIds, firstNodeData]);

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
        {/* <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
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
        </div> */}

        {/* Farben */}
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
            padding: '6px',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            boxSizing: 'border-box'
          }}>
            <div style={{ 
              display: 'grid', 
              gridTemplateColumns: 'repeat(4, 1fr)', 
              gap: '6px', 
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
        {/* <div
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
        </div> */}
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
