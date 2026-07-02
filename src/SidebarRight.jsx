export function SidebarRight() {
  return (
    <div style={{
      width: '300px',
      background: 'var(--code-bg)',
      borderLeft: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      padding: '20px',
      boxSizing: 'border-box'
    }}>
      <h2>Details & Optionen</h2>
      <div style={{ 
        flex: 1, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        border: '1px dashed var(--border)', 
        borderRadius: '8px',
        color: 'var(--text)',
        fontSize: '14px'
      }}>
        Platzhalter für rechte Sidebar
      </div>
    </div>
  );
}