import { get, set } from 'idb-keyval'; // Ein ultra-leichtes Paket für Browser-Datenbanken

// Speichert das Ordner-Handle sicher im Browser-Gedächtnis (IndexedDB)
export async function storeDirectoryHandle(handle) {
  try {
    await set('mindmap-root-dir', handle);
  } catch (error) {
    console.error("Fehler beim Sichern des Handles im Browser:", error);
  }
}

// Holt das gespeicherte Handle zurück, falls vorhanden
export async function getStoredDirectoryHandle() {
  try {
    const handle = await get('mindmap-root-dir');
    if (!handle) return null;

    // Prüfen, ob wir noch die Erlaubnis haben (Chrome fragt hier nach dem Klick)
    const options = { mode: 'readwrite' };
    if ((await handle.queryPermission(options)) === 'granted') {
      return handle;
    }
    
    return handle; // Gibt das Handle zurück, Berechtigung wird in der UI abgefragt
  } catch (error) {
    console.error("Fehler beim Laden des gespeicherten Handles:", error);
    return null;
  }
}

// Öffnet den nativen Browser-Ordner-Picker
export async function selectMindmapDirectory() {
  try {
    const handle = await window.showDirectoryPicker({ mode: 'readwrite' });
    await storeDirectoryHandle(handle); // Direkt für das nächste Mal merken!
    return handle;
  } catch (error) {
    console.error("Ordner-Auswahl abgebrochen:", error);
    return null;
  }
}

// Hilfsfunktion: Garantiert einen eindeutigen Dateinamen ohne Windows-Kollisionen
async function buildUniqueFileName(directoryHandle, baseName) {
  const safeBase = String(baseName || 'Meine Mindmap')
    .replace(/[\\/?<>:*|"']/g, '')
    .trim() || 'Meine Mindmap';

  if (!directoryHandle) return `${safeBase}.json`;

  // Alle existierenden Dateinamen im Ordner sammeln
  const existingNames = new Set();
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') {
      existingNames.add(entry.name.toLowerCase());
    }
  }

  let finalName = safeBase;
  let counter = 1;

  // Schleife: Solange "Name.json" existiert, Zähler erhöhen -> "Name (1).json"
  while (existingNames.has(`${finalName}.json`.toLowerCase())) {
    finalName = `${safeBase} (${counter})`;
    counter++;
  }

  return `${finalName}.json`;
}

// Speichert die Mindmap direkt unter ihrem Namen ab
export async function saveMindmapToFile(directoryHandle, fileName, data, isRenaming, mapsList = []) {
  if (!directoryHandle) return null;

  try {
    let finalFileName;
    
    // Dein ID-Check: Existiert diese Mindmap-ID bereits in unserer Dateiliste?
    const existingMap = mapsList.find(m => m.id === data.id);

    if (existingMap && !isRenaming) {
      // JA -> ID existiert. Wir speichern exakt in DIESER bereits zugewiesenen Datei.
      finalFileName = `${existingMap._currentFileName}.json`;
    } else {
      // NEIN -> ID ist brandneu (z. B. gerade von temp_ umgewandelt). 
      // Wir erstellen eine neue Datei und verhindern Windows-Namenskonflikte.
      finalFileName = await buildUniqueFileName(directoryHandle, fileName);
    }

    const cleanName = finalFileName.replace('.json', '');

    const updatedData = {
      ...data,
      date: Date.now(),
      _currentFileName: cleanName // Der echte, kollisionsfreie Name wandert ins JSON
    };

    if (updatedData.name) delete updatedData.name;
    delete updatedData.lastChanged;

    const fileHandle = await directoryHandle.getFileHandle(finalFileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(updatedData, null, 2));
    await writable.close();

    return cleanName; // Gibt den Namen zurück, damit die App den State synchronisieren kann
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    return null;
  }
}

// Lädt alle Mindmaps und extrahiert Metadaten rein über IDs und _currentFileName
export async function loadMindmapsFromDirectory(directoryHandle) {
  if (!directoryHandle) return [];
  const files = [];
  try {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        try {
          const file = await entry.getFile();
          const text = await file.text();
          const parsed = JSON.parse(text);
          
          const currentFileName = parsed._currentFileName || entry.name.replace('.json', '');
          const uniqueId = parsed.id || `map_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          files.push({
            id: uniqueId,
            _currentFileName: currentFileName,
            date: parsed.date || parsed.lastChanged || file.lastModified
          });
        } catch (e) {
          // Fallback für beschädigte JSON-Dateien
          files.push({
            id: entry.name,
            _currentFileName: entry.name.replace('.json', ''),
            date: file.lastModified
          });
        }
      }
    }
    return files.sort((a, b) => b.date - a.date);
  } catch (error) {
    console.error("Fehler beim Laden der Mindmaps:", error);
    return [];
  }
}

// Löscht eine Datei präzise über ihren Dateinamen
export async function deleteMindmapFile(directoryHandle, fileName) {
  if (!directoryHandle || !fileName) return false;
  try {
    const targetName = fileName.endsWith('.json') ? fileName : `${fileName}.json`;
    await directoryHandle.removeEntry(targetName);
    return true;
  } catch (error) {
    console.error("Fehler beim Löschen der Datei:", error);
    return false;
  }
}