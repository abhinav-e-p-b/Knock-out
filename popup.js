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
    
    // Check if we're in a secure context
    if (!window.isSecureContext) {
      updateStatus('Error: Camera requires HTTPS. Extension must be loaded properly.', 'error');
      return;
    }
    
    // Check for getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      updateStatus('Error: Camera not supported in this browser.', 'error');
      return;
    }
    
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
    
    // First check if camera permissions are available
    let permissionStatus;
    try {
      permissionStatus = await navigator.permissions.query({ name: 'camera' });
      console.log('Camera permission status:', permissionStatus.state);
    } catch (permErr) {
      console.log('Permission query not supported, proceeding with getUserMedia');
    }
    
    // Progressive fallback for camera constraints
    const constraints = [
      // Try ideal constraints first
      { 
        video: { 
          width: { ideal: 640, min: 320 },
          height: { ideal: 480, min: 240 },
          facingMode: 'user',
          frameRate: { ideal: 30, min: 15 }
        } 
      },
      // Fallback to simpler constraints
      { 
        video: { 
          width: 640,
          height: 480,
          facingMode: 'user'
        } 
      },
      // Basic constraints
      { 
        video: {
          facingMode: 'user'
        }
      },
      // Most basic - just video
      { video: true }
    ];
    
    let streamObtained = false;
    let lastError = null;
    
    for (const constraint of constraints) {
      try {
        console.log('Trying constraint:', constraint);
        stream = await navigator.mediaDevices.getUserMedia(constraint);
        streamObtained = true;
        console.log('Successfully obtained stream with constraint:', constraint);
        break;
      } catch (err) {
        console.log('Constraint failed:', constraint, 'Error:', err);
        lastError = err;
        continue;
      }
    }
    
    if (!streamObtained) {
      throw lastError || new Error('Failed to obtain camera stream');
    }
    
    video.srcObject = stream;
    video.style.display = 'block';
    
    // Wait for video to start with better error handling
    await new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Video load timeout - camera may be in use by another application'));
      }, 8000);
      
      video.onloadedmetadata = () => {
        clearTimeout(timeoutId);
        console.log('Video metadata loaded:', video.videoWidth, 'x', video.videoHeight);
        video.play()
          .then(() => {
            console.log('Video started playing');
            resolve();
          })
          .catch(reject);
      };
      
      video.onerror = (err) => {
        clearTimeout(timeoutId);
        console.error('Video error:', err);
        reject(new Error('Video failed to load'));
      };
      
      // Also handle the case where metadata is already loaded
      if (video.readyState >= 1) {
        clearTimeout(timeoutId);
        video.play().then(resolve).catch(reject);
      }
    });
    
    // Verify video dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      throw new Error('Video stream has invalid dimensions');
    }
    
    // Setup canvas with actual video dimensions
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    console.log('Canvas setup:', canvas.width, 'x', canvas.height);
    
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

    console.error('Camera error details:', error.name, error.message);

    updateStatus(`Camera error: ${error.name} - ${error.message}`, 'error');

    
    let errorMsg = 'Failed to access camera. ';
    
    // Provide specific error messages
    if (error.name === 'NotAllowedError') {
      errorMsg += 'Please allow camera access and try again.';
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      errorMsg += 'No camera found. Please connect a camera.';
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      errorMsg += 'Camera is already in use by another application.';
    } else if (error.name === 'OverconstrainedError' || error.name === 'ConstraintNotSatisfiedError') {
      errorMsg += 'Camera does not meet requirements.';
    } else if (error.name === 'NotSupportedError') {
      errorMsg += 'Camera not supported in this browser.';
    } else if (error.name === 'AbortError') {
      errorMsg += 'Camera access was aborted.';
    } else if (error.message.includes('timeout')) {
      errorMsg += 'Camera took too long to respond. It may be in use.';
    } else {
      errorMsg += `Unknown error: ${error.message}`;
    }
    
    updateStatus(errorMsg, 'error');
    stopTracking();
  }
}

function stopTracking() {
  isTracking = false;
  
  // Stop camera
  if (stream) {
    stream.getTracks().forEach(track => {
      console.log('Stopping track:', track.kind, track.label);
      track.stop();
    });
    stream = null;
  }
  
  // Cancel animation loop
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  
  // Reset UI
  video.style.display = 'none';
  video.srcObject = null;
  startBtn.style.display = 'inline-block';
  stopBtn.style.display = 'none';
  startBtn.disabled = false;
  
  updateStatus('Stopped. Click Start to begin tracking again.', 'ready');
}

function detectMovement() {
  if (!isTracking || !video || video.readyState < 2) {
    if (isTracking) {
      animationId = requestAnimationFrame(detectMovement);
    }
    return;
  }
  
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
          if (pixelIndex + 3 < data.length) {
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
      }
      
      if (pixelCount > 0) {
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
});