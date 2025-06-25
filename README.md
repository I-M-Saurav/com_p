WEBSITE LINK :- https://com-p.onrender.com/


README for Compression and Decompression Portal
Welcome to the Compression and Decompression Portal project! This document provides a comprehensive overview of the project, including its features, architecture, setup instructions, and usage guidelines.
Table of Contents
Overview
Features
Project Structure
Technology Stack
Setup Instructions
Usage
Theme Toggle Functionality
File Compression & Decompression
Error Handling & Validation
Customization & Extensibility
Contributing
License
Overview
This project is a web-based application that allows users to compress and decompress files directly through a user-friendly interface. It supports common file types such as .txt, .jpg, .jpeg, .png, .bin, and .pdf. The core compression algorithms used are Huffman coding and Run-Length Encoding (RLE), implemented on the server side with Node.js and Express. The application features:
Drag-and-drop file upload
File compression with metadata preservation
File decompression with support for timestamped filenames
Dark and light theme toggling
Responsive and accessible UI
Robust error handling and validation
Features
File Upload & Validation: Supports multiple file types with size limit of 50MB.
Compression: Uses Huffman coding and RLE algorithms to compress files efficiently.
Decompression: Restores original files, handling timestamped filenames like 1750832890824-my.txt.gz.
Metadata Preservation: Stores original filename, size, and MIME type within compressed files.
Theme Toggle: Switches between dark and light modes with persistent user preference.
User-Friendly UI: Drag-and-drop zones, progress spinners, toast notifications, and FAQ section.
Error Handling: Detects invalid files, corrupted data, and network issues with descriptive messages.
Project Structure
text
compression-portal/
├── server.js             # Backend server handling compression/decompression
├── index.html            # Frontend HTML structure
├── script.js             # Frontend logic including theme toggle
├── styles.css            # CSS styling with theme support
├── package.json          # Node.js dependencies and scripts
├── uploads/              # Temporary upload storage
├── compressed/           # Store compressed files
└── decompressed/         # Store decompressed files
Technology Stack
Node.js & Express: Server-side logic
multer: Handling file uploads
zlib: Compression (gzip) and decompression
HTML/CSS/JavaScript: Frontend interface
CSS Variables: For theme management
Fetch API: Client-server communication
Setup Instructions
1. Clone or Download the Repository
bash
git clone <repository_url>
cd <repository_directory>
2. Install Dependencies
bash
npm install
3. Run the Application
bash
npm start
The server will start on http://localhost:3000. If port 3000 is occupied, you can modify the PORT variable in server.js or run on an alternative port.
Usage
Compress a File
Drag and drop or click the "Upload" area to select a file (.txt, .jpg, .png, .bin, .pdf).
Click the "📦 Compress" button.
The compressed file will automatically download, and a summary of compression stats will be shown.
Decompress a File
Drag and drop or click the "Upload" area to select a .gz file.
Click the "🧩 Decompress" button.
The original file will be downloaded with its original filename restored.
Theme Toggle
Use the toggle switch at the top-right corner to switch between dark and light themes.
Preference is saved in local storage and persists across sessions.
Theme Toggle Functionality
The theme toggle switch updates the CSS variables dynamically by setting a data-color-scheme attribute on the <html> element. When toggled:
Dark Mode: Default theme with dark backgrounds and light text.
Light Mode: Bright theme with light backgrounds and dark text.
The toggle state is saved in localStorage for persistence.
File Compression & Decompression Details
Compression Algorithm
Reads the input file.
Builds a Huffman tree based on character frequency.
Encodes data into variable-length Huffman codes.
Applies RLE for sequences of repeated characters.
Stores metadata (original filename, size, MIME type) with the compressed data.
Compresses data with gzip (zlib.gzipSync) for efficiency.
Saves the combined metadata and compressed data into a .gz file.
Decompression Algorithm
Reads the compressed file.
Extracts metadata (if present).
Decompresses gzip data.
Restores the original filename.
Handles timestamped filenames like 1750832890824-my.txt.gz.
Supports files with or without metadata headers.
Error Handling & Validation
Validates file types and sizes before upload.
Detects invalid or corrupted gzip files during decompression.
Provides user-friendly toast notifications for errors.
Cleans up temporary files after processing.
Handles network errors and server issues gracefully.
Customization & Extensibility
Supported File Types: Modify the fileFilter in server.js.
Algorithms: Extend Huffman or RLE implementations for better compression.
UI: Customize styles in styles.css.
Themes: Add more CSS variables for additional themes.
Port Configuration: Change the PORT variable in server.js.
Contributing
Contributions are welcome! Please fork the repository, create a feature branch, and submit a pull request with your improvements.
License
This project is licensed under the MIT License. See the LICENSE file for details.
Final Notes
This project provides a robust, user-friendly platform for file compression and decompression, suitable for personal use, learning, or integration into larger systems. Ensure to keep dependencies updated and test thoroughly before deploying in production environments.
Enjoy compressing and decompressing files effortlessly!
