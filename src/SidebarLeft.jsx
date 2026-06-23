import { useState } from 'react';

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
  hasPermission // NEU: Damit die Sidebar weiß, ob wir reaktivieren müssen
}) {
  const [activeMenu, setActiveMenu] = useState(null);
  const [editingName, setEditingName] = useState(null);
  const [tempName, setTempName] = useState('');

  return (
    <div style={{
      width: '300px',
      background: 'var(--code-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h2>Mindmaps</h2>
      
      {/* Ordner-Status & Auswahl */}
      <div style={{ fontSize: '13px', margin: '10px 0 20px', color: 'var(--text)' }}>
        <strong>Pfad:</strong> {dirName ? `📁 ${dirName}` : 'Kein Ordner gewählt'}
        
        {/* DYNAMISCHER BUTTON: Wechselt den Text je nach Zustand */}
        <button 
          onClick={onSelectDir} 
          style={{ 
            display: 'block', 
            marginTop: '8px', 
            width: '100%', 
            padding: '8px', 
            cursor: 'pointer',
            backgroundColor: (!hasPermission && dirName) ? '#eab308' : 'transparent', // Gelb warnend, wenn Berechtigung fehlt
            color: (!hasPermission && dirName) ? '#000' : 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: '4px',
            fontWeight: (!hasPermission && dirName) ? '600' : 'normal',
            userSelect: 'none'
          }}
        >
          {!dirName 
            ? 'Lokal-Ordner verbinden' 
            : !hasPermission 
              ? '🔑 Berechtigung erteilen' 
              : 'Ordner wechseln'}
        </button>
      </div>

      {/* Die restliche Sidebar wird NUR angezeigt, wenn wir den Ordner UND die Erlaubnis haben */}
      {dirName && hasPermission ? (
        <>
          <button 
            onClick={onCreateMap} 
            style={{ 
              backgroundColor: 'var(--accent)', 
              color: '#fff', 
              border: 'none', 
              padding: '10px', 
              borderRadius: '6px', 
              cursor: 'pointer',
              marginBottom: '20px',
              fontWeight: '600',
              userSelect: 'none'
            }}
          >
            + Neue Mindmap
          </button>

          <div style={{ marginBottom: '15px', fontSize: '14px' }}>
            Status: {isSaved ? <span style={{ color: 'green' }}>● Gespeichert</span> : <span style={{ color: 'orange' }}>● Ungespeichert</span>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maps.map(map => {
              const formatiertesDatum = new Date(map.date).toLocaleDateString('de-DE', {
                day: '2-digit', month: '2-digit', year: '2-digit'
              });

              return (
                <div 
                  key={map.name}
                  onClick={() => currentMap !== map.name && onSelectMap(map.name)}
                  style={{
                    padding: '10px',
                    borderRadius: '6px',
                    background: currentMap === map.name ? 'var(--accent-bg)' : 'transparent',
                    border: currentMap === map.name ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  {/* Namen ändern und speichern - Logik */}
                  {editingName === map.name ? (
                    <input 
                      value={tempName} 
                      onChange={(e) => setTempName(e.target.value)}
                      onBlur={() => {
                        onRenameMap(map.name, tempName);
                        setEditingName(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      autoFocus
                      style={{ width: '70%' }}
                    />
                  ) : (
                    <span style={{ fontWeight: currentMap === map.name ? '600' : 'normal', color: 'var(--text-h)' }}>
                      {map.name} <small style={{ color: 'gray', fontWeight: 'normal', fontSize: '11px' }}>({formatiertesDatum})</small>
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
                    style={{ position: 'relative', outline: 'none' }} 
                    onClick={(e) => e.stopPropagation()}
                  >
                    
                    <button 
                      onClick={(e) => {
                        setActiveMenu(activeMenu === map.name ? null : map.name);
                        const elternteil = e.currentTarget.parentNode;
                        setTimeout(() => {
                          elternteil.focus();
                        }, 0);
                      }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '0 5px', height: '12px', userSelect: 'none', display: activeMenu === map.name ? 'none' : 'inline-block' }}
                    >
                      ⋮
                    </button>
                    

                    {activeMenu === map.name && (
                      
                        <button 
                          onClick={() => { setEditingName(map.name); setTempName(map.name); setActiveMenu(null); }} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', height: '12px', userSelect: 'none' }}
                        >
                          ✏️
                        </button>
                    )}
                    {activeMenu === map.name && (
                        <button 
                          onClick={() => { onDeleteMap(map.name); setActiveMenu(null); }} 
                          style={{ background: 'none', border: 'none', cursor: 'pointer', height: '12px', userSelect: 'none' }}
                        >
                          🗑️
                        </button>
                      
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : dirName && !hasPermission ? (
        <div style={{ fontSize: '14px', textAlign: 'center', padding: '20px', color: 'var(--text)', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px' }}>
          Der Ordner ist hinterlegt, aber Chrome benötigt deine Bestätigung, um auf die Dateien zuzugreifen. Klicke oben auf den gelben Button!
        </div>
      ) : null}
    </div>
  );
}