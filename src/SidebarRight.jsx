import { useState, useEffect, useRef, memo } from "react";
import { RouteOff, Trash2 } from 'lucide-react';

function SidebarRightComponent({
  mindmapData,
  selectedNodeIds = [],
  onUpdateNodes,
  isEdgeSelectMode,
  setIsEdgeSelectMode,
  onDeleteSelected
}) {
  const isOpen = selectedNodeIds.length > 0 && !isEdgeSelectMode;
  const [SBRisHovered, setSBRisHovered] = useState(false);
  // const [verbindungenAuswählenIsHovered, setVerbindungenAuswählenIsHovered] = useState(false);

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

  if (!mindmapData?._currentFileName) return null;

  // =============================================== RETURN ============================================

return (
    <div
      onMouseEnter={() => setSBRisHovered(true)}
      onMouseLeave={() => setSBRisHovered(false)}
      className={`sidebar-right-responsive ${isOpen ? 'is-open' : 'is-closed'}`}
      style={{
        width: isOpen ? "200px" : "20px",
        maxWidth: isOpen ? "200px" : "20px",
        height: "100%",
        position: "relative",
        background: "var(--code-bg)",
        borderLeft: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flex: isOpen ? "1 0 auto" : "0 0 auto",
        padding: isOpen ? "16px" : "0",
        boxSizing: "border-box",
        transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1), height 0.3s cubic-bezier(0.25, 1, 0.5, 1), padding 0.3s ease",
        overflow: "hidden",
      }}
    >
      <div
        className="sbr-content-wrapper" /* KLASSE HINZUGEFÜGT */
        style={{
          opacity: isOpen ? 1 : 0,
          transform: isOpen ? "translateX(0)" : "translateX(10px)",
          transition: "opacity 0.2s ease, transform 0.2s ease",
          display: "flex",
          flexDirection: "column",
          width: "100%",
          pointerEvents: isOpen ? "auto" : "none",
        }}
      >
        {/* TITELBOX: Wird mobil per CSS zu Row + Space-Between */}
        <div
          className="sbr-header-box" /* KLASSE HINZUGEFÜGT */
          style={{
            display: "flex",
            flexDirection: "column",
            width: "100%",
            flexWrap: 'wrap'
          }}
        >
          <h3
            style={{
              fontSize: "16px",
              color: "var(--text-h)",
              fontWeight: 600,
              whiteSpace: "nowrap"
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
              whiteSpace: "nowrap"
            }}
          >
            {selectedNodeIds.length} {"Knoten ausgewählt"}
          </p>
        </div>

        {/* FELD: FARBEN */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0px" }}
        >
          <label
            style={{
              fontSize: "10px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              opacity: 0.8,
              height: '22px'
            }}
          >
            Farbe
          </label>

          <div
            style={{
              width: "100%",
              background: "var(--bg)",
              padding: "4px",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxSizing: "border-box",
            }}
          >
            <div
              className="sbr-colors-grid" /* KLASSE HINZUGEFÜGT */
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, 1fr)",
                gap: "4px",
                width: "100%",
                justifyItems: "center",
                alignItems: 'center'
              }}
            >
              {[
                "var(--default-node-border)",
                "#ff4a4a",
                "#f97316",
                "#f59e0b",
                "#10b981",
                "#3cd5e0",
                "#223ee0",
                "#aa3bff",
              ].map((color) => {
                const isSelected =
                  currentColor !== "" &&
                  currentColor.toLowerCase() === color.toLowerCase();
                const showDefaultTitle = color === "var(--default-node-border)" ? "Standardfarbe" : '';
                return (
                  <button
                    className="sideBarRight_colorButton"
                    key={color}
                    title={showDefaultTitle}
                    onClick={() => onUpdateNodes("borderColor", color)}
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      background: color,
                      border: isSelected ? "2px solid var(--accent)" : "1px solid rgba(0,0,0,0.15)",
                      borderRadius: "5px",
                      cursor: "pointer",
                      transform: isSelected ? "scale(1.05)" : "scale(1)",
                      transition: "transform 0.1s ease, border-color 0.1s ease",
                      boxShadow: isSelected ? "0 0 6px var(--accent)" : "none",
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* BUTTONS: Werden mobil per CSS nebeneinandergelegt */}
        <div
          className="sbr-buttons-wrapper" /* KLASSE HINZUGEFÜGT */
          style={{
            marginTop: '8px',
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            width: "100%"
          }}
        >
          <button
            onClick={() => setIsEdgeSelectMode(!isEdgeSelectMode)}
            style={{
              flex: "1 1 0%",
              minWidth: "0",
              padding: "8px 10px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              
              display: "flex",
              alignItems: "center",
              justifyContent: "center", 

              gap: "0px", 
              
              border: "1px solid",
              borderColor: isEdgeSelectMode ? "var(--edgeDelete)" : "var(--border)",
              color: isEdgeSelectMode ? "var(--edgeDelete)" : "var(--text)",
              backgroundColor: isEdgeSelectMode ? "color-mix(in srgb, var(--edgeDelete) 10%, transparent)" : "transparent",
              whiteSpace: "nowrap"
            }}
          >
            <span style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0, 
              minWidth: "20px"
            }}>
              <RouteOff color="var(--edgeDelete)" size={14} />
            </span>
            <span 
              className="span_sbr_verbindungen_löschen"
            >
              Verbindungen
            </span>
          </button>

          <button
            onClick={onDeleteSelected}
            style={{
              flex: "1 1 0%",
              minWidth: "0",
              padding: "8px 10px",
              borderRadius: "8px",
              fontWeight: "600",
              fontSize: "12px",
              cursor: "pointer",
              
              display: "flex",
              alignItems: "center",
              justifyContent: "center", 

              gap: "0px", 
              
              border: "1px solid",
              borderColor: isEdgeSelectMode ? "var(--edgeDelete)" : "var(--border)",
              color: isEdgeSelectMode ? "var(--edgeDelete)" : "var(--text)",
              backgroundColor: isEdgeSelectMode ? "color-mix(in srgb, var(--edgeDelete) 10%, transparent)" : "transparent",
              whiteSpace: "nowrap"
            }}
          >
            <span style={{ 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center",
              flexShrink: 0, 
              minWidth: "20px"
            }}>
              <Trash2 color="var(--edgeDelete)" size={14} />
            </span>
            <span 
              className="span_sbr_verbindungen_löschen"
            >
              {selectedNodeIds.length} {"Knoten löschen"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export const SidebarRight = memo(SidebarRightComponent);