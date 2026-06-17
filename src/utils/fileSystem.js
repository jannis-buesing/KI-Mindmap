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

export async function saveMindmapToFile(directoryHandle, fileName, data) {
  if (!directoryHandle) return false;
  try {
    const fileHandle = await directoryHandle.getFileHandle(`${fileName}.json`, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(data, null, 2));
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
        files.push(entry.name.replace('.json', ''));
      }
    }
    return files;
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