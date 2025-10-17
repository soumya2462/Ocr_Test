const path = require('path');
const enhancedOCRProcessor = require('./modules/ocr.js'); 
async function main() {
    await enhancedOCRProcessor.initialize();
    const voterBlocks = await enhancedOCRProcessor.detectVoterBlocks(path.join(__dirname, 'page.png'));

    // const result = await enhancedOCRProcessor.processVoterBlock({croppedImagePath:path.join(__dirname, 'snap.png'),voterId:"YVY1435841",blockIndex:0});
    console.log(voterBlocks);
}
main();
// const lines = [
//       '[୮  ¶      Tiassa',
//       'ନାମ : ପୂର୍ଣ୍ଣିମା ବେହେରା',
//       'ସ୍ବାମୀଙ୍କ ନାମ: ସଂଜୟ ବେହେରା',
//       'ଘର ନଂ : ଧୂଆ ସାହି                            ଫଟୋ ଉପଲବ୍ଧ',
//       'ବୟସ: 37 ଲିଗଂ : ସୀ'
//     ];

// // Extract patterns
//     const namePattern = /^(ନାମ|Name)/; // Odia script
//     const agePattern = /(?:ବୟସ|Age|ଆୟୁ)[\s:]*(\d+)/i;
//     const genderPattern = /(?:ଲିଂଗ|Gender|ଲିଙ୍ଗ)[\s:]*([ପୁମସ୍ତ୍ରୀ|MaleFemale|ପୁରୁଷମହିଳା]+)/i;
//     const housePattern = /(\d+)\s*(?:ନଂ|No|ନମ୍ବର)/i;
//     const guardianPattern = /(?:ପିତା|Father|ସ୍ୱାମୀ|Husband|ମାତା|Mother)[\s:]*([^\n]+)/i;

//     const extractedData = {};
//     const mergedLines = lines.join('\n'); // Merge lines to handle split information
    

// 300
// 298
// 297
// 296
// 295
// 294
// 292
// 291
// 290
// 289
// 288
// 286
// 288
