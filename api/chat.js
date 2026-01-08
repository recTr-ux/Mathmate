export default async function handler(req, res) {
  // Autoriser uniquement les requêtes POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  // Configuration CORS (ajuste le domaine selon ton besoin)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const { messages, systemPrompt } = req.body;

    // Récupérer la clé API depuis les variables d'environnement
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Clé API non configurée' });
    }

    // Convertir les messages au format Gemini
    const geminiMessages = messages.map(msg => {
      if (msg.role === 'user') {
        // Gérer les messages avec fichiers
        if (Array.isArray(msg.content)) {
          const parts = msg.content.map(item => {
            if (item.type === 'text') {
              return { text: item.text };
            } else if (item.type === 'image') {
              return {
                inline_data: {
                  mime_type: item.source.media_type,
                  data: item.source.data
                }
              };
            }
            return null;
          }).filter(Boolean);
          
          return {
            role: 'user',
            parts: parts
          };
        } else {
          return {
            role: 'user',
            parts: [{ text: msg.content }]
          };
        }
      } else if (msg.role === 'assistant') {
        return {
          role: 'model',
          parts: [{ text: msg.content }]
        };
      }
    });

    // Appel à l'API Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: geminiMessages,
          systemInstruction: {
            parts: [{ text: systemPrompt }]
          },
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2000,
          }
        })
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('Erreur Gemini:', errorData);
      return res.status(response.status).json({ 
        error: 'Erreur API Gemini',
        details: errorData 
      });
    }

    const data = await response.json();

    // Convertir la réponse Gemini au format attendu par le frontend
    const responseText = data.candidates[0].content.parts[0].text;
    
    return res.status(200).json({
      content: [{ text: responseText }]
    });

  } catch (error) {
    console.error('Erreur serveur:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error.message 
    });
  }
}
