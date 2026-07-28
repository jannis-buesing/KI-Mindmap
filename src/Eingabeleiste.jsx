import { useState, useEffect, useRef, memo } from 'react';
import { SendHorizontal, Paperclip } from 'lucide-react';

// Node Indicator Badge bleibt unverändert...
export const NodeIndicatorBadge = ({ count }) => {
  if (count === 0) return null;

  const titleText = count === 1
      ? "1 ausgewählter Knoten wird als Kontext mitgesendet"
      : `${count} ausgewählte Knoten werden als Kontext mitgesendet`;

  const displayCount = count >= 1000 ? "1000+" : count;
  const digitCount = String(displayCount).length;
  let badgeWidth = '42px';
  
  if (digitCount === 2) {
      badgeWidth = '50px';
  } else if (digitCount === 3) {
      badgeWidth = '58px';
  } else if (digitCount >= 4) {
      badgeWidth = '72px';
  }

  return (
      <div 
      title={titleText}
      style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '36px',
          gap: '4px',
          padding: '6px 0',
          width: badgeWidth,
          borderRadius: '8px',
          backgroundColor: 'var(--accent-bg)',
          border: '1px solid var(--accent-border)',
          color: 'var(--accent)',
          fontSize: '12px',
          fontWeight: '600',
          userSelect: 'none',
          transition: 'width 0.2s ease, background-color 0.2s ease',
          cursor: 'default',
          animation: 'fadeIn 0.2s ease-out',
          boxSizing: 'border-box'
      }}
      >
      <Paperclip size={14} style={{ flexShrink: 0 }} />
      <span style={{ 
          lineHeight: 1, 
          textAlign: 'center',
          fontVariantNumeric: 'tabular-nums'
      }}>
          {displayCount}
      </span>
      </div>
  );
};

