const { createWorker } = require('tesseract.js');
const { fromPath } = require('pdf2pic');
const fs = require('fs').promises;
const path = require('path');
const pdfParse = require('pdf-parse');
const sharp = require('sharp');

class EnhancedOCRProcessor {
  constructor() {
    this.worker = null;
    this.blockDetector = null;
  }

  async initialize() {
    if (this.worker) return;

    console.log('🔧 Initializing Tesseract workers for Odia...');
    
    // Main OCR worker
    this.worker = await createWorker([ 'ori'], 1, {
      logger: m => {
        if (m.status === 'recognizing text') {
          process.stdout.write(`\r  OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });

    await this.worker.setParameters({
      tessedit_pageseg_mode: '6',
      preserve_interword_spaces: '1',
      tessedit_enable_doc_dict: '0',
      textord_heavy_nr: '1',
      textord_min_linesize: '1.5'
    });

    // Block detection worker (fast scan)
    this.blockDetector = await createWorker(['eng', 'ori'], 1);
    await this.blockDetector.setParameters({
      tessedit_pageseg_mode: '1', // Auto with OSD (Orientation and Script Detection)
      preserve_interword_spaces: '1',
      tessedit_ocr_engine_mode: '1' // Neural nets LSTM engine
    });

    console.log('✅ Tesseract workers initialized');
  }

  async convertPdfToImages(pdfPath, outputDir) {
    console.log('📄 Converting PDF to images...');
    await fs.mkdir(outputDir, { recursive: true });

    const options = {
      density: 400,
      saveFilename: 'page',
      savePath: outputDir,
      format: 'png',
      width: 3300,
      height: 4676
    };

    const convert = fromPath(pdfPath, options);
    const pageCount = await this.getPdfPageCount(pdfPath);
    const imagePaths = [];

    for (let i = 1; i <= pageCount; i++) {
      try {
        const result = await convert(i, { responseType: 'image' });
        const preprocessedPath = await this.preprocessImageForOdia(result.path);
        imagePaths.push(preprocessedPath);
        console.log(`✅ Converted page ${i}/${pageCount}`);
      } catch (error) {
        console.error(`❌ Error converting page ${i}:`, error.message);
      }
    }

    return imagePaths;
  }

  async preprocessImageForOdia(imagePath) {
    const outputPath = imagePath.replace('.png', '_processed.png');
    const debugPath = imagePath.replace('.png', '_debug.png');
    
    try {
      // Try lighter preprocessing that preserves more information
      const image = sharp(imagePath);
      const metadata = await image.metadata();
      
      console.log(`  Image: ${metadata.width}x${metadata.height}`);
      
      // Lighter preprocessing
      await image
        .greyscale()
        .normalise() // Auto contrast
        .sharpen({ sigma: 0.8 })
        .threshold(128) // Binary threshold
        .toFile(outputPath);
      
      // Also save a high-contrast version for debugging
      await sharp(imagePath)
        .greyscale()
        .normalise()
        .linear(1.5, -(128 * 0.5))
        .toFile(debugPath);
      
      console.log(`  Preprocessed: ${path.basename(outputPath)}`);
      return outputPath;
    } catch (error) {
      console.warn('Preprocessing failed, using original:', error.message);
      return imagePath;
    }
  }

  async getPdfPageCount(pdfPath) {
    const dataBuffer = await fs.readFile(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.numpages;
  }

  // Step 1: Detect voter blocks in the full page image
  async detectVoterBlocks(imagePath) {
    await this.initialize();
    console.log(`🔍 Detecting voter blocks in: ${path.basename(imagePath)}`);
    
    // Try with processed image first
    let { data } = await this.blockDetector.recognize(imagePath);
    
    console.log(`  OCR detected: ${data.words?.length || 0} words, ${data.lines?.length || 0} lines`);
    
    // If OCR failed completely, try with the original unprocessed image
    if ((data.words?.length || 0) === 0) {
      console.log('  🔄 Retrying with original unprocessed image...');
      const originalPath = imagePath.replace('_processed.png', '.png').replace('_debug.png', '.png');
      if (originalPath !== imagePath) {
        const result = await this.blockDetector.recognize(originalPath);
        data = result.data;
        console.log(`  Retry detected: ${data.words?.length || 0} words, ${data.lines?.length || 0} lines`);
      }
    }
    
    // Try OCR-based detection first
    let voterBlocks = this.findVoterBlockBoundaries(data);
    
    // Fallback 1: If no voter IDs detected, try visual structure detection
    if (voterBlocks.length === 0 && data.lines?.length > 0) {
      console.log('  📐 Falling back to visual structure detection...');
      voterBlocks = await this.detectBlocksByVisualStructure(imagePath, data);
    }
    
    // Fallback 2: If OCR completely failed, use grid-based detection
    if (voterBlocks.length === 0) {
      console.log('  🔲 OCR failed, using grid-based detection...');
      voterBlocks = await this.detectBlocksByGrid(imagePath);
    }
    
    console.log(`  ✅ Found ${voterBlocks.length} voter blocks`);
    return voterBlocks;
  }

  // Fallback: Detect blocks by grid structure (when OCR fails completely)
  async detectBlocksByGrid(imagePath) {
    console.log('  📐 Using grid-based detection...');
    
    const metadata = await sharp(imagePath).metadata();
    const { width, height } = metadata;
    
    // Based on the image layout: 3 columns per page
    const cols = 3;
    const margin = Math.floor(width * 0.02); // 2% margin
    const colWidth = Math.floor((width - (margin * 4)) / cols);
    const rowHeight = 200; // Approximate height per row
    const rows = Math.floor((height - margin * 2) / rowHeight);
    
    console.log(`  Grid: ${cols} cols × ~${rows} rows (${colWidth}x${rowHeight}px per cell)`);
    
    const blocks = [];
    let blockIndex = 0;
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = margin + (col * (colWidth + margin));
        const y = margin + (row * rowHeight);
        
        // Skip if outside image bounds
        if (y + rowHeight > height) continue;
        
        blocks.push({
          voterId: `GRID_${blockIndex + 1}`,
          blockIndex: blockIndex++,
          boundary: {
            x,
            y,
            width: colWidth,
            height: rowHeight
          },
          referenceWord: { bbox: { y0: y, x0: x } },
          confidence: 70
        });
      }
    }
    
    console.log(`  Generated ${blocks.length} grid blocks`);
    return blocks;
  }

  // Fallback: Detect blocks by visual structure (lines/spacing)
  async detectBlocksByVisualStructure(imagePath, ocrData) {
    const lines = ocrData.lines || [];
    if (lines.length === 0) return [];
    
    console.log(`  Analyzing ${lines.length} text lines for structure...`);
    
    // Group lines into blocks based on vertical spacing
    const blocks = [];
    let currentBlock = null;
    const spaceThreshold = 40; // Pixels between blocks
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineY = line.bbox.y0;
      
      if (!currentBlock) {
        currentBlock = {
          lines: [line],
          minY: lineY,
          maxY: line.bbox.y1,
          minX: line.bbox.x0,
          maxX: line.bbox.x1
        };
      } else {
        const gap = lineY - currentBlock.maxY;
        
        if (gap < spaceThreshold) {
          // Same block
          currentBlock.lines.push(line);
          currentBlock.maxY = Math.max(currentBlock.maxY, line.bbox.y1);
          currentBlock.minX = Math.min(currentBlock.minX, line.bbox.x0);
          currentBlock.maxX = Math.max(currentBlock.maxX, line.bbox.x1);
        } else {
          // New block
          blocks.push(currentBlock);
          currentBlock = {
            lines: [line],
            minY: lineY,
            maxY: line.bbox.y1,
            minX: line.bbox.x0,
            maxX: line.bbox.x1
          };
        }
      }
    }
    
    if (currentBlock) blocks.push(currentBlock);
    
    console.log(`  Grouped into ${blocks.length} structural blocks`);
    
    // Convert to voter block format
    return blocks.map((block, index) => {
      const text = block.lines.map(l => l.text).join(' ');
      const voterIdMatch = text.match(/[A-Z]{3}\d{7}|[A-Z]{2,4}\d{6,8}/);
      const voterId = voterIdMatch ? voterIdMatch[0] : `BLOCK_${index + 1}`;
      
      return {
        voterId,
        blockIndex: index,
        boundary: {
          x: block.minX,
          y: block.minY,
          width: block.maxX - block.minX,
          height: block.maxY - block.minY
        },
        referenceWord: { bbox: { y0: block.minY, x0: block.minX } },
        confidence: 75
      };
    });
  }

  findVoterBlockBoundaries(data) {
    const voterBlocks = [];
    const words = data.words || [];
    
    // More flexible pattern for voter ID (e.g., YVY1478155, ABC1234567)
    const voterIdPattern = /[A-Z]{3}\d{7}/;
    const relaxedPattern = /[A-Z]{2,4}\d{6,8}/; // Backup pattern
    
    console.log(`  Total words detected: ${words.length}`);
    
    // Try to find voter IDs with progressive pattern matching
    let voterIdCandidates = [];
    
    for (const word of words) {
      const cleanText = word.text.replace(/\s+/g, '').replace(/[^A-Z0-9]/gi, '').toUpperCase();
      
      // Debug: Log potential IDs
      if (cleanText.length >= 8 && /[A-Z]/.test(cleanText) && /\d/.test(cleanText)) {
        console.log(`  Candidate: "${word.text}" -> "${cleanText}"`);
      }
      
      // Exact match
      if (voterIdPattern.test(cleanText)) {
        voterIdCandidates.push({ word, voterId: cleanText, confidence: word.confidence });
      }
      // Relaxed match for backup
      else if (relaxedPattern.test(cleanText)) {
        voterIdCandidates.push({ word, voterId: cleanText, confidence: word.confidence * 0.8 });
      }
    }
    
    // Also try combining adjacent words (sometimes voter IDs split)
    for (let i = 0; i < words.length - 1; i++) {
      const combined = (words[i].text + words[i + 1].text).replace(/\s+/g, '').toUpperCase();
      if (voterIdPattern.test(combined)) {
        const avgConfidence = (words[i].confidence + words[i + 1].confidence) / 2;
        voterIdCandidates.push({
          word: words[i], // Use first word as anchor
          voterId: combined,
          confidence: avgConfidence * 0.9
        });
      }
    }
    
    // Sort by confidence and deduplicate
    voterIdCandidates.sort((a, b) => b.confidence - a.confidence);
    const seen = new Set();
    const uniqueVoterIds = voterIdCandidates.filter(c => {
      if (seen.has(c.voterId)) return false;
      seen.add(c.voterId);
      return true;
    });

    console.log(`  Detected ${uniqueVoterIds.length} voter IDs`);

    for (let i = 0; i < uniqueVoterIds.length; i++) {
      const candidate = uniqueVoterIds[i];
      const nextCandidate = uniqueVoterIds[i + 1];
      
      // Calculate block boundary
      const blockBoundary = this.calculateBlockBoundary(
        candidate.word,
        nextCandidate?.word,
        words,
        data.height
      );
      
      voterBlocks.push({
        voterId: candidate.voterId,
        blockIndex: i,
        boundary: blockBoundary,
        referenceWord: candidate.word,
        confidence: candidate.confidence
      });
    }

    return voterBlocks;
  }

  calculateBlockBoundary(currentVoterWord, nextVoterWord, allWords, imageHeight) {
    const currentY = currentVoterWord.bbox.y0;
    const blockHeight = 150; // Default block height in pixels
    const margin = 10; // Margin around the block
    
    // Find the leftmost and rightmost words in this block's row
    const rowWords = allWords.filter(w => 
      Math.abs(w.bbox.y0 - currentY) < 30
    );
    
    const minX = Math.min(...rowWords.map(w => w.bbox.x0), currentVoterWord.bbox.x0);
    const maxX = Math.max(...rowWords.map(w => w.bbox.x1), currentVoterWord.bbox.x1);
    
    // Calculate vertical boundary
    let bottomY;
    if (nextVoterWord) {
      // If there's a next voter, stop before it
      bottomY = Math.min(nextVoterWord.bbox.y0 - margin, currentY + blockHeight);
    } else {
      // Last voter on page
      bottomY = Math.min(currentY + blockHeight, imageHeight);
    }
    
    // Find words in the vertical range to determine actual block extent
    const blockWords = allWords.filter(w => 
      w.bbox.y0 >= (currentY - margin) && 
      w.bbox.y0 <= bottomY
    );
    
    if (blockWords.length > 0) {
      const actualMaxY = Math.max(...blockWords.map(w => w.bbox.y1));
      bottomY = Math.min(actualMaxY + margin, bottomY);
    }
    
    return {
      x: Math.max(0, minX - margin),
      y: Math.max(0, currentY - margin),
      width: (maxX - minX) + (2 * margin),
      height: (bottomY - currentY) + margin
    };
  }

  // Step 2: Crop individual voter blocks
  async cropVoterBlocks(imagePath, voterBlocks, outputDir) {
    console.log(`✂️  Cropping ${voterBlocks.length} voter blocks...`);
    await fs.mkdir(outputDir, { recursive: true });
    
    const croppedPaths = [];
    
    for (const block of voterBlocks) {
      try {
        const outputPath = path.join(
          outputDir,
          `block_${block.blockIndex}_${block.voterId}.png`
        );
        
        await sharp(imagePath)
          .extract({
            left: Math.round(block.boundary.x),
            top: Math.round(block.boundary.y),
            width: Math.round(block.boundary.width),
            height: Math.round(block.boundary.height)
          })
          .greyscale()
          .normalize()
          .sharpen({ sigma: 1.0 })
          .toFile(outputPath);
        
        croppedPaths.push({
          ...block,
          croppedImagePath: outputPath
        });
        
        console.log(`  ✅ Cropped block ${block.blockIndex + 1}: ${block.voterId}`);
      } catch (error) {
        console.error(`  ❌ Failed to crop block ${block.blockIndex}:`, error.message);
      }
    }
    
    return croppedPaths;
  }

  async testData(imagePath,voterId) {
    const { data } = await this.worker.recognize(imagePath);
    
    // Extract structured data from the block
    const extractedData = this.extractKeyValues(data.text);
    
    return {
      // blockIndex: blockInfo.blockIndex,
      voterId: voterId,
      confidence: data.confidence,
      rawText: data.text,
      structured: extractedData,
      // boundary: blockInfo.boundary,
      // croppedImagePath: blockInfo.croppedImagePath
    };
  }

  // Step 3: Process each cropped block individually
  async processVoterBlock(blockInfo) {
    console.log(`📝 OCR on block ${blockInfo.blockIndex + 1}: ${blockInfo.voterId}`);
    
    const { data } = await this.worker.recognize(blockInfo.croppedImagePath);
    
    // Extract structured data from the block
    const extractedData = this.extractVoterData(data, blockInfo.voterId);
    
    return {
      blockIndex: blockInfo.blockIndex,
      voterId: blockInfo.voterId,
      confidence: data.confidence,
      rawText: data.text,
      structured: extractedData,
      boundary: blockInfo.boundary,
      croppedImagePath: blockInfo.croppedImagePath
    };
  }

  extractKeyValues(inputText) {
    const result = {};
    const keys = [
        ["name","ନାମ", "Name"],
        ["age","ବୟସ", "Age"],
        ["gender","ଲିଗଂ", "ଲିଂଗ", "Gender"],
        ["houseNo","ଘର ନଂ", "House No", "ଘର ନମ୍ବର"],
        ["guardianName","ସ୍ବାମୀଙ୍କ ନାମ", "Husband Name", "ସ୍ୱାମୀ", "Husband", "ପିତାଙ୍କ ନାମ", "Father Name", "ମାତାଙ୍କ ନାମ", "Mother Name"],
    ];

    // Flatten all key alternatives for the lookahead pattern
    const allKeyAlternatives = keys.flatMap(key =>
        Array.isArray(key) ? key : [key]
    );

    keys.forEach((key) => {
        let keyPattern, keyName;

        if (Array.isArray(key)) {
            // If key is an array, create alternation pattern (key1|key2|key3)
            keyPattern = key
                .map(k => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
                .join("|");
            // Find the matched key in the input text
            const matchedKey = key.find(k => {
                const regex = new RegExp(`(?:${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})\\s*:`, "i");
                return regex.test(inputText);
            });
            keyName = key[0];
        } else {
            // Single key
            keyPattern = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            keyName = key;
        }

        // Create lookahead pattern that includes all possible key alternatives
        const nextKeyPattern = allKeyAlternatives
            .map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
            .join("|");

        // Match the key, optional spaces/newlines, colon, and capture value until next key or end
        const regex = new RegExp(
            `(?:${keyPattern})\\s*:\\s*(.+?)(?=\\s*(?:${nextKeyPattern})\\s*:|$)`,
            "is"
        );
        const match = inputText.match(regex);

        if (match) {
            let value = match[1].trim();

            // Split on newlines or 3+ consecutive spaces and take only the first part
            const parts = value.split(/\n+|\s{3,}/);
            value = parts[0].trim();

            result[keyName] = value;
        }
    });

    return result;
}

  extractVoterData(ocrData, initialVoterId) {
    const text = ocrData.text;
    const lines = text.split('\n').filter(l => l.trim());
    
    // Try to extract actual voter ID from the block if placeholder was used
    let voterId = initialVoterId;
    if (voterId.startsWith('BLOCK_')) {
      const voterIdMatch = text.match(/[A-Z]{3}\d{7}|[A-Z]{2,4}\d{6,8}/);
      if (voterIdMatch) voterId = voterIdMatch[0];
    }
    
    // Extract patterns
    const namePattern = /^([\u0B00-\u0B7F\s:]+)/; // Odia script
    const agePattern = /(?:ବୟସ|Age|ଆୟୁ)[\s:]*(\d+)/i;
    const genderPattern = /(?:ଲିଂଗ|Gender|ଲିଙ୍ଗ)[\s:]*([ପୁମସ୍ତ୍ରୀ|MaleFemale|ପୁରୁଷମହିଳା]+)/i;
    const housePattern = /(\d+)\s*(?:ନଂ|No|ନମ୍ବର)/i;
    const guardianPattern = /(?:ପିତା|Father|ସ୍ୱାମୀ|Husband|ମାତା|Mother)[\s:]*([^\n]+)/i;
    
    // let name = '';
    // let age = '';
    // let gender = '';
    // let houseNo = '';
    // let guardianName = '';
    let result = {};
    
    // Simple extraction logic
    for (const line of lines) {
      const trimmedLine = line.trim();
      const data = this.extractKeyValues(trimmedLine);
      for(const key in data) {
        if(data[key] && !result[key]) {
          result[key] = data[key];
        }
      }
      // // Skip voter ID line
      // if (trimmedLine === voterId) continue;
      
      // // Name: usually first non-ID, non-number line with Odia text
      // if (!name && namePattern.test(trimmedLine) && !line.includes(voterId) && trimmedLine.length > 3) {
      //   name = trimmedLine;
      // }
      
      // const ageMatch = trimmedLine.match(agePattern);
      // if (ageMatch) age = ageMatch[1];
      
      // const genderMatch = trimmedLine.match(genderPattern);
      // if (genderMatch) gender = genderMatch[1];
      
      // const houseMatch = trimmedLine.match(housePattern);
      // if (houseMatch) houseNo = houseMatch[1];
      
      // const guardianMatch = trimmedLine.match(guardianPattern);
      // if (guardianMatch) guardianName = guardianMatch[1].trim();
    }
    
    return {
      voterId,
      ...result,
      allLines: lines,
      data: result
    };
  }

  // Main processing pipeline
  async processPageWithBlocks(imagePath, pageNumber) {
    console.log(`\n📄 Processing page ${pageNumber}...`);
    
    // Step 1: Detect blocks
    const voterBlocks = await this.detectVoterBlocks(imagePath);
    
    if (voterBlocks.length === 0) {
      console.log('  ⚠️  No voter blocks detected');
      return { pageNumber, blocks: [] };
    }
    
    // Step 2: Crop blocks
    const blocksDir = path.join(
      path.dirname(imagePath), 
      `page_${pageNumber}_blocks`
    );
    const croppedBlocks = await this.cropVoterBlocks(imagePath, voterBlocks, blocksDir);
    
    // Step 3: Process each block
    const processedBlocks = [];
    for (const block of croppedBlocks) {
      const result = await this.processVoterBlock(block);
      processedBlocks.push(result);
    }
    
    // Calculate statistics
    const avgConfidence = processedBlocks.reduce((sum, b) => sum + b.confidence, 0) / processedBlocks.length;
    console.log(`  ✅ Page ${pageNumber}: ${processedBlocks.length} blocks, avg confidence: ${avgConfidence.toFixed(2)}%`);
    
    return {
      pageNumber,
      blocks: processedBlocks,
      totalBlocks: processedBlocks.length,
      avgConfidence
    };
  }

  async processPdf(pdfPath) {
    try {
      console.log('\n🚀 Starting PDF processing with block detection...');
      const outputDir = path.join(__dirname, 'temp-images');
      const imagePaths = await this.convertPdfToImages(pdfPath, outputDir);

      const results = [];
      for (let i = 0; i < imagePaths.length; i++) {
        const pageResult = await this.processPageWithBlocks(imagePaths[i], i + 1);
        results.push(pageResult);
      }

      // Generate summary
      const totalBlocks = results.reduce((sum, r) => sum + r.totalBlocks, 0);
      const overallConfidence = results.reduce((sum, r) => 
        sum + (r.avgConfidence || 0) * r.totalBlocks, 0
      ) / totalBlocks;

      console.log('\n✅ PDF processing complete!');
      console.log(`📊 Summary:`);
      console.log(`   Total pages: ${results.length}`);
      console.log(`   Total voter blocks: ${totalBlocks}`);
      console.log(`   Overall confidence: ${overallConfidence.toFixed(2)}%`);

      // Save results to JSON
      const resultsPath = path.join(__dirname, 'ocr-results.json');
      await fs.writeFile(resultsPath, JSON.stringify(results, null, 2));
      console.log(`💾 Results saved to: ${resultsPath}`);

      return results;
    } catch (error) {
      console.error('❌ Error processing PDF:', error);
      throw error;
    }
  }

  async cleanup(directory, keepBlocks = true) {
    try {
      const files = await fs.readdir(directory);
      
      for (const file of files) {
        const filePath = path.join(directory, file);
        const stats = await fs.stat(filePath);
        
        if (stats.isDirectory()) {
          if (!keepBlocks || !file.includes('_blocks')) {
            await fs.rm(filePath, { recursive: true });
          }
        } else {
          await fs.unlink(filePath);
        }
      }
      
      if (!keepBlocks) {
        await fs.rmdir(directory);
      }
      
      console.log('🧹 Cleaned up temporary files');
    } catch (error) {
      console.warn('⚠️  Cleanup warning:', error.message);
    }
  }

  async terminate() {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
    if (this.blockDetector) {
      await this.blockDetector.terminate();
      this.blockDetector = null;
    }
    console.log('👋 Tesseract workers terminated');
  }
}

// Usage example
async function main() {
  const processor = new EnhancedOCRProcessor();
  
  try {
    const pdfPath = process.argv[2] || './voter-list.pdf';
    const results = await processor.processPdf(pdfPath);
    
    // Optional: Clean up (set to false to keep cropped blocks)
    // await processor.cleanup(path.join(__dirname, 'temp-images'), true);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await processor.terminate();
  }
}

// Run if executed directly
if (require.main === module) {
  // main();
}

// Export as singleton instance to match original API
module.exports = new EnhancedOCRProcessor();