export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Méthode non autorisée' });
  }

  try {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return res.status(500).json({ 
        error: 'Clé API manquante',
        message: 'Configure GEMINI_API_KEY dans les variables d\'environnement Vercel'
      });
    }

    const { messages, systemPrompt } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ 
        error: 'Données invalides',
        message: 'Le champ "messages" est requis et doit être un tableau' 
      });
    }

    // Convertir les messages au format Gemini
    const geminiMessages = messages.map(msg => {
      if (msg.role === 'user') {
        if (typeof msg.content === 'string') {
          return {
            role: 'user',
            parts: [{ text: msg.content }]
          };
        }
        
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
          
          return { role: 'user', parts: parts };
        }
      } else if (msg.role === 'assistant') {
        return {
          role: 'model',
          parts: [{ text: msg.content }]
        };
      }
      return null;
    }).filter(Boolean);

    // Construire le corps de la requête
    const requestBody = {
      contents: geminiMessages,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 2000,
      }
    };

    // Ajouter le system prompt si fourni
    if (systemPrompt) {
      requestBody.systemInstruction = {
        parts: [{ text: systemPrompt }]
      };
    }

    // CORRECTION : Utilise la bonne URL avec le modèle gemini-pro au lieu de gemini-1.5-flash
    // Si gemini-1.5-flash ne fonctionne pas, essaie gemini-pro
    const geminiUrl = https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY};

    console.log('🚀 Appel à Gemini avec gemini-pro...');

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody)
    });

    const responseText = await response.text();
    console.log('📡 Statut:', response.status);

    if (!response.ok) {
      console.error('❌ Erreur Gemini:', responseText);
      
      // Si gemini-pro ne fonctionne pas, essaie avec un modèle différent
      let errorMessage = 'Erreur API Gemini';
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error?.message || responseText;
      } catch {
        errorMessage = responseText;
      }

      return res.status(response.status).json({ 
        error: 'Erreur API Gemini',
        message: errorMessage,
        status: response.status,
        suggestion: 'Vérifie que ton API key a accès au modèle gemini-pro'
      });
    }

    const data = JSON.parse(responseText);

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('❌ Réponse Gemini invalide:', data);
      return res.status(500).json({ 
        error: 'Réponse invalide',
        message: 'La réponse de Gemini ne contient pas de contenu',
        details: data
      });
    }

    const responseText2 = data.candidates[0].content.parts[0].text;
    
    console.log('✅ Réponse envoyée au client');

    return res.status(200).json({
      content: [{ text: responseText2 }]
    });

  } catch (error) {
    console.error('💥 Erreur serveur:', error);
    return res.status(500).json({ 
      error: 'Erreur interne du serveur',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}
