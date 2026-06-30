const env = process.env;

function enabled(name) {
  return String(env[name] || '').toLowerCase() === 'true';
}

module.exports = {
  providers: {
    openai: {
      key: env.OPENAI_API_KEY || '',
      enabled: enabled('ENABLE_OPENAI')
    },
    gemini: {
      key: env.GEMINI_API_KEY || '',
      enabled: enabled('ENABLE_GEMINI')
    },
    groq: {
      key: env.GROQ_API_KEY || '',
      enabled: enabled('ENABLE_GROQ')
    },
    googleVision: {
      key: env.GOOGLE_VISION_KEY || '',
      enabled: !!env.GOOGLE_VISION_KEY
    },
    textract: {
      key: env.AWS_TEXTRACT_KEY || '',
      enabled: !!env.AWS_TEXTRACT_KEY
    },
    whisper: {
      key: env.WHISPER_API_KEY || env.OPENAI_API_KEY || '',
      enabled: !!(env.WHISPER_API_KEY || env.OPENAI_API_KEY)
    }
  }
};
