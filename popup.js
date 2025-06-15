/*
// Popup.js - Head tracking for scrolling
const video = document.getElementById("webcam");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const sensitivitySlider = document.getElementById("sensitivity");
const scrollSpeedSlider = document.getElementById("scrollSpeed");
const sensitivityValue = document.getElementById("sensitivityValue");
const scrollSpeedValue = document.getElementById("scrollSpeedValue");

let isTracking = false;
let stream = null;
let animationId = null;
let canvas = null;
let ctx = null;

// Tracking variables
let calibrationData = [];
let baselineY = null;
let scrollLock = false;
let frameCount = 0;
let smoothedY = null;

// Settings
let MOVEMENT_THRESHOLD = 25;
let SCROLL_SPEED = 80;
const CALIBRATION_FRAMES = 90; // 3 seconds at 30fps
const SMOOTHING_FACTOR = 0.7;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  try {
    // Create canvas for image processing
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    
    updateStatus('Ready! Click Start to begin head tracking.', 'ready');
    startBtn.disabled = false;
    
    // Setup settings listeners
    setupSettings();
    
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus('Error: Failed to initialize. Please refresh the page.', 'error');
  }
}

function setupSettings() {
  sensitivitySlider.addEventListener('input', (e) => {
    MOVEMENT_THRESHOLD = parseInt(e.target.value);
    sensitivityValue.textContent = MOVEMENT_THRESHOLD;
  });
  
  scrollSpeedSlider.addEventListener('input', (e) => {
    SCROLL_SPEED = parseInt(e.target.value);
    scrollSpeedValue.textContent = SCROLL_SPEED;
  });
}

function updateStatus(message, type) {
  status.textContent = message;
  status.className = `status-${type}`;
}

async function startTracking() {
  try {
    updateStatus('Requesting camera access...', 'loading');
    
    // Get camera with good settings for face detection
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640, min: 320 },
        height: { ideal: 480, min: 240 },
        facingMode: 'user',
        frameRate: { ideal: 30, min: 15 }
      } 
    });
    
    video.srcObject = stream;
    video.style.display = 'block';
    
    // Wait for video to start
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = reject;
      setTimeout(() => reject(new Error('Video timeout')), 5000);
    });
    
    // Setup canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Reset tracking state
    isTracking = true;
    frameCount = 0;
    calibrationData = [];
    baselineY = null;
    smoothedY = null;
    scrollLock = false;
    
    // Update UI
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    stopBtn.disabled = false;
    
    updateStatus('Calibrating... Please look straight ahead and stay still.', 'loading');
    
    // Start detection loop
    detectMovement();
    
  } catch (error) {
    console.error('Camera error:', error);
    const errorMsg = error.name === 'NotAllowedError' 
      ? 'Camera access denied. Please allow camera access and try again.'
      : 'Failed to access camera. Please check your camera and try again.';
    updateStatus(errorMsg, 'error');
    stopTracking();
  }
}

function stopTracking() {
  isTracking = false;
  
  // Stop camera
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Cancel animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Reset UI
  video.style.display = 'none';
  startBtn.style.display = 'inline-block';
  stopBtn.style.display = 'none';
  startBtn.disabled = false;
  
  updateStatus('Stopped. Click Start to begin tracking again.', 'ready');
}

function detectMovement() {
  if (!isTracking) return;
  
  try {
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const faceY = detectFacePosition(imageData.data, canvas.width, canvas.height);
    
    if (faceY !== null) {
      // Apply smoothing
      if (smoothedY === null) {
        smoothedY = faceY;
      } else {
        smoothedY = (smoothedY * SMOOTHING_FACTOR) + (faceY * (1 - SMOOTHING_FACTOR));
      }
      
      frameCount++;
      
      // Calibration phase
      if (frameCount <= CALIBRATION_FRAMES) {
        calibrationData.push(smoothedY);
        
        // Update calibration status
        const progress = Math.round((frameCount / CALIBRATION_FRAMES) * 100);
        updateStatus(`Calibrating... ${progress}% complete`, 'loading');
        
        // Finish calibration
        if (frameCount === CALIBRATION_FRAMES) {
          // Calculate baseline from calibration data
          const sum = calibrationData.reduce((a, b) => a + b, 0);
          baselineY = sum / calibrationData.length;
          
          updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
          console.log('Calibration complete. Baseline Y:', baselineY);
        }
        
      } else {
        // Active tracking phase
        if (baselineY !== null && !scrollLock) {
          const deltaY = smoothedY - baselineY;
          
          if (Math.abs(deltaY) > MOVEMENT_THRESHOLD) {
            scrollLock = true;
            
            // Calculate scroll amount
            const scrollIntensity = Math.min(Math.abs(deltaY) / MOVEMENT_THRESHOLD, 4);
            const scrollAmount = Math.round(scrollIntensity * SCROLL_SPEED);
            const scrollDirection = deltaY > 0 ? scrollAmount : -scrollAmount;
            
            // Execute scroll
            executeScroll(scrollDirection);
            
            // Visual feedback
            const direction = deltaY > 0 ? 'DOWN' : 'UP';
            updateStatus(`Scrolling ${direction} (${Math.round(Math.abs(deltaY))}px)`, 'tracking');
            
            // Reset status after feedback
            setTimeout(() => {
              if (isTracking && frameCount > CALIBRATION_FRAMES) {
                updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
              }
            }, 800);
            
            // Unlock after delay
            setTimeout(() => {
              scrollLock = false;
            }, 500);
          }
        }
      }
    } else {
      // No face detected
      if (frameCount > CALIBRATION_FRAMES) {
        updateStatus('No face detected. Please position yourself in camera view.', 'error');
      }
    }
    
  } catch (error) {
    console.error('Detection error:', error);
    updateStatus('Detection error. Please try again.', 'error');
  }
  
  // Continue loop
  if (isTracking) {
    animationId = requestAnimationFrame(detectMovement);
  }
}

function detectFacePosition(data, width, height) {
  const regions = [];
  const regionSize = 30;
  const step = 15;
  
  // Analyze brightness in regions (focus on face area)
  for (let y = Math.floor(height * 0.15); y < height * 0.85; y += step) {
    for (let x = Math.floor(width * 0.25); x < width * 0.75; x += step) {
      let totalBrightness = 0;
      let skinToneCount = 0;
      let pixelCount = 0;
      
      // Sample pixels in this region
      for (let dy = 0; dy < regionSize && y + dy < height; dy++) {
        for (let dx = 0; dx < regionSize && x + dx < width; dx++) {
          const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];
          
          // Calculate brightness
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          totalBrightness += brightness;
          pixelCount++;
          
          // Check for skin-tone like colors
          if (r > 95 && g > 40 && b > 20 && 
              Math.max(r, g, b) - Math.min(r, g, b) > 15 &&
              Math.abs(r - g) > 15 && r > g && r > b) {
            skinToneCount++;
          }
        }
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      const skinToneRatio = skinToneCount / pixelCount;
      
      regions.push({
        x: x + regionSize / 2,
        y: y + regionSize / 2,
        brightness: avgBrightness,
        skinToneRatio: skinToneRatio,
        score: avgBrightness * 0.7 + skinToneRatio * 1000
      });
    }
  }
  
  // Find regions with face-like characteristics
  const faceRegions = regions.filter(region => 
    region.brightness > 60 && region.brightness < 220 && region.skinToneRatio > 0.1
  );
  
  if (faceRegions.length === 0) {
    return null;
  }
  
  // Find the best region (highest score, most central)
  const centerX = width / 2;
  const centerY = height * 0.4; // Face usually in upper-middle
  
  let bestRegion = faceRegions[0];
  let bestScore = -Infinity;
  
  for (const region of faceRegions) {
    const distanceFromCenter = Math.sqrt(
      Math.pow(region.x - centerX, 2) + Math.pow(region.y - centerY, 2)
    );
    
    // Combined score: face-like features minus distance penalty
    const finalScore = region.score - (distanceFromCenter * 0.1);
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestRegion = region;
    }
  }
  
  return bestRegion.y;
}

async function executeScroll(scrollAmount) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (amount) => {
        // Smooth scroll
        window.scrollBy({
          top: amount,
          behavior: 'smooth'
        });
      },
      args: [scrollAmount]
    });
    
  } catch (error) {
    console.error('Scroll error:', error);
    updateStatus('Cannot scroll this page. Try a different tab.', 'error');
    
    setTimeout(() => {
      if (isTracking && frameCount > CALIBRATION_FRAMES) {
        updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
      }
    }, 2000);
  }
}

// Event listeners
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (isTracking) stopTracking();
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isTracking) {
    // Pause tracking when popup is hidden
    console.log('Popup hidden, pausing tracking');
  }
});*/

