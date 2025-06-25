
const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from current directory
app.use(express.static(__dirname));
app.use(express.json());

// Ensure storage dirs exist
['uploads', 'compressed', 'decompressed'].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Configure multer with enhanced file validation
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

// Enhanced file filter for better type detection
const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    'text/plain', 'image/jpeg', 'image/jpg', 'image/png',
    'application/octet-stream', 'application/x-binary', 
    'application/binary', 'application/pdf', 'application/gzip',
    'application/x-gzip'
  ];
  
  const allowedExtensions = ['.txt', '.jpg', '.jpeg', '.bin', '.png', '.pdf', '.gz'];
  const fileExtension = path.extname(file.originalname).toLowerCase();
  
  console.log(`File upload attempt: ${file.originalname}, MIME: ${file.mimetype}, Extension: ${fileExtension}`);
  
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed types: txt, jpg, jpeg, bin, png, pdf, gz`), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 }
});

// POST /compress - Enhanced compression with better metadata
app.post('/compress', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  const originalName = req.file.originalname;
  const timestamp = Date.now();
  const outPath = path.join('compressed', `${timestamp}-${originalName}.gz`);

  try {
    console.log(`[COMPRESS] Starting compression for: ${originalName}`);
    console.log(`[COMPRESS] Input path: ${inputPath}`);
    console.log(`[COMPRESS] Output path: ${outPath}`);
    
    // Read the original file
    const fileData = fs.readFileSync(inputPath);
    console.log(`[COMPRESS] Original file size: ${fileData.length} bytes`);
    
    // Create enhanced metadata object
    const metadata = {
      filename: originalName,
      originalSize: fileData.length,
      timestamp: timestamp,
      mimetype: req.file.mimetype,
      compressed_at: new Date().toISOString(),
      version: "1.0"
    };
    
    console.log(`[COMPRESS] Metadata:`, metadata);
    
    // Convert metadata to buffer with size validation
    const metadataJson = JSON.stringify(metadata);
    const metadataBuffer = Buffer.from(metadataJson, 'utf-8');
    
    // Validate metadata size (prevent corruption)
    if (metadataBuffer.length > 50000) {
      throw new Error('Metadata too large');
    }
    
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);
    
    console.log(`[COMPRESS] Metadata size: ${metadataBuffer.length} bytes`);
    
    // Compress the file data
    const compressedData = zlib.gzipSync(fileData);
    console.log(`[COMPRESS] Compressed data size: ${compressedData.length} bytes`);
    
    // Combine metadata length + metadata + compressed data
    const finalBuffer = Buffer.concat([
      metadataLengthBuffer,
      metadataBuffer,
      compressedData
    ]);
    
    // Write the final compressed file
    fs.writeFileSync(outPath, finalBuffer);
    
    // Clean up temporary upload file
    fs.unlinkSync(inputPath);
    
    console.log(`[COMPRESS] Compression completed. Final size: ${finalBuffer.length} bytes`);
    
    res.json({
      success: true,
      originalSize: fileData.length,
      compressedSize: finalBuffer.length,
      compressionRatio: ((1 - finalBuffer.length / fileData.length) * 100).toFixed(2) + '%',
      downloadPath: `/compressed/${path.basename(outPath)}`,
      filename: `${timestamp}-${originalName}.gz`
    });
    
  } catch (err) {
    console.error('[COMPRESS] Compression error:', err);
    
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    res.status(500).json({ 
      error: 'Compression failed',
      details: err.message 
    });
  }
});

// POST /decompress - Enhanced decompression with better error handling
app.post('/decompress', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;
  
  try {
    console.log(`[DECOMPRESS] Starting decompression for: ${req.file.originalname}`);
    console.log(`[DECOMPRESS] Input path: ${inputPath}`);
    
    const buffer = fs.readFileSync(inputPath);
    console.log(`[DECOMPRESS] Compressed file size: ${buffer.length} bytes`);
    
    // Log first few bytes for debugging
    console.log(`[DECOMPRESS] First 20 bytes: ${buffer.slice(0, 20).toString('hex')}`);
    
    let decompressedData;
    let originalFilename;
    let metadata = null;
    let compressionInfo = "Unknown format";
    
    // Enhanced metadata extraction with better validation
    try {
      if (buffer.length >= 4) {
        const metadataLength = buffer.readUInt32BE(0);
        console.log(`[DECOMPRESS] Detected metadata length: ${metadataLength}`);
        
        // More flexible metadata length validation
        if (metadataLength > 0 && metadataLength < buffer.length && metadataLength < 100000) {
          console.log(`[DECOMPRESS] Attempting to extract metadata...`);
          
          const metadataBuffer = buffer.slice(4, 4 + metadataLength);
          const compressedDataBuffer = buffer.slice(4 + metadataLength);
          
          console.log(`[DECOMPRESS] Metadata buffer size: ${metadataBuffer.length}`);
          console.log(`[DECOMPRESS] Compressed data buffer size: ${compressedDataBuffer.length}`);
          
          try {
            const metadataString = metadataBuffer.toString('utf-8');
            console.log(`[DECOMPRESS] Metadata string: ${metadataString}`);
            
            metadata = JSON.parse(metadataString);
            originalFilename = metadata.filename;
            compressionInfo = "Custom format with metadata";
            
            console.log(`[DECOMPRESS] Extracted metadata:`, metadata);
            
            // Decompress the actual data
            decompressedData = zlib.gunzipSync(compressedDataBuffer);
            console.log(`[DECOMPRESS] Successfully extracted metadata and decompressed data`);
            console.log(`[DECOMPRESS] Decompressed size: ${decompressedData.length} bytes`);
            
          } catch (parseError) {
            console.log(`[DECOMPRESS] Metadata parsing failed: ${parseError.message}`);
            throw parseError;
          }
        } else {
          console.log(`[DECOMPRESS] Invalid metadata length: ${metadataLength}`);
          throw new Error('Invalid metadata length');
        }
      } else {
        throw new Error('File too small to contain metadata');
      }
    } catch (metadataError) {
      console.log(`[DECOMPRESS] No valid metadata found: ${metadataError.message}`);
      console.log(`[DECOMPRESS] Treating as standard gzip file`);
      
      // Try to decompress the entire buffer as a standard gzip file
      try {
        decompressedData = zlib.gunzipSync(buffer);
        originalFilename = req.file.originalname.replace(/\.gz$/, '');
        compressionInfo = "Standard GZIP format";
        console.log(`[DECOMPRESS] Successfully decompressed as standard gzip`);
        console.log(`[DECOMPRESS] Decompressed size: ${decompressedData.length} bytes`);
      } catch (gzipError) {
        console.error(`[DECOMPRESS] GZIP decompression error: ${gzipError.message}`);
        console.error(`[DECOMPRESS] Error code: ${gzipError.code}`);
        
        // Try different decompression methods
        try {
          console.log(`[DECOMPRESS] Trying alternative decompression methods...`);
          decompressedData = zlib.inflateSync(buffer);
          originalFilename = req.file.originalname.replace(/\.gz$/, '');
          compressionInfo = "Deflate format";
          console.log(`[DECOMPRESS] Successfully decompressed using inflate`);
        } catch (inflateError) {
          console.error(`[DECOMPRESS] All decompression methods failed`);
          throw new Error('File is not a valid compressed file or is corrupted');
        }
      }
    }
    
    // Enhanced filename sanitization
    const sanitizedFilename = originalFilename.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');
    console.log(`[DECOMPRESS] Original filename: ${originalFilename}`);
    console.log(`[DECOMPRESS] Sanitized filename: ${sanitizedFilename}`);
    
    // Generate output filename with timestamp
    const timestamp = Date.now();
    const outPath = path.join('decompressed', `${timestamp}-${sanitizedFilename}`);
    
    console.log(`[DECOMPRESS] Output path: ${outPath}`);
    
    // Write decompressed data
    fs.writeFileSync(outPath, decompressedData);
    console.log(`[DECOMPRESS] Decompression completed successfully`);
    console.log(`[DECOMPRESS] Compression info: ${compressionInfo}`);
    
    // Clean up temporary file
    fs.unlinkSync(inputPath);
    
    // Enhanced Content-Disposition header
    const encodedFilename = encodeURIComponent(sanitizedFilename);
    res.setHeader('Content-Disposition', `attachment; filename="${sanitizedFilename}"; filename*=UTF-8''${encodedFilename}`);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Length', decompressedData.length);
    res.setHeader('X-Compression-Info', compressionInfo);
    
    // Send the file to user with enhanced cleanup
    res.download(outPath, sanitizedFilename, (err) => {
      // Delayed cleanup to ensure download completes
      setTimeout(() => {
        if (fs.existsSync(outPath)) {
          try {
            fs.unlinkSync(outPath);
            console.log(`[DECOMPRESS] Cleaned up temporary file: ${outPath}`);
          } catch (cleanupError) {
            console.error(`[DECOMPRESS] Failed to cleanup file: ${cleanupError.message}`);
          }
        }
      }, 5000); // 5 second delay
      
      if (err) {
        console.error('[DECOMPRESS] Download error:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Download failed' });
        }
      } else {
        console.log(`[DECOMPRESS] File download initiated successfully`);
      }
    });
    
  } catch (err) {
    console.error('[DECOMPRESS] Decompression error:', err);
    console.error('[DECOMPRESS] Error stack:', err.stack);
    
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }
    
    let errorMessage = 'Decompression failed';
    if (err.code === 'Z_DATA_ERROR' || err.message.includes('incorrect header check')) {
      errorMessage = 'Invalid or corrupted gzip file';
    } else if (err.message.includes('not a valid compressed file')) {
      errorMessage = 'File is not a valid compressed file';
    } else if (err.message.includes('Metadata too large')) {
      errorMessage = 'File metadata is corrupted or too large';
    }
    
    res.status(400).json({ 
      error: errorMessage,
      details: err.message,
      suggestion: "Try uploading a different compressed file or check if the file was compressed by this portal"
    });
  }
});

// GET route to serve compressed files with better error handling
app.get('/compressed/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(__dirname, 'compressed', filename);
  
  console.log(`[DOWNLOAD] Requesting compressed file: ${filename}`);
  console.log(`[DOWNLOAD] File path: ${filePath}`);
  
  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    console.log(`[DOWNLOAD] File size: ${stats.size} bytes`);
    res.download(filePath);
  } else {
    console.log(`[DOWNLOAD] File not found: ${filePath}`);
    res.status(404).json({ error: 'File not found' });
  }
});

// Enhanced error handling middleware
app.use((error, req, res, next) => {
  console.error('[ERROR] Unhandled error:', error);
  
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 50MB.' });
    }
    return res.status(400).json({ error: `Upload error: ${error.message}` });
  }
  
  if (error.message && error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: error.message });
  }
  
  res.status(500).json({ 
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
});

// Start server with enhanced logging
app.listen(PORT, () => {
  console.log(`✅ Server is running on port ${PORT}`);
  console.log(`📁 Upload endpoint: http://localhost:${PORT}/compress`);
  console.log(`📤 Decompress endpoint: http://localhost:${PORT}/decompress`);
  console.log(`🌐 Open http://localhost:${PORT} in your browser`);
  console.log(`🔍 Health check: http://localhost:${PORT}/health`);
  
  // Log directory status
  ['uploads', 'compressed', 'decompressed'].forEach(dir => {
    const dirPath = path.join(__dirname, dir);
    const exists = fs.existsSync(dirPath);
    console.log(`📂 ${dir} directory: ${exists ? '✅ Ready' : '❌ Missing'}`);
  });
});


