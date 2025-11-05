# Knock-out
Lazy of scrolling down. Knock your head up &amp; down to scroll through webpages.
# Head Knock Scroll 🎯

> Tired of scrolling? Just knock your head up and down!

A Chrome extension that lets you scroll through webpages using head movements detected via your webcam. No hands needed – just nod your way through content.

## Features

- 🎥 **Webcam-based head tracking** - Uses your camera to detect head movements
- 🚀 **Smart face detection** - Multiple detection methods for best performance:
  - Native FaceDetector API (GPU-accelerated when available)
  - Web Worker-based fallback for older browsers
  - Efficient pixel-based detection as final fallback
- 📏 **Calibration system** - Automatically calibrates to your neutral head position
- ⚙️ **Adjustable settings** - Customize sensitivity and scroll speed
- 🎯 **Smooth scrolling** - Natural, fluid page scrolling
- ⚡ **Performance optimized** - Down-sampled video processing for efficiency

## How It Works

1. Click "Start Tracking" to activate your webcam
2. Look straight ahead during the 3-second calibration phase
3. Move your head up to scroll down, down to scroll up
4. Adjust sensitivity and speed to your preference

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/head-knock-scroll.git
   cd head-knock-scroll
   ```

2. Install dependencies and build:
   ```bash
   npm install
   npm run build
   ```

3. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `head-knock-scroll` directory

### Files Structure

```
head-knock-scroll/
├── manifest.json          # Extension configuration
├── popup.html            # Extension popup UI
├── popup.js              # Main tracking logic
├── popup.bundle.js       # Minified build output
├── detectorWorker.js     # Web Worker for face detection
└── package.json          # Build configuration
```

## Usage

1. Click the extension icon in your Chrome toolbar
2. Grant camera permissions when prompted
3. Click "Start Tracking"
4. Wait for calibration to complete (~3 seconds)
5. Start scrolling with head movements!

### Tips for Best Results

- Ensure good lighting conditions
- Position yourself centrally in the camera view
- Keep your upper body relatively still while moving your head
- Adjust sensitivity if the scrolling is too sensitive or not responsive enough
- Adjust scroll speed for faster or slower page movement

## Configuration

The extension provides two adjustable settings:

- **Sensitivity** (10-50): Controls how much head movement is needed to trigger scrolling
  - Lower values = more sensitive (less movement needed)
  - Higher values = less sensitive (more movement needed)

- **Scroll Speed** (20-150): Controls how fast the page scrolls
  - Lower values = slower scrolling
  - Higher values = faster scrolling

## Technical Details

### Performance Optimizations

- **Video down-sampling**: Processes video at 30% resolution for 10x faster analysis
- **requestVideoFrameCallback**: Uses modern API for efficient frame processing
- **Web Worker**: Offloads face detection to separate thread when available
- **Smart fallbacks**: Multiple detection methods ensure compatibility

### Detection Methods (Priority Order)

1. **FaceDetector API** - Hardware-accelerated, fastest (Chrome/Edge)
2. **Web Worker detection** - Threaded pixel analysis, no UI blocking
3. **Synchronous detection** - Fallback for all browsers

### Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Edge
- ⚠️ Other browsers (may have limited performance)

## Development

### Build Commands

```bash
# Install dependencies
npm install

# Build minified version
npm run build

# Development (edit popup.js directly, no build needed for testing)
```

### Requirements

- Node.js 12+
- npm or yarn
- Chrome/Chromium browser

## Permissions

The extension requires:

- **Camera access**: To detect head movements
- **Active tab**: To scroll the current webpage
- **Scripting**: To inject scroll commands

Your privacy is important – all video processing happens locally in your browser. No data is sent to external servers.

## Troubleshooting

**Camera not working?**
- Check browser permissions for camera access
- Ensure no other application is using the camera
- Try refreshing the extension

**Scrolling not responsive?**
- Adjust sensitivity slider to lower value
- Ensure good lighting
- Check that your face is clearly visible in the frame

**Extension not loading?**
- Rebuild the extension: `npm run build`
- Reload the extension in `chrome://extensions/`
- Check console for error messages

## Known Limitations

- Works best on regular webpages (may not work on Chrome internal pages)
- Requires decent lighting conditions
- Camera must be positioned to see your face
- Some websites with scroll hijacking may not work properly

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is open source and available under the [MIT License](LICENSE).

## Acknowledgments

- Inspired by hands-free browsing needs
- Built with modern web APIs for optimal performance
- Thanks to the Chrome Extensions API team

## Support

If you encounter any issues or have suggestions, please [open an issue](https://github.com/yourusername/head-knock-scroll/issues) on GitHub.

---

Made with 💻 and 🎥 for hands-free browsing