// Popup.js - Head tracking for scrolling
const video = document.getElementById("webcam");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const status = document.getElementById("status");
const sensitivitySlider = document.getElementById("sensitivity");
const scrollSpeedSlider = document.getElementById("scrollSpeed");
const sensitivityValue = document.getElementById("sensitivityValue");
const scrollSpeedValue = document.getElementById("scrollSpeedValue");

let isTracking = false;
let stream = null;
let animationId = null;
let canvas = null;
let ctx = null;

// Tracking variables
let calibrationData = [];
let baselineY = null;
let scrollLock = false;
let frameCount = 0;
let smoothedY = null;

// Settings
const INITIAL_MOVEMENT_THRESHOLD = 25;
const INITIAL_SCROLL_SPEED = 80;
let MOVEMENT_THRESHOLD = INITIAL_MOVEMENT_THRESHOLD;
let SCROLL_SPEED = INITIAL_SCROLL_SPEED;

const CALIBRATION_FRAMES = 90; // 3 seconds at 30fps
const SMOOTHING_FACTOR = 0.7;

// Timeouts and Delays
const VIDEO_LOAD_TIMEOUT_MS = 5000;
const STATUS_RESET_DELAY_MS = 800;
const SCROLL_LOCK_RELEASE_DELAY_MS = 500;
const ERROR_STATUS_RESET_DELAY_MS = 2000;

