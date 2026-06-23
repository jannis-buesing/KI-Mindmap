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
    
    return handle; // Gibt das Handle zurück, Berechtigung wird gleich in der UI abgefragt
  } catch (error) {
    console.error("Fehler beim Laden des gespeicherten Handles:", error);
    return null;
  }
}

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

export async function saveMindmapToFile(directoryHandle, mapName, data, isRenaming) {
  if (!directoryHandle) return false;
  const updatedData = {
    ...data,
    lastChanged: (!isRenaming || !data.lastChanged) ? Date.now() : data.lastChanged
  }
  try {
    const fileHandle = await directoryHandle.getFileHandle(`${mapName}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(updatedData, null, 2));
    await writable.close();
    return true;
  } catch (error) {
    console.error("Fehler beim Speichern:", error);
    return false;
  }
}

export async function loadMindmapsFromDirectory(directoryHandle) {
  if (!directoryHandle) return [];
  const files = [];
  try {
    for await (const entry of directoryHandle.values()) {
      if (entry.kind === 'file' && entry.name.endsWith('.json')) {
        const file = await entry.getFile();
        const text = await file.text();
        
        let date = 0;
        try {
          const parsed = JSON.parse(text);
          const unifiedData = parsed.rootNode ? parsed : {
            name: entry.name.replace('.json', ''),
            lastChanged: parsed.lastChanged || file.lastModified,
            rootNode: parsed,
            positions: {}
          };
          date = unifiedData.lastChanged;
        } catch (e) {
          date = file.lastModified;
        }

        files.push({
          name: entry.name.replace('.json', ''),
          date: date
        });
      }
    }
    return files.sort((a, b) => b.date - a.date);
  } catch (error) {
    return [];
  }
}

export async function deleteMindmapFile(directoryHandle, fileName) {
  if (!directoryHandle) return false;
  try {
    await directoryHandle.removeEntry(`${fileName}.json`);
    return true;
  } catch (error) {
    return false;
  }
}