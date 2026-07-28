import React, { useState } from "react";

export default function Overlay({ type, onClose, nodes, mindmapData }) {
  
  const [schließenIsHovered, setSchließenIsHovered] = useState(false);

  if (!type) return null;

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

  const hasMoreThanFive = (nodes || []).length >= 6;
  const liveLabels = nodes?.map((node) => node.data?.label || node.label).filter(Boolean).slice(0, 5) || [];
  const previewNodes = [...liveLabels];

  if (hasMoreThanFive) {
    previewNodes.push("...");
  }

  const mapName = mindmapData?._currentFileName || "Unbenannte Mindmap";

  const jsonNodesPreview = (nodes || []).slice(0, 5).map((realNode, i) => {
    const rawLabel = realNode.data?.label || realNode.label || `Knoten ${i + 1}`;
    const singleLineLabel = rawLabel.replace(/[\r\n]+/g, ' ').trim();
    const maxChars = 20;
    const truncatedLabel = singleLineLabel.length > maxChars 
      ? singleLineLabel.slice(0, maxChars) + '...' 
      : singleLineLabel;

    const nodeObj = { label: truncatedLabel };
    const color = realNode.data?.borderColor || realNode.borderColor;
    const status = realNode.data?.status || realNode.status;
    const id = realNode.id;

    if (color) { nodeObj.borderColor = color; } 
    else if (status) { nodeObj.status = status; } 
    else if (id) { nodeObj.id = id; }

    return nodeObj;
  });

  if (hasMoreThanFive) {
    jsonNodesPreview.push({ "___LIVEDATA_ELLIPSIS___": true });
  }

  let jsonPreviewString = JSON.stringify(
    { _currentFileName: mapName, nodes: jsonNodesPreview },
    null,
    2
  );

  if (hasMoreThanFive) {
    jsonPreviewString = jsonPreviewString.replace(
      /\{\s*"___LIVEDATA_ELLIPSIS___":\s*true\s*\}/,
      "{ ... }"
    );
  }

  let title = "";
  let content = null;

  switch (type) {
    case "copy":
      title = "Mindmap exportieren";
      content = (
        <div
          className="copy-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: "20px",
            marginTop: "20px",
            width: "100%",
          }}
        >
          {/* Links: Nur Knotennamen */}
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

          {/* Rechts: Komplette Struktur */}
          <button onClick={handleCopyFullTree} className="elegant-card">
            <div className="preview-box">
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
                Sichert zusätzlich Positionen, Farben, Verknüpfungen... (JSON-Format).
              </p>
            </div>
          </button>
        </div>
      );
      break;

    case "apiKeyTutorial":
      title = "API-Schlüssel erstellen";
      content = (
        <div style={{ marginTop: "16px", textAlign: "left", width: "100%" }}>
          <p style={{ color: "var(--text-h)", marginBottom: "16px", fontSize: "13px", opacity: 0.8, textAlign: 'center' }}>
            Folge dieser Kurzanleitung, um deinen kostenlosen Gemini API-Key zu generieren:
          </p>

          {/* Das Flex wurde durch ein echtes CSS-Grid ausgetauscht */}
          <div
            className="tutorial-grid"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              width: "100%",
            }}
          >
            {/* Linke Spalte: Schritt 1 & 3 */}
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              <div className="elegant-card" style={{ cursor: "default" }}>
                <div className="preview-box" style={{ height: "40px", justifyContent: "flex-start", padding: "12px" }}>
                  <span style={{ background: "var(--border)", color: "var(--text-h)", padding: "0px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: "600" }}>
                    Schritt 1
                  </span>
                </div>
                <div className="card-content">
                  <h4 className="card-title">Google AI Studio öffnen</h4>
                  <p className="card-desc">
                    Gehe auf die Website <a href="https://aistudio.google.com" target="_blank" rel="noreferrer" style={{ color: "var(--accent)", textDecoration: "underline" }}>aistudio.google.com</a> und melde dich an.
                  </p>
                </div>
              </div>

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

            {/* Rechte Spalte: Schritt 2 & 4 mit neuer CSS-Klasse */}
            <div className="tutorial-right-column" style={{ display: "flex", flexDirection: "column", gap: "20px", marginTop: "48px" }}>
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
        padding: "16px", /* Verhindert, dass das Modal am Bildschirmrand klebt */
        boxSizing: "border-box"
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
          width: "100%",
          maxWidth: "640px", /* Begrenzt die maximale Breite im Desktop-Modus */
          maxHeight: "90vh", /* Verhindert, dass das Modal größer als der Viewport wird */
          overflowY: "auto", /* Erlaubt vertikales Scrollen auf kleinen Displays */
          textAlign: "center",
          boxSizing: "border-box"
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