// Face Detection Parameters (for detectFacePosition)
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
const EXPECTED_FACE_CENTER_Y_RATIO = 0.4; // Relative to canvas height
const DISTANCE_PENALTY_FACTOR = 0.1;
const BRIGHTNESS_SCORE_WEIGHT = 0.7;
const SKIN_TONE_SCORE_WEIGHT = 1000; // Skin tone is heavily weighted
const MAX_SCROLL_INTENSITY_MULTIPLIER = 4;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeApp);

function initializeApp() {
  try {
    // Create canvas for image processing
    canvas = document.createElement('canvas');
    ctx = canvas.getContext('2d');
    
    updateStatus('Ready! Click Start to begin head tracking.', 'ready');
    startBtn.disabled = false;
    
    // Set initial slider values display
    sensitivityValue.textContent = MOVEMENT_THRESHOLD;
    scrollSpeedValue.textContent = SCROLL_SPEED;

    // Setup settings listeners
    setupSettings();
    
  } catch (error) {
    console.error('Initialization error:', error);
    updateStatus('Error: Failed to initialize. Please refresh the page.', 'error');
  }
}

function setupSettings() {
  sensitivitySlider.addEventListener('input', (e) => {
    MOVEMENT_THRESHOLD = parseInt(e.target.value, 10);
    sensitivityValue.textContent = MOVEMENT_THRESHOLD;
  });
  
  scrollSpeedSlider.addEventListener('input', (e) => {
    SCROLL_SPEED = parseInt(e.target.value, 10);
    scrollSpeedValue.textContent = SCROLL_SPEED;
  });
}

function updateStatus(message, type) {
  status.textContent = message;
  status.className = `status-${type}`;
}

async function startTracking() {
  try {
    updateStatus('Requesting camera access...', 'loading');
    
    // Get camera with good settings for face detection
    stream = await navigator.mediaDevices.getUserMedia({ 
      video: { 
        width: { ideal: 640, min: 320 },
        height: { ideal: 480, min: 240 },
        facingMode: 'user',
        frameRate: { ideal: 30, min: 15 }
      } 
    });
    
    video.srcObject = stream;
    video.style.display = 'block';
    
    // Wait for video to start
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        video.play().then(resolve).catch(reject);
      };
      video.onerror = reject;
      setTimeout(() => reject(new Error('Video load timeout after 5s')), VIDEO_LOAD_TIMEOUT_MS);
    });
    
    // Setup canvas
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Reset tracking state
    isTracking = true;
    frameCount = 0;
    calibrationData = [];
    baselineY = null;
    smoothedY = null;
    scrollLock = false;
    
    // Update UI
    startBtn.style.display = 'none';
    stopBtn.style.display = 'inline-block';
    stopBtn.disabled = false;
    
    updateStatus('Calibrating... Please look straight ahead and stay still.', 'loading');
    
    // Start detection loop
    detectMovement();
    
  } catch (error) {
    console.error('Camera error:', error);
    const errorMsg = error.name === 'NotAllowedError' 
      ? 'Camera access denied. Please allow camera access and try again.'
      : 'Failed to access camera. Please check your camera and try again.';
    updateStatus(errorMsg, 'error');
    stopTracking();
  }
}

