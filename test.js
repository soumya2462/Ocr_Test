const path = require('path');
const enhancedOCRProcessor = require('./modules/ocr.js'); 
async function main() {
    await enhancedOCRProcessor.initialize();
    const result = await enhancedOCRProcessor.testData(path.join(__dirname, 'snap.png'),"YVY1435841");
    console.log(result);
}
main();
// const lines = [
//       '[୮  ¶      Tiassa',
//       'ନାମ : ପୂର୍ଣ୍ଣିମା ବେହେରା',
//       'ସ୍ବାମୀଙ୍କ ନାମ: ସଂଜୟ ବେହେରା',
//       'ଘର ନଂ : ଧୂଆ ସାହି                            ଫଟୋ ଉପଲବ୍ଧ',
//       'QQ: 37 ଲିଗଂ : ସୀ'
//     ];

// // Extract patterns
//     const namePattern = /^(ନାମ|Name)/; // Odia script
//     const agePattern = /(?:ବୟସ|Age|ଆୟୁ)[\s:]*(\d+)/i;
//     const genderPattern = /(?:ଲିଂଗ|Gender|ଲିଙ୍ଗ)[\s:]*([ପୁମସ୍ତ୍ରୀ|MaleFemale|ପୁରୁଷମହିଳା]+)/i;
//     const housePattern = /(\d+)\s*(?:ନଂ|No|ନମ୍ବର)/i;
//     const guardianPattern = /(?:ପିତା|Father|ସ୍ୱାମୀ|Husband|ମାତା|Mother)[\s:]*([^\n]+)/i;

//     const extractedData = {};
//     const mergedLines = lines.join('\n'); // Merge lines to handle split information
    