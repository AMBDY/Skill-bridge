function analyzeVideo({ video }) {
  if (!video) {
    return { videoScore: 0, transcript: '', flags: [] };
  }

  return {
    videoScore: 60,
    transcript: video.transcript || '',
    flags: []
  };
}

module.exports = { analyzeVideo };