function stopTracking() {
  isTracking = false;
  
  // Stop camera
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
    stream = null;
  }
  
  // Cancel animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Reset UI
  video.style.display = 'none';
  startBtn.style.display = 'inline-block';
  stopBtn.style.display = 'none';
  startBtn.disabled = false;
  
  updateStatus('Stopped. Click Start to begin tracking again.', 'ready');
}

function detectMovement() {
  if (!isTracking) return;
  
  try {
    // Draw current video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Get image data
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const faceY = detectFacePosition(imageData.data, canvas.width, canvas.height);
    
    if (faceY !== null) {
      // Apply smoothing
      if (smoothedY === null) {
        smoothedY = faceY;
      } else {
        smoothedY = (smoothedY * SMOOTHING_FACTOR) + (faceY * (1 - SMOOTHING_FACTOR));
      }
      
      frameCount++;
      
      // Calibration phase
      if (frameCount <= CALIBRATION_FRAMES) {
        calibrationData.push(smoothedY);
        
        // Update calibration status
        const progress = Math.round((frameCount / CALIBRATION_FRAMES) * 100);
        updateStatus(`Calibrating... ${progress}% complete`, 'loading');
        
        // Finish calibration
        if (frameCount === CALIBRATION_FRAMES) {
          // Calculate baseline from calibration data
          const sum = calibrationData.reduce((a, b) => a + b, 0);
          baselineY = sum / calibrationData.length;
          
          updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
          console.log('Calibration complete. Baseline Y:', baselineY);
        }
        
      } else {
        // Active tracking phase
        if (baselineY !== null && !scrollLock) {
          const deltaY = smoothedY - baselineY;
          
          if (Math.abs(deltaY) > MOVEMENT_THRESHOLD) {
            scrollLock = true;
            
            // Calculate scroll amount
            const scrollIntensity = Math.min(Math.abs(deltaY) / MOVEMENT_THRESHOLD, MAX_SCROLL_INTENSITY_MULTIPLIER);
            const scrollAmount = Math.round(scrollIntensity * SCROLL_SPEED);
            const scrollDirection = deltaY > 0 ? scrollAmount : -scrollAmount;
            
            // Execute scroll
            executeScroll(scrollDirection);
            
            // Visual feedback
            const direction = deltaY > 0 ? 'DOWN' : 'UP';
            updateStatus(`Scrolling ${direction} (${Math.round(Math.abs(deltaY))}px)`, 'tracking');
            
            // Reset status after feedback
            setTimeout(() => {
              if (isTracking && frameCount > CALIBRATION_FRAMES) {
                updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
              }
            }, STATUS_RESET_DELAY_MS);
            
            // Unlock after delay
            setTimeout(() => {
              scrollLock = false;
            }, SCROLL_LOCK_RELEASE_DELAY_MS);
          }
        }
      }
    } else {
      // No face detected
      if (frameCount > CALIBRATION_FRAMES) {
        updateStatus('No face detected. Please position yourself in camera view.', 'error');
      }
    }
    
  } catch (error) {
    console.error('Detection error:', error);
    updateStatus('Detection error. Please try again.', 'error');
  }
  
  // Continue loop
  if (isTracking) {
    animationId = requestAnimationFrame(detectMovement);
  }
}

