import { useState } from 'react';
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';

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
  const [isOpen, setIsOpen] = useState(true);


  const activeMapObject = maps.find(m => m.id === currentMap);

  const CurrentMapDate = activeMapObject?.date
    ? new Date(activeMapObject.date).toLocaleDateString('de-DE', {
        day: '2-digit', month: '2-digit', year: '2-digit'
      })
    : '--.--.--';

  return (
    <div style={{
      width: isOpen ? '300px' : '60px',
      background: 'var(--code-bg)',
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      flex: '0 5 auto',
      maxwidth: '25vw',
      minWidth: isOpen ? '225px' : '60px',
      padding: isOpen ? '20px' : '14px',
      boxSizing: 'border-box',
      transition:'width 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
    }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
        }}>
        {isOpen && <h2>Mindmaps</h2>}

        <button onClick={() => setIsOpen(!isOpen)} id='btn_sidebarLeftToggle'>
          {isOpen ? (
          <PanelLeftClose style={{ width: '24px', height: '24px', userSelect: 'none', borderRadius: '100px' }}/>
        ) : (
          <PanelLeftOpen style={{ width: '24px', height: '24px', userSelect: 'none', borderRadius: '100px' }}/>
        )}
        </button>
      </div>
      {/* Ordner-Status & Auswahl */}
      <div style={{ fontSize: '13px', margin: '10px 0 20px', color: 'var(--text)' }}>
        {isOpen && <div><strong>Pfad:</strong> {dirName ? `📁 ${dirName}` : 'Kein Ordner gewählt'}</div>}
        
        {/* DYNAMISCHER BUTTON: Wechselt den Text je nach Zustand */}
        <button 
          id='btn_ordnerWechseln'
          onClick={onSelectDir} 
          style={{ 
            display: 'block', 
            marginTop: '8px', 
            width: isOpen ? '100%' : '32px',
            height: isOpen ? '32px' : 'auto',
            padding: '8px', 
            cursor: 'pointer',
            backgroundColor: (!hasPermission && dirName) ? '#eab308' : 'transparent', // Gelb warnend, wenn Berechtigung fehlt
            color: (!hasPermission && dirName) ? '#000' : 'var(--text-h)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            fontWeight: (!hasPermission && dirName) ? '600' : 'normal',
            userSelect: 'none'
          }}
        >
          {!dirName 
            ? 'Lokal-Ordner verbinden' 
            : !hasPermission 
              ? '🔑 Berechtigung erteilen' 
              : isOpen ? 'Ordner wechseln'
                : '📁'}
        </button>
      </div>

      {/* Die restliche Sidebar wird NUR angezeigt, wenn wir den Ordner UND die Erlaubnis haben */}
      {dirName && hasPermission ? (
        <>
          <button
            id='btn_neueMindmap'
            onClick={() => {
              setIsOpen(true);
              onCreateMap();
            }}
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
            {isOpen ? <span>+ Neue Mindmap</span> : <span style={{ width: '32px', height: '32px' }}>+</span>}
          </button>

          

          {isOpen &&
              <div style={{ marginBottom: '15px', fontSize: '14px', display: 'flex', gap: '4px' }}>
              Status: {isSaved ? <span style={{ color: 'green' }}>● Gespeichert</span> : <span style={{ color: 'orange' }}>● Ungespeichert</span>}

              <small style={{ color: 'gray', fontWeight: 'normal', fontSize: '11px', marginLeft: 'auto' }}>
                          ({CurrentMapDate})
              </small>
            </div>
          }

          { isOpen && <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {maps.map(map => {

              const isCurrentMap = currentMap === map.id;

              return (
                <div
                  className='btn_mappedMindmaps' 
                  key={map.id}
                  onClick={() => !isCurrentMap && onSelectMap(map.id)}
                  style={{
                    padding: '0 10px',
                    height: '48px',
                    borderRadius: '6px',
                    background: isCurrentMap ? 'var(--accent-bg)' : 'transparent',
                    border: isCurrentMap ? '1px solid var(--accent-border)' : '1px solid transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxSizing: 'border-box'
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
                        if (e.key === 'Enter') {
                          e.target.blur();
                        }
                      }}
                      autoFocus
                      style={{ width: '70%', height: '30px', boxSizing: 'border-box' }}
                    />
                  ) : (
                    <span style={{ 
                      fontWeight: isCurrentMap ? '600' : 'normal', 
                      color: 'var(--text-h)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      overflow: 'hidden', 
                      flex: 1,
                      marginRight: '10px'
                    }}>
                      <span style={{ 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis', 
                        whiteSpace: 'nowrap',
                        flex: 1 
                      }}>
                        {map.name}
                      </span>
                      {/* Das Datum bleibt starr stehen */}
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
                    style={{ position: 'relative', outline: 'none', display: 'flex', alignItems: 'center', gap: '2px' }} 
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
                      className='btn_dreiPunkteMenu'
                      style={{ display: activeMenu === map.id ? 'none' : 'inline-block' }}
                    >
                      ⋮
                    </button>
                    

                    {activeMenu === map.id && (
                      
                        <button 
                          onClick={() => { setEditingName(map.id); setTempName(map.name); setActiveMenu(null); }} 
                          className="btn_dreiPunkteMenu"
                        >
                          ✏️
                        </button>
                    )}
                    {activeMenu === map.id && (
                        <button 
                          onClick={() => { onDeleteMap(map.id); setActiveMenu(null); }} 
                          className="btn_dreiPunkteMenu"
                        >
                          🗑️
                        </button>
                      
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          }
        </>
      ) : dirName && !hasPermission ? (
        <div style={{ fontSize: '14px', textAlign: 'center', padding: '20px', color: 'var(--text)', background: 'rgba(234, 179, 8, 0.1)', borderRadius: '8px' }}>
          Der Ordner ist hinterlegt, aber Chrome benötigt deine Bestätigung, um auf die Dateien zuzugreifen. Klicke oben auf den gelben Button!
        </div>
      ) : null}
    </div>
  );
}