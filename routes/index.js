const express = require('express');
const router = express.Router();
const fs = require('fs').promises;
const path = require('path');

// Home page - Upload form
router.get('/', (req, res) => {
  res.render('index', { 
    title: 'Electoral Roll Processor',
    message: null 
  });
});

// View processed data
router.get('/view/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);
    
    const jsonData = await fs.readFile(filePath, 'utf8');
    const data = JSON.parse(jsonData);
    
    res.render('view', {
      title: 'Electoral Roll Data',
      data: data,
      filename: filename
    });
  } catch (error) {
    res.status(404).render('error', {
      error: 'File not found',
      stack: error.message
    });
  }
});

// List all processed files
router.get('/list', async (req, res) => {
  try {
    const outputDir = path.join(__dirname, '../output');
    await fs.mkdir(outputDir, { recursive: true });
    
    const files = await fs.readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    
    const fileList = await Promise.all(
      jsonFiles.map(async (file) => {
        const stats = await fs.stat(path.join(outputDir, file));
        return {
          name: file,
          size: (stats.size / 1024).toFixed(2) + ' KB',
          date: stats.mtime.toLocaleDateString(),
          time: stats.mtime.toLocaleTimeString()
        };
      })
    );
    
    res.render('list', {
      title: 'Processed Files',
      files: fileList
    });
  } catch (error) {
    res.render('error', {
      error: 'Error reading files',
      stack: error.message
    });
  }
});

// Download JSON
router.get('/download/:filename', async (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(__dirname, '../output', filename);
    
    res.download(filePath);
  } catch (error) {
    res.status(404).send('File not found');
  }
});

module.exports = router;