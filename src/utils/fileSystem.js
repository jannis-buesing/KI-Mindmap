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

async function getUniqueFileName(directoryHandle, baseName, extension = '.json') {
  let name = baseName;
  let counter = 1;
  
  // Wir holen uns alle existierenden Dateinamen im Ordner
  const existingNames = new Set();
  for await (const entry of directoryHandle.values()) {
    if (entry.kind === 'file') {
      existingNames.add(entry.name.toLowerCase());
    }
  }

  // Solange der Name existiert, hängen wir eine Nummer an
  while (existingNames.has(`${name}${extension}`.toLowerCase())) {
    name = `${baseName} (${counter})`;
    counter++;
  }
  
  return `${name}${extension}`;
}

export async function saveMindmapToFile(directoryHandle, fileName, data, isRenaming) {
  if (!directoryHandle) return false;

  const updatedData = {
    ...data,
    lastChanged: isRenaming 
      ? (data.lastChanged || Date.now())
      : Date.now()
  }

  try {
    let finalFileName;

    if(isRenaming){
      finalFileName = await getUniqueFileName(directoryHandle, fileName);
    } else if(data._currentFileName){
      finalFileName = `${data._currentFileName}.json`;
    } else{
      finalFileName = await getUniqueFileName(directoryHandle, fileName);
    }

    const fileHandle = await directoryHandle.getFileHandle(finalFileName, { create: true });

    updatedData._currentFileName = finalFileName.replace('.json', '');

    const writable = await fileHandle.createWritable();
    await writable.write(JSON.stringify(updatedData, null, 2));
    await writable.close();
    console.log("Fertig geschrieben: ", updatedData);
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
        
        try {
          const parsed = JSON.parse(text);
          const currentFileName = entry.name.replace('.json', '');
          
          const uniqueId = parsed.id || `${Date.now()}_${Math.floor(Math.random() * 1000)}`;

          files.push({
            id: uniqueId,
            name: currentFileName,
            date: parsed.lastChanged || file.lastModified
          });
        } catch (e) {
          files.push({
            id: entry.name,
            name: entry.name.replace('.json', ''),
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

export async function deleteMindmapFile(directoryHandle, fileName) {
  if (!directoryHandle) return false;
  try {
    await directoryHandle.removeEntry(`${fileName}.json`);
    return true;
  } catch (error) {
    return false;
  }
}