// detectorWorker.js – runs in its own thread and performs pixel-based face detection
self.onmessage = function (e) {
  const { id, width, height, buffer } = e.data;
  const data = new Uint8ClampedArray(buffer);
  const faceY = detectFacePosition(data, width, height);
  // NOTE: the buffer is now neutered in the worker – no need to send it back.
  self.postMessage({ id, faceY });
};

function detectFacePosition(data, width, height) {
  const FACE_SCAN_REGION_TOP_RATIO = 0.15;
  const FACE_SCAN_REGION_BOTTOM_RATIO = 0.85;
  const FACE_SCAN_REGION_LEFT_RATIO = 0.25;
  const FACE_SCAN_REGION_RIGHT_RATIO = 0.75;
  const FACE_REGION_SIZE_PX = 30;
  const FACE_REGION_STEP_PX = 15;
  const MIN_BRIGHTNESS_THRESHOLD = 60;
  const MAX_BRIGHTNESS_THRESHOLD = 220;
  const MIN_SKIN_TONE_RATIO_THRESHOLD = 0.1;
  const SKIN_R_MIN_THRESHOLD = 95;
  const SKIN_G_MIN_THRESHOLD = 40;
  const SKIN_B_MIN_THRESHOLD = 20;
  const SKIN_RGB_DIFF_MIN_THRESHOLD = 15;
  const EXPECTED_FACE_CENTER_Y_RATIO = 0.4;
  const DISTANCE_PENALTY_FACTOR = 0.1;
  const BRIGHTNESS_SCORE_WEIGHT = 0.7;
  const SKIN_TONE_SCORE_WEIGHT = 1000;

  const regions = [];
  for (let y = Math.floor(height * FACE_SCAN_REGION_TOP_RATIO); y < height * FACE_SCAN_REGION_BOTTOM_RATIO; y += FACE_REGION_STEP_PX) {
    for (let x = Math.floor(width * FACE_SCAN_REGION_LEFT_RATIO); x < width * FACE_SCAN_REGION_RIGHT_RATIO; x += FACE_REGION_STEP_PX) {
      let totalBrightness = 0;
      let skinToneCount = 0;
      let pixelCount = 0;
      for (let dy = 0; dy < FACE_REGION_SIZE_PX && y + dy < height; dy++) {
        for (let dx = 0; dx < FACE_REGION_SIZE_PX && x + dx < width; dx++) {
          const idx = ((y + dy) * width + (x + dx)) * 4;
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // Luma component
          totalBrightness += r * 0.299 + g * 0.587 + b * 0.114;
          pixelCount++;
          if (
            r > SKIN_R_MIN_THRESHOLD &&
            g > SKIN_G_MIN_THRESHOLD &&
            b > SKIN_B_MIN_THRESHOLD &&
            Math.max(r, g, b) - Math.min(r, g, b) > SKIN_RGB_DIFF_MIN_THRESHOLD &&
            Math.abs(r - g) > SKIN_RGB_DIFF_MIN_THRESHOLD &&
            r > g &&
            r > b
          ) {
            skinToneCount++;
          }
        }
      }
      const avgBrightness = totalBrightness / pixelCount;
      const skinToneRatio = skinToneCount / pixelCount;
      if (
        avgBrightness > MIN_BRIGHTNESS_THRESHOLD &&
        avgBrightness < MAX_BRIGHTNESS_THRESHOLD &&
        skinToneRatio > MIN_SKIN_TONE_RATIO_THRESHOLD
      ) {
        regions.push({
          x: x + FACE_REGION_SIZE_PX / 2,
          y: y + FACE_REGION_SIZE_PX / 2,
          brightness: avgBrightness,
          skinToneRatio,
        });
      }
    }
  }

  if (regions.length === 0) return null;

  const centerX = width / 2;
  const centerY = height * EXPECTED_FACE_CENTER_Y_RATIO;
  let bestScore = -Infinity;
  let bestRegion = null;
  for (const region of regions) {
    const score =
      region.brightness * BRIGHTNESS_SCORE_WEIGHT +
      region.skinToneRatio * SKIN_TONE_SCORE_WEIGHT -
      Math.hypot(region.x - centerX, region.y - centerY) * DISTANCE_PENALTY_FACTOR;
    if (score > bestScore) {
      bestScore = score;
      bestRegion = region;
    }
  }
  return bestRegion ? bestRegion.y : null;
}