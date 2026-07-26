import { GoogleGenerativeAI } from "@google/generative-ai";
import crypto from "crypto";

const firstRequestIpCache = new Set();

// Ein geheimer Schlüssel auf dem Server, den der Client NIEMALS sieht
const ENCRYPTION_KEY = process.env.COOLDOWN_KEY || "ein-sehr-langer-und-sicherer-geheimcode-123456"; 

// Hilfsfunktionen zum Verschlüsseln/Entschlüsseln des Zeitstempels
function encryptTimestamp(timestamp) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", crypto.scryptSync(ENCRYPTION_KEY, "salt", 32), iv);
  let encrypted = cipher.update(timestamp.toString(), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decryptTimestamp(token) {
  try {
    const parts = token.split(":");
    const iv = Buffer.from(parts.shift(), "hex");
    const encryptedText = Buffer.from(parts.join(":"), "hex");
    const decipher = crypto.createDecipheriv("aes-256-cbc", crypto.scryptSync(ENCRYPTION_KEY, "salt", 32), iv);
    let decrypted = decipher.update(encryptedText, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return parseInt(decrypted, 10);
  } catch (e) {
    return 0; // Ungültiges Token
  }
}

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Methode nicht erlaubt' });
  }

  const { nodes, edges, positions, selectedNodeIds, userInput, userApiKey, cooldownToken } = request.body;

  const activeApiKey = userApiKey?.trim() || process.env.VITE_GEMINI_API_KEY;
  if (!activeApiKey) {
    return response.status(400).json({ error: "Kein API-Schlüssel konfiguriert." });
  }

  const isGlobalKey = !userApiKey?.trim() && activeApiKey === process.env.VITE_GEMINI_API_KEY;
  const now = Date.now();
  const cooldownMs = 60 * 1000;

  if (isGlobalKey) {
    const ip = request.headers["x-forwarded-for"] || "anonymous";

    // FALL 1: Der Nutzer hat KEIN Token mitgeschickt
    if (!cooldownToken) {
      // Prüfen, ob die IP in dieser Serverless-Instanz schon einmal ohne Token angefragt hat
      if (firstRequestIpCache.has(ip)) {
        // IP trickst herum (hat das Token gelöscht, obwohl sie schon da war) -> Bestrafen!
        const newToken = encryptTimestamp(now);
        return response.status(429).json({ 
          error: "Sicherheits-Check: Bitte warte 60 Sekunden, um den Server-Key zu reaktivieren.",
          newToken: newToken
        });
      }
      
      // Es ist der allererste, legitime Aufruf! Wir merken uns die IP im RAM für diese Instanz
      firstRequestIpCache.add(ip);
      // Wir lassen ihn durchgehen. Das Token wird am Ende der Funktion ausgestellt.
    } 
    // FALL 2: Der Nutzer HAT ein Token mitgeschickt
    else {
      const lastRequestTime = decryptTimestamp(cooldownToken);
      const timePassed = now - lastRequestTime;

      if (timePassed < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - timePassed) / 1000);
        return response.status(429).json({ 
          error: `Zu viele Anfragen. Bitte warte noch ${remainingSeconds} Sekunden.`,
          newToken: cooldownToken 
        });
      }
    }
  }

  // Ab hier läuft der reguläre KI-Verarbeitungsprozess...
  const ai = new GoogleGenerativeAI(activeApiKey);
  const AVAILABLE_MODELS = [
    'gemini-3.5-flash',
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.5-flash-lite'
  ];

  const prompt = `
    Du bist ein meisterhafter, strukturierter Mindmap-Experte.
    Deine Aufgabe ist es, die bestehende Mindmap basierend auf einer Benutzeranweisung gezielt zu verändern, indem du Knoten neu erstellst, bearbeitest (Label || positionen) oder löschst.
    Du gibst AUSSCHLIESSLICH eine flache Liste von Änderungsbefehlen (Operations) als valides JSON-Objekt zurück.
    Verändere bei den Operationen "added" und "updated" die Positionen der Knoten, falls angemessen.

    Aktuelle Knoten:
    ${JSON.stringify(nodes, null, 2)}

    Aktuelle Verbindungen (Edges):
    ${JSON.stringify(edges, null, 2)}

    Positionen der aktuellen Knoten:
    ${JSON.stringify(positions, null, 2)}

    Vom Nutzer markierte Knoten-IDs:
    ${JSON.stringify(selectedNodeIds)}

    Benutzeranweisung:
    "${userInput}"

    Regeln für Layout & Positionierung:
    - Knoten wachsen vom 'root'-Knoten (Zentrum bei 0,0) nach links und rechts aus.
    - Vermeide JEDE Überschneidung. Geschwisterknoten müssen vertikal mindestens 90px Abstand voneinander haben. Kindknoten sind horizontal ca. 250px von ihrem Elternteil entfernt.
    - Wenn du eine ungerade Anzahl von Kindknoten für ein Elternteil generierst oder anordnest, MUSS der mittlere Kindknoten exakt dieselbe Y-Koordinate wie das Elternteil haben, um Symmetrie zu wahren.
    - Ändert der Nutzer die Hierarchie ("Knoten X soll ein Kind von Y sein"), musst du die alte Verbindung kappen, eine neue anlegen und den Knoten räumlich neu platzieren.

    Regeln für das JSON-Ausgabeformat:
    - Der zentrale Hauptknoten mit id: "root" darf NIEMALS gelöscht werden!
    - "type": "added", "updated" oder "deleted".
    - Für "added": Erzeuge eine "temporaryId" (z.B. "new_123") und gib die "parentId" an (von wo die Verbindung ausgehen soll).
    - Für "updated": Gib die "nodeId" an und liefere das neue "label".
    - Für "deleted": Gib nur die "nodeId" an.

    Struktur (Antworte NUR mit diesem JSON):
    {
      "operations": [
        { "type": "added", "temporaryId": "temp_1", "parentId": "parent_id", "label": "Neuer Text", "x": 250, "y": 0 },
        { "type": "updated", "nodeId": "existing_id", "label": "Bestehender Text", "x": -250, "y": 60 },
        { "type": "deleted", "nodeId": "deleted_id" }
      ],
      "edgesToDelete": [
        { "source": "alte_parent_id", "target": "existing_id" }
      ],
      "edgesToAdd": [
        { "source": "neue_parent_id", "target": "existing_id" }
      ]
    }
  `;

  for (const modelName of AVAILABLE_MODELS) {
    try {
      const model = ai.getGenerativeModel({ model: modelName, generationConfig: { responseMimeType: "application/json" } });
      const result = await model.generateContent(prompt);
      const data = JSON.parse(result.response.text());

      if (isGlobalKey) {
        data._newToken = encryptTimestamp(Date.now());
      }

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