import { useState } from 'react';

export function Sidebar({ 
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
            fontWeight: (!hasPermission && dirName) ? '600' : 'normal'
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
              fontWeight: '600'
            }}
          >
            + Neue Mindmap
          </button>

          <div style={{ marginBottom: '15px', fontSize: '14px' }}>
            Status: {isSaved ? <span style={{ color: 'green' }}>● Gespeichert</span> : <span style={{ color: 'orange' }}>● Ungespeichert</span>}
          </div>

          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maps.map(mapName => (
              <div 
                key={mapName}
                onClick={() => currentMap !== mapName && onSelectMap(mapName)}
                style={{
                  padding: '10px',
                  borderRadius: '6px',
                  background: currentMap === mapName ? 'var(--accent-bg)' : 'transparent',
                  border: currentMap === mapName ? '1px solid var(--accent-border)' : '1px solid transparent',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                {editingName === mapName ? (
                  <input 
                    value={tempName} 
                    onChange={(e) => setTempName(e.target.value)}
                    onBlur={() => {
                      onRenameMap(mapName, tempName);
                      setEditingName(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        onRenameMap(mapName, tempName);
                        setEditingName(null);
                      }
                    }}
                    autoFocus
                    style={{ width: '70%' }}
                  />
                ) : (
                  <span style={{ fontWeight: currentMap === mapName ? '600' : 'normal', color: 'var(--text-h)' }}>
                    {mapName}
                  </span>
                )}

                <div style={{ display: 'flex', gap: '5px' }} onClick={(e) => e.stopPropagation()}>
                  <button onClick={() => { setEditingName(mapName); setTempName(mapName); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>✏️</button>
                  <button onClick={() => onDeleteMap(mapName)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>🗑️</button>
                </div>
              </div>
            ))}
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