import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const { nodes, edges, selectedNodeIds, userInput, userApiKey } = request.body;

  const activeApiKey = userApiKey || process.env.VITE_GEMINI_API_KEY;
  if (!activeApiKey) {
    return response.status(400).json({ error: "Kein API-Schlüssel konfiguriert. Bitte gib einen eigenen Schlüssel ein." });
  }

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

    Aktuelle Knoten:
    ${JSON.stringify(nodes, null, 2)}

    Aktuelle Verbindungen (Edges):
    ${JSON.stringify(edges, null, 2)}

    Vom Nutzer markierte Knoten-IDs:
    ${JSON.stringify(selectedNodeIds)}

    Benutzeranweisung:
    "${userInput}"

    Regeln für das JSON-Ausgabeformat:
    - Der zentrale Hauptknoten mit id: "root" darf NIEMALS gelöscht werden!
    - "type": "added", "updated" oder "deleted".
    - Für "added": Erzeuge eine "temporaryId" (z.B. "new_123") und gib die "parentId" an (von wo die Verbindung ausgehen soll).
    - Für "updated": Gib die "nodeId" an und liefere das neue "label".
    - Für "deleted": Gib nur die "nodeId" an.

    Struktur (Antworte NUR mit diesem JSON):
    {
      "operations": [
        { "type": "added", "parentId": "root", "temporaryId": "child_1", "label": "Neuer Unterpunkt" },
        { "type": "updated", "nodeId": "child_2", "label": "Neuer Name" },
        { "type": "deleted", "nodeId": "child_3" }
      ]
    }
  `;

  for (const modelName of AVAILABLE_MODELS) {
    try {
      const model = ai.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());
      return response.status(200).json(data);
    } catch (error) {
      if (error.message?.includes("API_KEY_INVALID") || error.status === 400) {
        return response.status(400).json({ error: "Der eingegebene API-Schlüssel ist ungültig." });
      }
      continue; 
    }
  }

  return response.status(503).json({ error: "Alle verfügbaren Gemini-Modelle sind derzeit ausgelastet (503)." });
}
