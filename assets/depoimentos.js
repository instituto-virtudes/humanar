(() => {
  const videos = [...document.querySelectorAll('.testimonial-card video')];
  videos.forEach(video => {
    video.addEventListener('play', () => {
      videos.forEach(other => { if (other !== video && !other.paused) other.pause(); });
    });
  });
})();
