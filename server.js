
// Import required modules
const express = require('express');     // Web framework to handle HTTP requests
const multer = require('multer');      // Middleware for handling file uploads
const fs = require('fs');              // File system module (read/write/delete files)
const path = require('path');          // Handle file paths safely
const zlib = require('zlib');          // Compression library (gzip, deflate)

// Initialize express app
const app = express();

// Set port (use environment variable if available, else default to 3000)
const PORT = process.env.PORT || 3000;

// Serve static files (HTML, CSS, JS) from current directory
app.use(express.static(__dirname));

// Parse JSON requests
app.use(express.json());


// ============================
// Ensure required directories exist
// ============================

// These folders are used to store files
['uploads', 'compressed', 'decompressed'].forEach(dir => {
  // Check if folder exists
  if (!fs.existsSync(dir)) {
    // Create folder if it does not exist
    fs.mkdirSync(dir, { recursive: true });
  }
});


// ============================
// Multer Storage Configuration
// ============================

// Configure where and how files are stored
const storage = multer.diskStorage({

  // Set destination folder for uploaded files
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },

  // Set unique filename to avoid collisions
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});


// ============================
// File Filter (Security)
// ============================

// Allow only specific file types
const fileFilter = (req, file, cb) => {

  // Allowed MIME types
  const allowedTypes = [
    'text/plain', 'image/jpeg', 'image/jpg', 'image/png',
    'application/octet-stream', 'application/pdf',
    'application/gzip', 'application/x-gzip'
  ];

  // Allowed file extensions
  const allowedExtensions = ['.txt', '.jpg', '.jpeg', '.png', '.pdf', '.gz'];

  // Extract file extension
  const fileExtension = path.extname(file.originalname).toLowerCase();

  // Allow file if MIME type OR extension matches
  if (allowedTypes.includes(file.mimetype) || allowedExtensions.includes(fileExtension)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed'), false);
  }
};


// ============================
// Multer Middleware Setup
// ============================

const upload = multer({
  storage: storage,        // where to store files
  fileFilter: fileFilter,  // validate file type
  limits: { fileSize: 50 * 1024 * 1024 } // max file size = 50MB
});


// ============================
// COMPRESS ROUTE
// ============================

app.post('/compress', upload.single('file'), (req, res) => {

  // Check if file exists
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  // File paths and metadata
  const inputPath = req.file.path;                 // uploaded file path
  const originalName = req.file.originalname;      // original filename
  const timestamp = Date.now();                    // unique timestamp
  const outPath = path.join('compressed', `${timestamp}-${originalName}.gz`);

  try {
    // Read file into memory
    const fileData = fs.readFileSync(inputPath);

    // Create metadata object
    const metadata = {
      filename: originalName,
      originalSize: fileData.length,
      timestamp: timestamp,
      mimetype: req.file.mimetype
    };

    // Convert metadata to buffer
    const metadataBuffer = Buffer.from(JSON.stringify(metadata), 'utf-8');

    // Store metadata length in first 4 bytes
    const metadataLengthBuffer = Buffer.alloc(4);
    metadataLengthBuffer.writeUInt32BE(metadataBuffer.length, 0);

    // Compress file using gzip
    const compressedData = zlib.gzipSync(fileData);

    // Combine metadata length + metadata + compressed data
    const finalBuffer = Buffer.concat([
      metadataLengthBuffer,
      metadataBuffer,
      compressedData
    ]);

    // Save compressed file
    fs.writeFileSync(outPath, finalBuffer);

    // Delete original uploaded file
    fs.unlinkSync(inputPath);

    // Send response to client
    res.json({
      success: true,
      originalSize: fileData.length,
      compressedSize: finalBuffer.length,
      downloadPath: `/compressed/${path.basename(outPath)}`
    });

  } catch (err) {

    // Delete file if error occurs
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    res.status(500).json({ error: 'Compression failed' });
  }
});


// ============================
// DECOMPRESS ROUTE
// ============================

app.post('/decompress', upload.single('file'), (req, res) => {

  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const inputPath = req.file.path;

  try {
    // Read compressed file
    const buffer = fs.readFileSync(inputPath);

    let decompressedData;
    let originalFilename;

    try {
      // Read metadata length (first 4 bytes)
      const metadataLength = buffer.readUInt32BE(0);

      // Extract metadata
      const metadataBuffer = buffer.slice(4, 4 + metadataLength);
      const metadata = JSON.parse(metadataBuffer.toString('utf-8'));

      // Extract compressed data
      const compressedDataBuffer = buffer.slice(4 + metadataLength);

      // Decompress data
      decompressedData = zlib.gunzipSync(compressedDataBuffer);

      originalFilename = metadata.filename;

    } catch (e) {
      // If metadata fails, treat as normal gzip file
      decompressedData = zlib.gunzipSync(buffer);
      originalFilename = req.file.originalname.replace(/\.gz$/, '');
    }

    // Save decompressed file
    const outPath = path.join('decompressed', originalFilename);
    fs.writeFileSync(outPath, decompressedData);

    // Delete uploaded file
    fs.unlinkSync(inputPath);

    // Send file to user
    res.download(outPath, originalFilename);

  } catch (err) {

    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    res.status(500).json({ error: 'Decompression failed' });
  }
});


// ============================
// DOWNLOAD ROUTE
// ============================

app.get('/compressed/:filename', (req, res) => {
  const filePath = path.join(__dirname, 'compressed', req.params.filename);

  // Check if file exists
  if (fs.existsSync(filePath)) {
    res.download(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});


// ============================
// ERROR HANDLING MIDDLEWARE
// ============================

app.use((error, req, res, next) => {

  // Handle multer errors (like file too large)
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large (max 50MB)' });
    }
  }

  // Handle invalid file type
  if (error.message && error.message.includes('File type not allowed')) {
    return res.status(400).json({ error: error.message });
  }

  // Generic error
  res.status(500).json({ error: 'Internal server error' });
});


// ============================
// HEALTH CHECK ROUTE
// ============================

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});


// ============================
// START SERVER
// ============================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

