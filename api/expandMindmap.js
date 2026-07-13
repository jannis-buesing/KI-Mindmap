import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(request, response) {
  // 1. Nur POST-Anfragen erlauben
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const { rootNode, selectedNodeIds, userInput, userApiKey } = request.body;

  const activeApiKey = userApiKey || process.env.GEMINI_API_KEY;

  if (!activeApiKey) {
    return response.status(400).json({ 
      error: "Kein API-Schlüssel konfiguriert. Bitte gib einen eigenen Schlüssel ein." 
    });
  }

  console.log('benutzter API-Key: ', activeApiKey); ///////////////TEST /////////////

  // 3. Gemini initialisieren
  const ai = new GoogleGenerativeAI(activeApiKey);

    const AVAILABLE_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
    ];

  const prompt = `
    Du bist ein meisterhafter, strukturierter Mindmap-Experte.
    Deine Aufgabe ist es, die bestehende Mindmap basierend auf einer Benutzeranweisung gezielt zu verändern.
    Du gibst AUSSCHLIESSLICH eine flache Liste von Änderungsbefehlen (Operations) als valides JSON-Objekt zurück.
    Diese werden dann von der Anwendung direkt in den Mindmap-Baum übernommen.

    Aktueller Mindmap-Baum (Kontext):
    ${JSON.stringify(rootNode, null, 2)}

    vom Nutzer aktuell markierte Knoten-IDs:
    ${JSON.stringify(selectedNodeIds)}

    Benutzeranweisung:
    "${userInput}"

    Regeln für das JSON-Ausgabeformat:
    - WICHTIG: Der zentrale Hauptknoten mit id: "root" darf NIEMALS den Status "deleted" erhalten!
    - "type": Kann "added", "updated" oder "deleted" sein.
    - Für "added": Erzeuge eine einzigartige "temporaryId" (z.B. "new_123") und gib die "parentId" an, also, zu welchem Elternknoten der neue Knoten gehört.
    - Für "updated": Gib die "nodeId" an und liefere das neue "label" sowie das "oldLabel".
    - Für "deleted": Gib nur die "nodeId" an, die gelöscht werden soll.

    Beispiel für die exakte Struktur (Antworte NUR mit diesem JSON, kein Markdown, kein Text!):
    {
      "operations": [
        { "type": "added", "parentId": "root", "temporaryId": "child_1", "label": "Neuer Unterpunkt" },
        { "type": "updated", "nodeId": "child_2", "oldLabel": "Alter Name", "label": "Neuer Name" },
        { "type": "deleted", "nodeId": "child_3" }
      ]
    }
  `;

  // 4. Fallback-Schleife über die Modelle auf dem Server ausführen
  for (const modelName of AVAILABLE_MODELS) {
    try {
      console.log(`[Backend] Versuche Modell: ${modelName}...`);
      
      const model = ai.getGenerativeModel({ 
        model: modelName, 
        generationConfig: { responseMimeType: "application/json" }
      });

      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      
      // Bei Erfolg: Direkt das JSON an das Frontend zurückgeben
      return response.status(200).json(data);

    } catch (error) {
      console.warn(`[Backend] Modell ${modelName} fehlgeschlagen: ${error.message || error}`);
      // Versuche das nächste Modell in der Schleife
      continue; 
    }
  }

  // Wenn alle Modelle fehlschlagen
  return response.status(503).json({ 
    error: "Alle verfügbaren Gemini-Modelle sind derzeit ausgelastet (503)." 
  });
}