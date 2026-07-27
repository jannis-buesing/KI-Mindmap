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

  const mapName = mindmapData?._currentFileName || "Unbenannte Mindmap";

  const jsonNodesPreview = (nodes || []).slice(0, 5).map((realNode, i) => {
    const rawLabel = realNode.data?.label || realNode.label || `Knoten ${i + 1}`;
    
    // 1. Alle Zeilenumbrüche (\r und \n) durch ein einfaches Leerzeichen ersetzen
    const singleLineLabel = rawLabel.replace(/[\r\n]+/g, ' ').trim();
    
    // 2. Text auf eine saubere Maximallänge begrenzen (z. B. 20 Zeichen)
    const maxChars = 20;
    const truncatedLabel = singleLineLabel.length > maxChars 
      ? singleLineLabel.slice(0, maxChars) + '...' 
      : singleLineLabel;

    // Das bereinigte Label in das Objekt setzen
    const nodeObj = { label: truncatedLabel };

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
      _currentFileName: mapName,
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
                    title={txt}
                    style={{
                      background: "var(--border)",
                      color: "var(--text-h)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: "500",
                      display: "inline-flex",
                      alignItems: "center",
                      maxWidth: "120px",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {txt}
                    </span>
                    
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
    case "apiKeyTutorial":
      title = "API-Schlüssel erstellen";
      content = (
        <div style={{ marginTop: "16px", textAlign: "left", maxWidth: "600px", width: "100%" }}>
          <p style={{ color: "var(--text-h)", marginBottom: "16px", fontSize: "13px", opacity: 0.8, display: 'flex', justifyContent: 'center' }}>
            Folge dieser Kurzanleitung, um deinen kostenlosen Gemini API-Key zu generieren:
          </p>

          <div
            style={{
              display: "flex",
              gap: "16px",
              width: "100%",
            }}
          >
           {/* Linke Spalte: Schritt 1 & 3 */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1 }}>
          {/* Schritt 1 */}
          <div className="elegant-card" style={{ cursor: "default" }}>
            <div className="preview-box" style={{ height: "40px", justifyContent: "flex-start", padding: "12px" }}>
              <span style={{ background: "var(--border)", color: "var(--text-h)", padding: "0px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                Schritt 1
              </span>
            </div>
            <div className="card-content">
              <h4 className="card-title">Google AI Studio öffnen</h4>
              <p className="card-desc">
                  Gehe auf die Website <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>aistudio.google.com</a> und melde dich mit deinem Google-Konto an.
              </p>
            </div>
          </div>

          {/* Schritt 3 */}
          <div className="elegant-card" style={{ cursor: "default" }}>
            <div className="preview-box" style={{ height: "40px", justifyContent: "flex-start", padding: "0 12px" }}>
              <span style={{ background: "var(--border)", color: "var(--text-h)", padding: "0px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                Schritt 3
              </span>
            </div>
            <div className="card-content">
              <h4 className="card-title">Schlüssel generieren</h4>
              <p className="card-desc">
                  Benenne deinen Schlüssel und erstelle ein neues Projekt unter <em>Importiertes Projekt auswählen</em>.
              </p>
            </div>
          </div>
        </div>

        {/* Rechte Spalte: Schritt 2 & 4 (Rutschen durch das marginTop geschlossen nach unten) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", flex: 1, marginTop: "48px" }}>
          {/* Schritt 2 */}
          <div className="elegant-card" style={{ cursor: "default" }}>
            <div className="preview-box" style={{ height: "40px", justifyContent: "flex-start", padding: "0 12px" }}>
              <span style={{ background: "var(--border)", color: "var(--text-h)", padding: "0px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                Schritt 2
              </span>
            </div>
            <div className="card-content">
              <h4 className="card-title">Menü aufrufen</h4>
              <p className="card-desc">
                  Klicke ganz oben rechts in der Ecke auf den Button <strong>"API-Schlüssel erstellen"</strong>.
              </p>
            </div>
          </div>

          {/* Schritt 4 */}
          <div className="elegant-card" style={{ cursor: "default" }}>
            <div className="preview-box" style={{ height: "40px", justifyContent: "flex-start", padding: "0 12px" }}>
              <span style={{ background: "var(--border)", color: "var(--text-h)", padding: "0px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                Schritt 4
              </span>
            </div>
            <div className="card-content">
              <h4 className="card-title">Kopieren &amp; Sichern</h4>
              <p className="card-desc">
                  Kopiere den Schlüssel und füge ihn hier ein.
              </p>
            </div>
          </div>
        </div>
          </div>
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