function EingabeleisteComponent({
  loading,
  expandMindmap,
  selectedNodeIds,
  mindmapData,
}) {
  const [eingabeleisteIsExpanded, setEingabeleisteIsExpanded] = useState(false);
  const [userInput, setUserInput] = useState('');
  const [isMobile, setIsMobile] = useState(false); // Mobile-Erkennung für Layout-Wechsel
  const inputRef = useRef(null);
  const textareaRef = useRef(null);
  const spanRef = useRef(null);

  // Mobile-Erkennung aktivieren
  useEffect(() => {
    const media = window.matchMedia('(max-width: 768px)');
    setIsMobile(media.matches);
    const listener = (e) => setIsMobile(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const handleSubmit = (e) => {
    if (e) e.preventDefault();
    if (!userInput.trim() || loading) return;

    const fallbackText = userInput;
    setUserInput('');
    setEingabeleisteIsExpanded(false);

    expandMindmap(userInput, () => {
      setUserInput(fallbackText);
      if (fallbackText.includes('\n') || fallbackText.length > 50) {
        setEingabeleisteIsExpanded(true);
      }
    });
  };

  useEffect(() => {
    if (eingabeleisteIsExpanded) {
      const textarea = textareaRef.current;
      if (textarea) {
        textarea.focus();
        const len = textarea.value.length;
        textarea.setSelectionRange(len, len);
        textarea.style.height = 'auto';
        textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
      }
    } else {
      const input = inputRef.current;
      if (input) {
        input.focus();
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    }
  }, [eingabeleisteIsExpanded]);

  useEffect(() => {
    if (!eingabeleisteIsExpanded && userInput) {
      const animationFrame = requestAnimationFrame(() => {
        const input = inputRef.current;
        const span = spanRef.current;
        if (input && span) {
          const inputWidth = input.offsetWidth;
          const textWidth = span.offsetWidth;
          
          if (inputWidth > 0 && textWidth > inputWidth - 25) {
            setEingabeleisteIsExpanded(true);
          }
        }
      });
      return () => cancelAnimationFrame(animationFrame);
    }
  }, [userInput, eingabeleisteIsExpanded]);

  const [sbl_isOpen, setSbl_isOpen] = useState(true);
  useEffect(() => {
    // Auf den Funkspruch hören
    const handleEvent = (e) => {
      setSbl_isOpen(e.detail); // e.detail enthält den gesendeten Wert
    };

    window.addEventListener("sbl_toggle", handleEvent);
    return () => window.removeEventListener("sbl_toggle", handleEvent);
  }, []);

  if (!mindmapData?._currentFileName) return null;

  const count = selectedNodeIds.length;

  // Dynamische Styles für den Container (Desktop vs. Handy)
   const containerStyle = {
    display: "flex",
    alignItems: "center",
    width: "100%",
    background: "var(--bg)",
    borderRadius: "6px",
    boxSizing: "border-box",
    transition: "border-color 0.2s cubic-bezier(0.25, 1, 0.5, 1), box-shadow 0.2s ease",
    flexShrink: 0,
    zIndex: 10,
  };

  return (
    <div style={containerStyle} className="eingabeleiste-container">
      {/* HILFSELEMENT */}
      <span
        ref={spanRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontFamily: 'inherit',
          fontSize: '15px',
          letterSpacing: 'normal'
        }}
      >
        {userInput || ''}
      </span>

      {!eingabeleisteIsExpanded ? (
        /* ================= LAYOUT 1: SCHLANKE, EINZEILIGE EINGABELEISTE ================= */
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          background: 'var(--code-bg)',
          outline: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '6px 12px',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box',
        }}>
          <input
            ref={inputRef}
            type="text"
            placeholder={ false
              ? "Mindmap erweitern..."
              : selectedNodeIds.length > 1000
                ? "1000+ Knoten bearbeiten..."
                : selectedNodeIds.length > 1
                  ? `${selectedNodeIds.length} Knoten bearbeiten...`
                  : selectedNodeIds.length === 1 ?
                    "Knoten bearbeiten..."
                    : selectedNodeIds.length === 0
                    ? "Mindmap erweitern..."
                      : ""
            }
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (e.shiftKey) {
                  e.preventDefault();
                  setUserInput(prev => prev + '\n');
                  setEingabeleisteIsExpanded(true);
                } else if (userInput.trim().length > 0 && !loading) {
                  handleSubmit();
                }
              }
            }}
            style={{
              flex: 1,
              minWidth: '0',
              border: 'none',
              background: 'transparent',
              padding: '10px 6px',
              fontSize: '15px',
              color: 'var(--text-h)',
              outline: 'none',
            }}
          />
         
          <NodeIndicatorBadge count={count} />

          <button
            onClick={handleSubmit}
            disabled={loading || userInput.trim().length === 0}
            style={{
              padding: '10px 12px',
              flexShrink: 0,
              backgroundColor: loading || userInput.trim().length === 0 ? 'var(--border)' : 'var(--accent)',
              color: loading || userInput.trim().length === 0 ? '#808080' : 'var(--text-h)',
              border: 'none',
              borderRadius: '8px',
              cursor: loading || userInput.trim().length === 0 ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: sbl_isOpen ? 'none' : 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s',
              userSelect: 'none'
            }}
          >
            {loading ? 'Denke nach...' : (
              <>
                <span>Senden</span>
                <SendHorizontal size={16} />
              </>
            )}
          </button>
        </div>
      ) : (
        /* ================= LAYOUT 2: GROSSES TEXTFELD (EXPANDIERT) ================= */
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          background: 'var(--code-bg)',
          outline: '1px solid var(--border)',
          borderRadius: '12px',
          padding: '10px 12px 8px 12px',
          width: '100%',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)',
          transition: 'border-color 0.2s',
          boxSizing: 'border-box'
        }}>
          <div style={{ width: '100%' }}>
            <textarea
              ref={textareaRef}
              rows={1}
              maxLength={10000}
              placeholder={selectedNodeIds.length > 1
                ? `${selectedNodeIds.length} Knoten bearbeiten...`
                : selectedNodeIds.length === 1 ?
                  "Knoten bearbeiten..."
                  : selectedNodeIds.length === 0
                  ? "Mindmap erweitern..."
                    : ""
              }
              value={userInput}
              onChange={(e) => {
                const val = e.target.value;
                setUserInput(val);
                if (val.length === 0) {
                  setEingabeleisteIsExpanded(false);
                }
              }}
              onInput={(e) => {
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
              }}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  if (userInput.trim().length > 0 && !loading) {
                    handleSubmit();
                  }
                }
              }}
              style={{
                width: '100%',
                minWidth: '0',
                border: 'none',
                background: 'transparent',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'var(--text-h)',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                lineHeight: '1.4',
                height: 'auto',
                maxHeight: '160px',
                overflowY: 'auto',
                boxSizing: 'border-box',
                scrollBehavior: 'smooth'
              }}
            />
          </div>

          <div style={{ height: '1px', background: 'var(--border)', margin: '4px -12px 6px -12px' }} />
         
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%'
          }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {userInput.length > 0 && (
                <span style={{
                  fontSize: '11px',
                  color: 'var(--text)',
                  opacity: 0.6,
                  pointerEvents: 'none',
                  userSelect: 'none'
                }}>
                  {userInput.length}/10000
                </span>
              )}
            </div>
           
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <NodeIndicatorBadge count={count} />
             
              <button
                onClick={handleSubmit}
                disabled={loading || userInput.trim().length === 0}
                style={{
                  padding: '8px 14px',
                  flexShrink: 0,
                  backgroundColor: loading || userInput.trim().length === 0 ? 'var(--border)' : 'var(--accent)',
                  color: loading || userInput.trim().length === 0 ? '#808080' : 'var(--text-h)',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: loading || userInput.trim().length === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontWeight: '600',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  transition: 'all 0.2s'
                }}
              >
                {loading ? 'Denke nach...' : (
                  <>
                    <span>Senden</span>
                    <SendHorizontal size={15} />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const Eingabeleiste = memo(EingabeleisteComponent);