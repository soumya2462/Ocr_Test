import cv from "@u4/opencv4nodejs";
import path from "path";
import enhancedOCRProcessor from './modules/ocr.js';
function isDuplicateRect(r1, r2, tolerance) {
  // Difference thresholds
  return (
    Math.abs(r1.x - r2.x) < tolerance &&
    Math.abs(r1.y - r2.y) < tolerance &&
    Math.abs(r1.width - r2.width) < tolerance &&
    Math.abs(r1.height - r2.height) < tolerance
  );
}

function filterDuplicateRects(contourData, tolerance = 15) {
  const unique = [];
  for (const contour of contourData) {
    if (!unique.some(c => isDuplicateRect(c.rect, contour.rect, tolerance))) {
      unique.push(contour);
    }
  }
  return unique;
}

async function cropPage(imagePath) {
  const outputDir = "output";
  let img = cv.imread(imagePath);

  // Convert to grayscale
  const gray = img.bgrToGray();

  // Threshold the image
  // const thresh = gray.threshold(50, 255, cv.THRESH_BINARY);
  const thresh = gray.adaptiveThreshold(
    255,
    cv.ADAPTIVE_THRESH_GAUSSIAN_C,
    cv.THRESH_BINARY_INV,
    11,
    2
  );

  // Find contours
  const contours = thresh.findContours(cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);
  console.log("Number of contours detected:", contours.length);
  const filteredContourData = [];
  for (const cnt of contours) {
    const approx = cnt.approxPolyDP(0.01 * cnt.arcLength(true), true);

    if (approx.length === 4) {
      const rect = cnt.boundingRect();
      const { width: w, height: h } = rect;
      const ratio = w / h;

      if (ratio > 2.43 && ratio < 2.49) {
        // Rectangle
        console.log("ratio", ratio);
        console.log("rect", rect);
        filteredContourData.push({approx, rect,contour: cnt,ratio});
        // img.putText("Rectangle", new cv.Point2(x, y), cv.FONT_HERSHEY_SIMPLEX, 0.6, new cv.Vec3(0, 255, 0), 2);
      }
    }
  }

  console.log("Filtered contours:", filteredContourData.length);
  const finalFilterDuplicateRects = filterDuplicateRects(filteredContourData,15);
  console.log("After removing duplicates:", finalFilterDuplicateRects.length);
  // const finalFilterDuplicateRects = filteredContourData;
  let idx = 0;
  for(const data of finalFilterDuplicateRects){
    // const {approx} = data;
    // img.drawContours([approx], -1, new cv.Vec3(0, 255, 0), 3);
    cv.imwrite(`${outputDir}/crop_${idx + 1}.png`,img.getRegion(data.rect));
    idx++;
  }

  // Show or save image
  // cv.imshow("Shapes", img);
  // cv.waitKey();
  // cv.destroyAllWindows();
}
async function getVoterData(croppedImagePath) {
    await enhancedOCRProcessor.initialize();
    // const voterBlocks = await enhancedOCRProcessor.detectVoterBlocks(croppedImagePath);

    const voterBlocks = await enhancedOCRProcessor.processVoterBlock({croppedImagePath,voterId:"YVY1435841",blockIndex:0});
    return (voterBlocks);
}

async function main() {
  const imagePath = path.resolve("page.png");
  cropPage(imagePath);
  for(let i=1;true;i++){
    const filePath = `output/crop_${i}.png`;
    if(cv.imread(filePath).empty) {
      console.log("No more cropped images found. Exiting.");
      break;
    }
    const voterResult = await getVoterData(filePath);
    console.log(voterResult);
  }
}
main();

// const lines = [
//       '[୮  ¶      Tiassa',
//       'ନାମ : ପୂର୍ଣ୍ଣିମା ବେହେରା',
//       'ସ୍ବାମୀଙ୍କ ନାମ: ସଂଜୟ ବେହେରା',
//       'ଘର ନଂ : ଧୂଆ ସାହି                            ଫଟୋ ଉପଲବ୍ଧ',
//       'ବୟସ: 37 ଲିଗଂ : ସ୍ତ୍ରୀ'
//     ];

// console.log(lines.join('\n'));