function extractTextFallback(file) {
  return {
    text: '',
    provider: 'fallback',
    note: `OCR skipped for ${file?.file_type || 'file'} because no OCR provider is configured.`
  };
}

module.exports = { extractTextFallback };
