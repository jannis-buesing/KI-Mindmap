import React, { useState } from "react";

export default function Overlay({ type, onClose, nodes, mindmapData }) {
  
  const [schließenIsHovered, setSchließenIsHovered] = useState(false);

  // Wenn kein Typ gesetzt ist (null), rendern wir nichts
  if (!type) return null;

  // --- HIER LIEGT JETZT DIE LOGIK ---
  const handleCopyFullTree = () => {
    const jsonString = JSON.stringify(mindmapData, null, 2);
    navigator.clipboard.writeText(jsonString).then(() => {
      alert("Komplette Mindmap kopiert!");
      onClose();
    });
  };

  const handleCopyJustNodes = () => {
    const nodeNames = nodes
      .map((node) => node.data?.label || node.label)
      .filter(Boolean)
      .join(", ");

    navigator.clipboard.writeText(nodeNames).then(() => {
      alert("Knotennamen kopiert!");
      onClose();
    });
  };

  // 1. Prüfen, ob 6 oder mehr Knoten existieren
  const hasMoreThanFive = (nodes || []).length >= 6;

  // 2. Linke Seite: Echte Labels holen (maximal 5)
  const liveLabels = nodes?.map((node) => node.data?.label || node.label).filter(Boolean).slice(0, 5) || [];
  const previewNodes = [...liveLabels];

  // Wenn es 6+ Knoten sind, einfach das "..." als letzten Eintrag in das Vorschau-Array pushen
  if (hasMoreThanFive) {
    previewNodes.push("...");
  }

  const mapName = mindmapData?.name || "Unbenannte Mindmap";

  // 3. Rechte Seite: Maximal 5 echte Knoten für das JSON-Array mappen
  const jsonNodesPreview = (nodes || []).slice(0, 5).map((realNode, i) => {
    const label = realNode.data?.label || realNode.label || `Knoten ${i + 1}`;
    const nodeObj = { label };

    const color = realNode.data?.borderColor || realNode.borderColor;
    const status = realNode.data?.status || realNode.status;
    const id = realNode.id;

    if (color) {
      nodeObj.borderColor = color;
    } else if (status) {
      nodeObj.status = status;
    } else if (id) {
      nodeObj.id = id;
    }

    return nodeObj;
  });

  // Wenn es 6+ Knoten sind, schmuggeln wir ein geheimes Platzhalter-Objekt ans Ende des Arrays
  if (hasMoreThanFive) {
    jsonNodesPreview.push({ "___LIVEDATA_ELLIPSIS___": true });
  }

  // Das Objekt in einen formatierten String umwandeln
  let jsonPreviewString = JSON.stringify(
    {
      name: mapName,
      nodes: jsonNodesPreview,
    },
    null,
    2,
  );

  // Wenn es 6+ Knoten sind, ersetzen wir das hässliche Platzhalter-Objekt durch dein schönes { ... }
  if (hasMoreThanFive) {
    jsonPreviewString = jsonPreviewString.replace(
      /\{\s*"___LIVEDATA_ELLIPSIS___":\s*true\s*\}/,
      "{ ... }"
    );
  }

  // --- DIE WEICHE FÜR DIE INHALTE ---
  let title = "";
  let content = null;

  switch (type) {
    // ===================================== COPY ===========================================
    case "copy":
      title = "Mindmap exportieren";
      content = (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            marginTop: "20px",
            maxWidth: "600px",
            width: "100%",
          }}
        >
          {/* Links: Nur Knotennamen (Live) */}
          <button onClick={handleCopyJustNodes} className="elegant-card">
            <div className="preview-box">
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px",
                  justifyContent: "center",
                  padding: "10px",
                }}
              >
                {previewNodes.map((txt, i) => (
                  <span
                    key={i}
                    style={{
                      background: "var(--border)",
                      color: "var(--text-h)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "500",
                    }}
                  >
                    {txt}
                    {i < previewNodes.length - 1 && txt !== '...' ? ',' : ''}
                  </span>
                ))}
              </div>
            </div>
            <div className="card-content">
              <h4 className="card-title">Nur Knotennamen</h4>
              <p className="card-desc">
                Kopiert eine reine, kommagetrennte Textliste aller Knoten.
              </p>
            </div>
          </button>

          {/* Rechts: Komplette Struktur (Live JSON mit Name) */}
          <button onClick={handleCopyFullTree} className="elegant-card">
            <div className="preview-box">
              {" "}
              {/* Leicht erhöht für 5 Zeilen */}
              <pre
                style={{
                  margin: 0,
                  fontSize: "11px",
                  color: "var(--text)",
                  opacity: 0.7,
                  textAlign: "left",
                  fontFamily: "monospace",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  overflowY: "auto",
                  maxHeight: "100%",
                  width: "100%",
                }}
              >
                {jsonPreviewString}
              </pre>
            </div>
            <div className="card-content">
              <h4 className="card-title">Komplette Struktur</h4>
              <p className="card-desc">
                Sichert zusätzlich Positionen, Farben, Verknüpfungen...
                (JSON-Format).
              </p>
            </div>
          </button>
        </div>
      );
      break;

    // ===================================== GEMINI API-KEY TUTORIAL ===========================================
    case "settings":
      title = "Einstellungen";
      content = (
        <div style={{ marginTop: "16px", textAlign: "left" }}>
          <p style={{ color: "var(--text)" }}>
            Hier können später deine App-Einstellungen stehen.
          </p>
        </div>
      );
      break;

    default:
      return null;
  }

  // ============================================= DAS GEMEINSAME GRUNDGERÜST ===========================================
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 9999,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--bg, #ffffff)",
          border: "1px solid var(--border)",
          padding: "24px",
          borderRadius: "12px",
          boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
          color: "var(--text-h)",
          minWidth: "300px",
          textAlign: "center",
        }}
      >
        {title && <h3 style={{ margin: "0 0 12px 0" }}>{title}</h3>}

        {content}

        <button
          onClick={onClose}
          onMouseEnter={() => setSchließenIsHovered(true)}
          onMouseLeave={() => setSchließenIsHovered(false)}
          style={{
            marginTop: "24px",
            padding: "8px 16px",
            cursor: "pointer",
            borderRadius: "6px",
            border: 'none',
            background: 'transparent',
            color: schließenIsHovered ? 'var(--text-h)' : 'var(--text)',
          }}
        >
          Schließen
        </button>
      </div>
    </div>
  );
}