function detectFacePosition(data, width, height) {
  const regions = [];
  
  // Analyze brightness in regions (focus on face area)
  for (let y = Math.floor(height * FACE_SCAN_REGION_TOP_RATIO); y < height * FACE_SCAN_REGION_BOTTOM_RATIO; y += FACE_REGION_STEP_PX) {
    for (let x = Math.floor(width * FACE_SCAN_REGION_LEFT_RATIO); x < width * FACE_SCAN_REGION_RIGHT_RATIO; x += FACE_REGION_STEP_PX) {
      let totalBrightness = 0;
      let skinToneCount = 0;
      let pixelCount = 0;
      
      // Sample pixels in this region
      for (let dy = 0; dy < FACE_REGION_SIZE_PX && y + dy < height; dy++) {
        for (let dx = 0; dx < FACE_REGION_SIZE_PX && x + dx < width; dx++) {
          const pixelIndex = ((y + dy) * width + (x + dx)) * 4;
          const r = data[pixelIndex];
          const g = data[pixelIndex + 1];
          const b = data[pixelIndex + 2];
          
          // Calculate brightness
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          totalBrightness += brightness;
          pixelCount++;
          
          // Check for skin-tone like colors
          if (r > SKIN_R_MIN_THRESHOLD && g > SKIN_G_MIN_THRESHOLD && b > SKIN_B_MIN_THRESHOLD &&
              Math.max(r, g, b) - Math.min(r, g, b) > SKIN_RGB_DIFF_MIN_THRESHOLD &&
              Math.abs(r - g) > SKIN_RGB_DIFF_MIN_THRESHOLD && r > g && r > b) {
            skinToneCount++;
          }
        }
      }
      
      const avgBrightness = totalBrightness / pixelCount;
      const skinToneRatio = skinToneCount / pixelCount;
      
      regions.push({
        x: x + FACE_REGION_SIZE_PX / 2,
        y: y + FACE_REGION_SIZE_PX / 2,
        brightness: avgBrightness,
        skinToneRatio: skinToneRatio,
        score: avgBrightness * BRIGHTNESS_SCORE_WEIGHT + skinToneRatio * SKIN_TONE_SCORE_WEIGHT
      });
    }
  }
  
  // Find regions with face-like characteristics
  const faceRegions = regions.filter(region => 
    region.brightness > MIN_BRIGHTNESS_THRESHOLD && region.brightness < MAX_BRIGHTNESS_THRESHOLD && region.skinToneRatio > MIN_SKIN_TONE_RATIO_THRESHOLD
  );
  
  if (faceRegions.length === 0) {
    return null;
  }
  
  // Find the best region (highest score, biased towards an expected central face position)
  const centerX = width / 2; // Geometrical center X
  const centerY = height * EXPECTED_FACE_CENTER_Y_RATIO; // Expected Y position of face (e.g., upper-middle)
  
  let bestRegion = faceRegions[0];
  let bestScore = -Infinity;
  
  for (const region of faceRegions) {
    const distanceFromCenter = Math.sqrt(
      Math.pow(region.x - centerX, 2) + Math.pow(region.y - centerY, 2)
    );
    
    // Combined score: face-like features minus distance penalty
    const finalScore = region.score - (distanceFromCenter * DISTANCE_PENALTY_FACTOR);
    
    if (finalScore > bestScore) {
      bestScore = finalScore;
      bestRegion = region;
    }
  }
  
  return bestRegion.y;
}

async function executeScroll(scrollAmount) {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (!tab) {
      throw new Error('No active tab found');
    }
    
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: (amount) => {
        // Smooth scroll
        window.scrollBy({
          top: amount,
          behavior: 'smooth'
        });
      },
      args: [scrollAmount]
    });
    
  } catch (error) {
    console.error('Scroll error:', error);
    updateStatus('Cannot scroll this page. Try a different tab.', 'error');
    
    setTimeout(() => {
      if (isTracking && frameCount > CALIBRATION_FRAMES) {
        updateStatus('Tracking active! Move your head up/down to scroll.', 'tracking');
      }
    }, ERROR_STATUS_RESET_DELAY_MS);
  }
}

// Event listeners
startBtn.addEventListener('click', startTracking);
stopBtn.addEventListener('click', stopTracking);

// Cleanup on popup close
window.addEventListener('beforeunload', () => {
  if (isTracking) stopTracking();
});

// Handle popup visibility changes
document.addEventListener('visibilitychange', () => {
  if (document.hidden && isTracking) {
    // Pause tracking when popup is hidden
    console.log('Popup hidden, pausing tracking');
    // Consider actually pausing the requestAnimationFrame loop here if needed,
    // though for popups, 'beforeunload' often covers cleanup.
  }
});
