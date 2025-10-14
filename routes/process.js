const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');
const ocrProcessor = require('../modules/ocr');
const parser = require('../modules/parser');

// Handle PDF upload and processing
router.post('/upload', async (req, res) => {
  try {
    if (!req.files || !req.files.pdfFile) {
      return res.status(400).render('index', {
        title: 'Electoral Roll Processor',
        message: { type: 'error', text: 'Please upload a PDF file' }
      });
    }

    const pdfFile = req.files.pdfFile;
    
    // Validate file type
    if (pdfFile.mimetype !== 'application/pdf') {
      return res.status(400).render('index', {
        title: 'Electoral Roll Processor',
        message: { type: 'error', text: 'Only PDF files are allowed' }
      });
    }

    // Create uploads directory
    const uploadsDir = path.join(__dirname, '../uploads');
    await fs.mkdir(uploadsDir, { recursive: true });

    // Save uploaded file
    const filename = `electoral_${Date.now()}.pdf`;
    const filepath = path.join(uploadsDir, filename);
    await pdfFile.mv(filepath);

    console.log(`📁 File uploaded: ${filename}`);

    // Redirect to processing page
    res.redirect(`/process/${filename}`);

  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).render('error', {
      error: 'Error uploading file',
      stack: error.message
    });
  }
});

// Processing page
router.get('/:filename', async (req, res) => {
  const filename = req.params.filename;
  res.render('processing', {
    title: 'Processing...',
    filename: filename
  });
});

// API endpoint for actual processing
router.post('/run/:filename', async (req, res) => {
  const filename = req.params.filename;
  const filepath = path.join(__dirname, '../uploads', filename);

  try {
    console.log(`\n🚀 Starting processing: ${filename}`);
    console.log('⏳ This may take several minutes...\n');

    // Step 1: OCR Processing
    console.log('📝 Step 1: Running OCR...');
    const ocrResults = await ocrProcessor.processPdf(filepath);
    console.log(`✅ OCR completed: ${ocrResults.length} pages processed\n`);

    // Step 2: Parse and structure data
    console.log('📊 Step 2: Parsing data...');
    const electoralRoll = await parser.parseElectoralRoll(ocrResults);
    console.log('✅ Data parsed successfully\n');

    // Step 3: Save JSON output
    console.log('💾 Step 3: Saving output...');
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });

    const outputFilename = `electoral_roll_${Date.now()}.json`;
    const outputPath = path.join(outputDir, outputFilename);
    
    await fs.writeFile(
      outputPath, 
      JSON.stringify(electoralRoll, null, 2),
      'utf8'
    );

    console.log(`✅ Output saved: ${outputFilename}\n`);

    // Cleanup uploaded PDF
    try {
      await fs.unlink(filepath);
      console.log('🧹 Cleaned up uploaded file\n');
    } catch (e) {
      console.log('⚠️  Could not delete uploaded file');
    }

    res.json({
      success: true,
      message: 'Processing completed successfully',
      outputFile: outputFilename,
      stats: {
        pages: ocrResults.length,
        totalVoters: electoralRoll.voters.length,
        processingTime: '~5-10 minutes'
      }
    });

  } catch (error) {
    console.error('❌ Processing error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Progress endpoint (for real-time updates)
router.get('/progress/:filename', (req, res) => {
  // This would require implementing a progress tracking system
  // For now, return a simple response
  res.json({
    status: 'processing',
    progress: 50,
    currentStep: 'OCR Processing',
    message: 'Processing pages...'
  });
});

module.exports = router;