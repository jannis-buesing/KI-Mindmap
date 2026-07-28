import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export function ButtonEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  selected,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const onDeleteClick = (e) => {
    e.stopPropagation();
    window.dispatchEvent(
      new CustomEvent('reactflow-edges-delete', {
        detail: { edgeIds: [id] }
      })
    );
  };

  return (
    <>
      {/* 1. Der SICHTBARE Pfad (hier greift dein CSS perfekt) */}
      <path
        id={id}
        style={style}
        className="react-flow__edge-path"
        d={edgePath}
        markerEnd={markerEnd}
      />

      {/* 2. Der UNSICHTBARE Interaktions-Pfad (für extrem leichtes Anklicken) */}
      <path
        d={edgePath}
        className="react-flow__edge-interaction"
      />
      
      {/* Mülltonne */}
      {selected && (
        <EdgeLabelRenderer>
            <div
            style={{
                position: 'absolute',
                transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
                pointerEvents: 'all',
                zIndex: 1000,
            }}
            >
            <button
                onClick={onDeleteClick}
                style={{
                width: '28px',
                height: '28px',
                backgroundColor: 'var(--delete)',
                color: 'white',
                border: 'none',
                borderRadius: '8px', /* NEU: 8px Eckenradius statt 50% */
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 3px 6px rgba(0,0,0,0.25)',
                transition: 'background-color 0.1s ease, transform 0.1s ease',
                padding: 0, /* Verhindert Browser-Standard-Verschiebungen */
                }}
                // Kleiner Hover-Effekt direkt im Style (optional, sieht aber edel aus)
                onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#e03b3b';
                e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--delete)';
                e.currentTarget.style.transform = 'scale(1)';
                }}
                title="Verbindung löschen"
            >
                {/* Das Icon hat jetzt ein Style für absolute Zentrierung innerhalb des Flex-Buttons */}
                <Trash2 
                size={14} 
                style={{ 
                    display: 'block',
                    margin: 'auto' 
                }} 
                />
            </button>
            </div>
        </EdgeLabelRenderer>
        )}
    </>
  );
}