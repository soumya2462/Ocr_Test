import cv from "@u4/opencv4nodejs";
import fs from "fs";

// Input and output paths
const inputPath = "page.png";
const outputDir = "output";

// Create output directory if not exists
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

// Read image
const image = cv.imread(inputPath);
const gray = image.bgrToGray();
const blurred = gray.gaussianBlur(new cv.Size(5, 5), 0);

// Edge detection
const edged = blurred.canny(50, 200);

// Find contours
const contours = edged.findContours(
  cv.RETR_EXTERNAL,
  cv.CHAIN_APPROX_SIMPLE
);

// Filter rectangular contours
const boxes = contours
  .map(c => c.boundingRect())
  // .filter(r => r.width > 100 && r.height > 100) // ignore noise
  .sort((a, b) => (a.y === b.y ? a.x - b.x : a.y - b.y)); // sort top-left order
console.log(boxes);
// Crop each detected box
boxes.forEach((rect, idx) => {
  const roi = image.getRegion(new cv.Rect(rect.x, rect.y, rect.width, rect.height));
  cv.imwrite(`${outputDir}/crop_${idx + 1}.png`, roi);
  console.log(`✅ Saved crop_${idx + 1}.png`, rect);
});

console.log(`✅ Done! ${boxes.length} blocks detected and cropped.`);
