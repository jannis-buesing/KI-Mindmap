import { useRef, useState, useEffect } from "react";
import { PanelLeftClose, PanelLeftOpen, Settings, Info, Palette, Moon, Sun, RotateCcw, FolderOpen, MoreVertical, PencilLine, Trash, Plus } from "lucide-react";
import { HexColorPicker } from "react-colorful";

export function SidebarLeft({
  dirName,
  onSelectDir,
  maps,
  currentMap,
  onSelectMap,
  onDeleteMap,
  onRenameMap,
  onCreateMap,
  isSaved,
  hasPermission,
  userApiKey,
  onUserApiKeyChange,
  userPickedAccentColor,
  setUserPickedAccentColor,
  currentMode
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState("");
  const [isOpen, setIsOpen] = useState(true);
  const [activePopup, setActivePopup] = useState(null); // 'info' | 'settings' | null
  const activePopupRef = useRef(null);

  const activeMapObject = maps.find((m) => m.id === currentMap);

  const CurrentMapDate = activeMapObject?.date
    ? new Date(activeMapObject.date).toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      })
    : "--.--.--";

  const handleButtonClick = (type) => {
    setActivePopup(activePopup === type ? null : type);
  };

  useEffect(() => {
    if (activePopup && activePopupRef.current) {
      activePopupRef.current.focus();
    }
  }, [activePopup]);

  const handleColorChange = (newHexColor) => {
    setUserPickedAccentColor(prev => ({
      ...prev,
      [currentMode]: newHexColor
    }));
  };

  return (
    <div
      style={{
        width: isOpen ? "300px" : "60px",
        background: "var(--code-bg)",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        flex: "0 5 auto",
        maxwidth: "25vw",
        minWidth: isOpen ? "225px" : "60px",
        padding: isOpen ? "20px" : "14px",
        boxSizing: "border-box",
        transition: "width 0.3s cubic-bezier(0.25, 1, 0.5, 1)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        {isOpen && <h2>Mindmaps</h2>}

        <button onClick={() => setIsOpen(!isOpen)} className="btn_32pxNormed" title={isOpen ? 'Seitenleiste schließen' : 'Seitenleiste öffnen'} style={{ marginBottom: isOpen ? '0' : '1rem' }}>
          {isOpen ? (
            <PanelLeftClose/>
          ) : (
            <PanelLeftOpen/>
          )}
        </button>
      </div>

      {/* Ordner-Status & Auswahl Start */}
      <div
        style={{
          fontSize: "13px",
          margin: isOpen ? "10px 0 20px" : '10px 0 8px',
          color: "var(--text)",
          gap: '8px'
        }}
      >
        {isOpen && (
          <div>
            <strong>Pfad:</strong>{" "}
            {dirName ? `📁 ${dirName}` : "Kein Ordner gewählt"}
          </div>
        )}

        {/* DYNAMISCHER BUTTON: Wechselt den Text je nach Zustand */}
        { isOpen && (
          <button
            id="btn_ordnerWechselnBig"
            onClick={onSelectDir}
            style={{
              display: "block",
              marginTop: "8px",
              width: "100%",
              height: "auto",
              padding: "8px",
              cursor: "pointer",
              backgroundColor:
                !hasPermission && dirName ? "#eab308" : "transparent", // Gelb warnend, wenn Berechtigung fehlt
              color: !hasPermission && dirName ? "#000" : "var(--text-h)",
              border: "1px solid var(--border)",
              borderRadius: "6px",
              fontWeight: !hasPermission && dirName ? "600" : "normal",
              userSelect: "none",
            }}
          >
            {!dirName
              ? "Lokal-Ordner verbinden"
              : !hasPermission
                ? "🔑 Berechtigung erteilen"
                : "Ordner wechseln"
            }
          </button>
        )}
        { !isOpen && (
          <button
            className="btn_32pxNormed"
          >
            <FolderOpen style={{ width: '19px', height: '19px' }}/>
          </button>
        )}
      </div>
      {/* Ordner-Status & Auswahl Ende */}

      {/* Die restliche Sidebar wird NUR angezeigt, wenn wir den Ordner UND die Erlaubnis haben */}
      {dirName && hasPermission ? (
        <>
          {/* Knopf Neue Mindmap Start */}
          <button
            id="btn_neueMindmap"
            onClick={() => {
              setIsOpen(true);
              onCreateMap();
            }}
            style={{
              backgroundColor: "var(--accent)",
              color: "var(--text-h)",
              border: "none",
              padding: isOpen ? "10px" : '0',
              borderRadius: "6px",
              cursor: "pointer",
              marginBottom: isOpen ? "20px" : '0',
              fontWeight: "600",
              userSelect: "none",
              width: isOpen ? 'auto' : '32px',
              height: isOpen ? 'auto' : '32px',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            {isOpen ? (
              <span>+ Neue Mindmap</span>
            ) : (
              <Plus/>
            )}
          </button>
          {/* Knopf Neue Mindmap Ende */}

          {/* Anzeige: Gespeichert? + Datum Start */}
          {isOpen && (
            <div
              style={{
                marginBottom: "15px",
                fontSize: "14px",
                display: "flex",
                gap: "4px",
              }}
            >
              Status:{" "}
              {isSaved ? (
                <span style={{ color: "green" }}>● Gespeichert</span>
              ) : (
                <span style={{ color: "orange" }}>● Ungespeichert</span>
              )}
              <small
                style={{
                  color: "var(--text-h)",
                  fontWeight: "normal",
                  fontSize: "11px",
                  marginLeft: "auto",
                }}
              >
                ({CurrentMapDate})
              </small>
            </div>
          )}
          {/* Anzeige: Gespeichert? + Datum Ende */}

          {/* Auflistung Maps Start */}
          {isOpen && (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              {maps.map((map) => {
                const isCurrentMap = currentMap === map.id;

                return (
                  <div
                    className="btn_mappedMindmaps"
                    key={map.id}
                    onClick={() => !isCurrentMap && onSelectMap(map.id)}
                    style={{
                      padding: "0 10px",
                      height: "48px",
                      borderRadius: "6px",
                      background: isCurrentMap
                        ? "var(--accent-bg)"
                        : "transparent",
                      border: isCurrentMap
                        ? "1px solid var(--accent-border)"
                        : "1px solid transparent",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxSizing: "border-box",
                    }}
                  >
                    {/* Namen ändern und speichern - Logik */}
                    {editingName === map.id ? (
                      <input
                        value={tempName}
                        onFocus={(e) => e.target.select()}
                        onChange={(e) => setTempName(e.target.value)}
                        onBlur={() => {
                          onRenameMap(map.id, tempName);
                          setEditingName(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.target.blur();
                          }
                        }}
                        autoFocus
                        style={{
                          width: "70%",
                          height: "30px",
                          boxSizing: "border-box",
                        }}
                      />
                    ) : (
                      <span
                        style={{
                          fontWeight: isCurrentMap ? "600" : "normal",
                          color: "var(--text-h)",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          overflow: "hidden",
                          flex: 1,
                          marginRight: "10px",
                        }}
                      >
                        <span
                          style={{
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            flex: 1,
                          }}
                        >
                          {map.name}
                        </span>
                      </span>
                    )}

                    {/* 3-Punkte-Menu */}
                    <div
                      tabIndex={0}
                      onBlur={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget)) {
                          setActiveMenu(null);
                        }
                      }}
                      style={{
                        position: "relative",
                        outline: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "2px",
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={(e) => {
                          setActiveMenu(activeMenu === map.id ? null : map.id);
                          const elternteil = e.currentTarget.parentNode;
                          setTimeout(() => {
                            elternteil.focus();
                          }, 0);
                        }}
                        className="btn_32pxNormed"
                        style={{
                          display:
                            activeMenu === map.id ? "none" : "inline-block",
                        }}
                      >
                        <MoreVertical style={{ width: "18px", height: "18px", color: "var(--text-h)" }} />
                      </button>

                      {activeMenu === map.id && (
                        <button
                          title="Umbenennen"
                          onClick={() => {
                            setEditingName(map.id);
                            setTempName(map.name);
                            setActiveMenu(null);
                          }}
                          className="btn_32pxNormed"
                        >
                          <PencilLine/>
                        </button>
                      )}
                      {activeMenu === map.id && (
                        <button
                          title="Löschen"
                          onClick={() => {
                            onDeleteMap(map.id);
                            setActiveMenu(null);
                          }}
                          className="btn_32pxNormed"
                        >
                          <Trash/>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {/* Auflistung Maps Ende */}
          {/* Einstellungen Start */}
          <div style={{
            position: 'relative',
            display: 'flex',
            flexDirection: isOpen ? 'row' : 'column',
            justifyContent: 'flex-end',
            alignItems: 'center',
            gap: '8px',
            marginTop: 'auto',
            paddingTop: '15px',
            borderTop: isOpen ? '1px solid var(--border)' : 'none'
          }}>
            {activePopup && (
              <div
                className="sbl_popup_window"
                ref={activePopupRef}
                tabIndex={0}
                onBlur={(e) => {
                  if (
                    e.relatedTarget?.id === "btn_sbl_info" || 
                    e.relatedTarget?.id === "btn_sbl_settings" ||
                    e.relatedTarget?.id === "btn_sbl_palette"
                  ) {
                    return; 
                  }
                  if (!e.currentTarget.contains(e.relatedTarget)) {
                    setActivePopup(null);
                  }
                }}
                autoFocus
                style={{
                  position: 'absolute',
                  bottom: isOpen ? 'calc(100% + 10px)' : '0',
                  left: isOpen ? '0' : 'calc(100% + 15px)',
                  width: isOpen ? '100%' : '240px',
                  backgroundColor: 'var(--bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  padding: '14px',
                  boxSizing: 'border-box',
                  zIndex: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  animation: 'popupFadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
                  outline: 'none'
                }}
              >

                {/* Inhalt Personalisierung */}
                {activePopup === 'palette' && (
                  <>
                    <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>Personalisierung</h3>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div style={{ 
                        padding: '12px', 
                        background: 'var(--code-bg)', 
                        border: '1px solid var(--border)', 
                        borderRadius: '8px' 
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <span style={{ display: 'block', fontSize: '13px', fontWeight: '600' }}>
                            Akzentfarbe ändern
                          </span>
                          <button
                            title="Auf Standardfarbe zurücksetzen"
                            className="btn_32pxNormed"
                            onClick={() => {
                              const modeWord = currentMode === 'dark' ? 'dunklen' : 'hellen';
                              const confirmed = window.confirm(`Möchtest du die Akzentfarbe für den ${modeWord} Modus wirklich auf die Standardfarbe zurücksetzen?`);
                              
                              if (confirmed) {
                                const defaultColors = { light: '#aa3bff', dark: '#c084fc' };
                                setUserPickedAccentColor(prev => ({
                                  ...prev,
                                  [currentMode]: defaultColors[currentMode]
                                }));
                              }
                            }}
                          >
                            <RotateCcw/>
                          </button>
                        </div>
                        
                        {/* Der Picker bekommt jetzt nur den String des aktiven Modus */}
                        <HexColorPicker 
                          color={userPickedAccentColor[currentMode]} 
                          onChange={handleColorChange}
                          style={{ width: '100%', height: '140px' }}
                        />

                        {/* Der Status-Button als Modus-Indikator */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '12px' }}>
                          <span style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '120%' }}>
                            Farbe gilt für das aktive Design:
                          </span>
                          <span
                            id="spanIsDarkIndicator"
                            style={{
                              cursor: 'default'
                            }}
                          >
                            {currentMode === 'dark' ? <Moon/> : <Sun/>}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* Inhalt Info */}
                {activePopup === 'info' && (
                  <>
                    <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>Informationen</h3>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <div><strong>Version:</strong> 1.0.0</div>
                      <div><strong>Lokaler Ordner:</strong> {dirName || "Nicht verbunden"}</div>
                    </div>
                  </>
                )}

                {/* Inhalt Settings */}
                {activePopup === 'settings' && (
                  <>
                    <h3 style={{ fontSize: '15px', marginBottom: '4px' }}>Einstellungen</h3>
                    <div style={{ fontSize: '13px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      

                      {/* API-Key Eingabefeld */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '6px' }}>
                        <span style={{ fontWeight: '600', color: 'var(--text-h)' }}>Gemini API-Key:</span>
                        <input 
                          type="password" 
                          placeholder="..." 
                          value={userApiKey}
                          onChange={(e) => onUserApiKeyChange(e.target.value.trim())}
                          style={{
                            padding: '6px 8px',
                            borderRadius: '4px',
                            border: '1px solid var(--border)',
                            background: 'var(--bg)',
                            color: 'var(--text-h)',
                            fontSize: '12px',
                            outline: 'none'
                          }}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            <button
              className="btn_32pxNormed"
              id="btn_sbl_palette"
              onClick={() => handleButtonClick('palette')}
              title="Personalisierung"
              style={{
                color: 'var(--text-h)',
                background: activePopup === 'palette' ? 'var(--accent)' : ''
              }}
            >
              <Palette/>
            </button>
            <button
              className="btn_32pxNormed"
              id="btn_sbl_info"
              onClick={() => handleButtonClick('info')}
              title="Informationen"
              style={{
                color: 'var(--text-h)',
                background: activePopup === 'info' ? 'var(--accent)' : ''
              }}
            >
              <Info/>
            </button>
            <button
              className="btn_32pxNormed"
              id="btn_sbl_settings"
              onClick={() => handleButtonClick('settings')}
              title="Einstellungen"
              style={{
                color: 'var(--text-h)',
                background: activePopup === 'settings' ? 'var(--accent)' : ''
              }}
            >
              <Settings/>
            </button>
            
          </div>
          {/* Einstellungen Ende */}
        </>
      ) : dirName && !hasPermission ? (
        <div
          style={{
            fontSize: "14px",
            textAlign: "center",
            padding: "20px",
            color: "var(--text)",
            background: "rgba(234, 179, 8, 0.1)",
            borderRadius: "8px",
          }}
        >
          Der Ordner ist hinterlegt, aber Chrome benötigt deine Bestätigung, um
          auf die Dateien zuzugreifen. Klicke oben auf den gelben Button!
        </div>
      ) : null}
    </div>
  );
}
