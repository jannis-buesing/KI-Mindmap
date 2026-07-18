import React, { useState, useEffect } from 'react';

const TypewriterBox = ({ sentences, HinweissätzeStartIndex = 0 }) => {
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(HinweissätzeStartIndex);
  const [displayedText, setDisplayedText] = useState('');
  const [phase, setPhase] = useState('typing'); // Phasen: 'typing' | 'waiting' | 'deleting'

  useEffect(() => {
    if (!sentences || sentences.length === 0) return;

    const currentSentence = sentences[currentSentenceIndex];

    // Phase 1: Text wird Buchstabe für Buchstabe aufgebaut
    if (phase === 'typing') {
      if (displayedText.length < currentSentence.length) {
        const typeTimeout = setTimeout(() => {
          setDisplayedText(currentSentence.substring(0, displayedText.length + 1));
        }, 40); // 40ms pro Buchstabe
        return () => clearTimeout(typeTimeout);
      } else {
        setPhase('waiting'); // Satz ist fertig -> ab ins Wartezimmer
      }
    }

    // Phase 2: Der fertige Satz bleibt 5 Sekunden sichtbar
    if (phase === 'waiting') {
      const waitTimeout = setTimeout(() => {
        setPhase('deleting');
      }, 4000);
      return () => clearTimeout(waitTimeout);
    }

    // Phase 3: Text wird per Backspace rückwärts gelöscht
    if (phase === 'deleting') {
      if (displayedText.length > 0) {
        const deleteTimeout = setTimeout(() => {
          setDisplayedText(displayedText.substring(0, displayedText.length - 1));
        }, 30); // 30ms pro Buchstabe (Löschen ist schneller)
        return () => clearTimeout(deleteTimeout);
      } else {
        // Komplett leer?
        setTimeout(() => {
            setCurrentSentenceIndex((prev) => (prev + 1) % sentences.length);
            setPhase('typing');
        }, 400);
      }
    }
  }, [displayedText, phase, currentSentenceIndex, sentences]);

  return (
    <div className="typewriter-container">
      <style>{`
        .typewriter-container {
          width: 100%;
          height: 75px;
          padding: 10px 12px;
          box-sizing: border-box;
          background: var(--code-bg);
          border: 1px solid var(--border);
          border-radius: 8px;
          overflow: hidden; 
          
          /* Vertikale Zentrierung */
          display: flex;
          align-items: center; 
          margin-bottom: 4px;
        }

        .typewriter-text {
          font-family: inherit;
          color: var(--text);
          font-size: 13px;
          line-height: 1.4;
          margin: 0;
          white-space: pre-wrap;
        }
      `}</style>

      <p className="typewriter-text">
        {displayedText}
      </p>
    </div>
  );
};

export default TypewriterBox;