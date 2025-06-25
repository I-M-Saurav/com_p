
document.addEventListener('DOMContentLoaded', () => {
  console.log('[FRONTEND] Initializing compression portal...');

  // Enhanced setup for drop zones with better error handling
  function setupDropZone(zoneId, inputId, infoId, actionBtnId, endpoint, spinnerId, sizeInfoId = null) {
    console.log(`[FRONTEND] Setting up drop zone: ${zoneId}`);
    
    const zone = document.getElementById(zoneId);
    const input = document.getElementById(inputId);
    const info = document.getElementById(infoId);
    const btn = document.getElementById(actionBtnId);
    const spinner = document.getElementById(spinnerId);
    let selectedFile = null;

    // Validate elements exist
    if (!zone || !input || !info || !btn || !spinner) {
      console.error(`[FRONTEND] Missing elements for ${zoneId}`);
      return;
    }

    // Enhanced click handler
    zone.onclick = () => {
      console.log(`[FRONTEND] Drop zone clicked: ${zoneId}`);
      input.click();
    };

    // Enhanced drag and drop handlers
    zone.ondragover = (e) => {
      e.preventDefault();
      zone.classList.add('hover');
      console.log(`[FRONTEND] Drag over: ${zoneId}`);
    };

    zone.ondragleave = () => {
      zone.classList.remove('hover');
      console.log(`[FRONTEND] Drag leave: ${zoneId}`);
    };

    zone.ondrop = (e) => {
      e.preventDefault();
      zone.classList.remove('hover');
      console.log(`[FRONTEND] File dropped: ${zoneId}`);
      
      if (e.dataTransfer.files.length) {
        const file = e.dataTransfer.files[0];
        console.log(`[FRONTEND] Dropped file: ${file.name}, size: ${file.size}, type: ${file.type}`);
        
        // Create a new FileList-like object
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        
        updateInfo();
      }
    };

    // Enhanced file input change handler
    input.onchange = () => {
      console.log(`[FRONTEND] File input changed: ${inputId}`);
      updateInfo();
    };

    // Enhanced file info update function
    function updateInfo() {
      selectedFile = input.files[0];
      if (!selectedFile) {
        console.log(`[FRONTEND] No file selected for ${zoneId}`);
        info.innerHTML = '';
        return;
      }

      const fileSize = selectedFile.size;
      const fileSizeKB = (fileSize / 1024).toFixed(1);
      const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
      const displaySize = fileSize > 1024 * 1024 ? `${fileSizeMB} MB` : `${fileSizeKB} KB`;
      
      console.log(`[FRONTEND] File selected: ${selectedFile.name}, size: ${displaySize}`);
      info.innerHTML = `📄 ${selectedFile.name} (${displaySize})`;
      
      // Clear previous size info
      if (sizeInfoId) {
        const sizeInfoElement = document.getElementById(sizeInfoId);
        if (sizeInfoElement) {
          sizeInfoElement.innerHTML = '';
        }
      }
    }

    // Enhanced button click handler with better error handling
    btn.onclick = async () => {
      if (!selectedFile) {
        showToast('❌ No file selected! Please choose a file first.', false);
        return;
      }

      // Validate file size (50MB limit)
      const maxSize = 50 * 1024 * 1024; // 50MB
      if (selectedFile.size > maxSize) {
        showToast('❌ File too large! Maximum size is 50MB.', false);
        return;
      }

      console.log(`[FRONTEND] Starting ${endpoint} operation for: ${selectedFile.name}`);
      
      // Show loading state
      spinner.style.display = 'inline-block';
      btn.disabled = true;
      btn.style.opacity = '0.6';
      
      const originalBtnText = btn.textContent;
      btn.textContent = endpoint === '/compress' ? '🔄 Compressing...' : '🔄 Decompressing...';
      
      try {
        const formData = new FormData();
        formData.append('file', selectedFile);
        
        console.log(`[FRONTEND] Sending request to ${endpoint}`);
        console.log(`[FRONTEND] File details:`, {
          name: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          lastModified: new Date(selectedFile.lastModified).toISOString()
        });
        
        const res = await fetch(endpoint, { 
          method: 'POST', 
          body: formData 
        });
        
        console.log(`[FRONTEND] Response status: ${res.status}`);
        console.log(`[FRONTEND] Response headers:`, Object.fromEntries(res.headers.entries()));
        
        if (!res.ok) {
          let errorData;
          try {
            errorData = await res.json();
          } catch (parseError) {
            console.error(`[FRONTEND] Failed to parse error response:`, parseError);
            throw new Error(`Operation failed with status ${res.status}`);
          }
          console.error(`[FRONTEND] Server error:`, errorData);
          throw new Error(errorData.error || `Operation failed with status ${res.status}`);
        }

        if (endpoint === '/compress') {
          // Handle compression response
          console.log(`[FRONTEND] Processing compression response`);
          
          const data = await res.json();
          console.log(`[FRONTEND] Compression data:`, data);
          
          if (!data.success) {
            throw new Error(data.error || 'Compression failed');
          }
          
          // Download the compressed file
          console.log(`[FRONTEND] Downloading compressed file from: ${data.downloadPath}`);
          
          try {
            const downloadRes = await fetch(data.downloadPath);
            if (!downloadRes.ok) {
              throw new Error(`Download failed: ${downloadRes.status}`);
            }
            
            const blob = await downloadRes.blob();
            console.log(`[FRONTEND] Downloaded blob size: ${blob.size}`);
            
            downloadBlob(blob, data.filename);
            
            // Update size info if element exists
            if (sizeInfoId) {
              const sizeInfoElement = document.getElementById(sizeInfoId);
              if (sizeInfoElement) {
                const saved = ((1 - data.compressedSize / data.originalSize) * 100).toFixed(1);
                sizeInfoElement.innerHTML = `
                  📊 <strong>Compression Results:</strong><br>
                  📁 Original: ${(data.originalSize / 1024).toFixed(1)} KB<br>
                  🗜️ Compressed: ${(data.compressedSize / 1024).toFixed(1)} KB<br>
                  💾 Space Saved: ${saved}% (${data.compressionRatio})
                `;
              }
            }
            
            showToast('✅ Compression completed successfully!', true);
            console.log(`[FRONTEND] Compression completed successfully`);
            
          } catch (downloadError) {
            console.error(`[FRONTEND] Download error:`, downloadError);
            throw new Error(`Download failed: ${downloadError.message}`);
          }
          
        } else {
          // Handle decompression response - file should be directly downloaded
          console.log(`[FRONTEND] Processing decompression response`);
          
          const contentType = res.headers.get('Content-Type');
          console.log(`[FRONTEND] Response content type: ${contentType}`);
          
          if (contentType && contentType.includes('application/json')) {
            // This is an error response
            const errorData = await res.json();
            console.error(`[FRONTEND] Decompression error:`, errorData);
            throw new Error(errorData.error || 'Decompression failed');
          }
          
          // This should be the file download
          const blob = await res.blob();
          console.log(`[FRONTEND] Decompressed blob size: ${blob.size}`);
          
          if (blob.size === 0) {
            throw new Error('Received empty file');
          }
          
          // Extract filename from Content-Disposition header with enhanced parsing
          let filename = 'decompressed_file';
          const contentDisposition = res.headers.get('Content-Disposition');
          console.log(`[FRONTEND] Content-Disposition header: ${contentDisposition}`);
          
          if (contentDisposition) {
            // Try multiple filename extraction methods
            const filenameMatch = contentDisposition.match(/filename\*=UTF-8''([^;]+)/);
            const filenameQuotedMatch = contentDisposition.match(/filename="([^"]+)"/);
            const filenameUnquotedMatch = contentDisposition.match(/filename=([^;]+)/);
            
            if (filenameMatch) {
              filename = decodeURIComponent(filenameMatch[1]);
              console.log(`[FRONTEND] Extracted UTF-8 filename: ${filename}`);
            } else if (filenameQuotedMatch) {
              filename = filenameQuotedMatch[1];
              console.log(`[FRONTEND] Extracted quoted filename: ${filename}`);
            } else if (filenameUnquotedMatch) {
              filename = filenameUnquotedMatch[1].trim();
              console.log(`[FRONTEND] Extracted unquoted filename: ${filename}`);
            }
          }
          
          // Fallback filename generation
          if (!filename || filename === 'decompressed_file') {
            const originalName = selectedFile.name.replace(/\.gz$/, '');
            filename = originalName || `decompressed_${Date.now()}`;
            console.log(`[FRONTEND] Using fallback filename: ${filename}`);
          }
          
          downloadBlob(blob, filename);
          showToast('✅ Decompression completed successfully!', true);
          console.log(`[FRONTEND] Decompression completed successfully`);
        }
        
      } catch (error) {
        console.error(`[FRONTEND] Operation error:`, error);
        
        let errorMessage = error.message || 'Operation failed!';
        
        // Enhanced error message handling
        if (errorMessage.includes('NetworkError') || errorMessage.includes('Failed to fetch')) {
          errorMessage = '🌐 Network error. Please check your connection and try again.';
        } else if (errorMessage.includes('timeout')) {
          errorMessage = '⏱️ Operation timed out. Please try with a smaller file.';
        } else if (errorMessage.includes('File too large')) {
          errorMessage = '📁 File is too large. Maximum size is 50MB.';
        } else if (errorMessage.includes('File type not allowed')) {
          errorMessage = '📋 File type not supported. Please use txt, jpg, png, bin, or pdf files.';
        } else if (errorMessage.includes('corrupted') || errorMessage.includes('invalid')) {
          errorMessage = '🔧 File appears to be corrupted or invalid.';
        }
        
        showToast(`❌ ${errorMessage}`, false);
        
      } finally {
        // Reset button state
        spinner.style.display = 'none';
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.textContent = originalBtnText;
        console.log(`[FRONTEND] Reset button state for ${endpoint}`);
      }
    };
  }

  // Enhanced blob download function with better error handling
  function downloadBlob(blob, filename) {
    console.log(`[FRONTEND] Starting download: ${filename}, size: ${blob.size}`);
    
    try {
      // Validate blob
      if (!blob || blob.size === 0) {
        throw new Error('Invalid or empty file');
      }
      
      // Create download URL
      const url = URL.createObjectURL(blob);
      console.log(`[FRONTEND] Created blob URL: ${url}`);
      
      // Create and configure download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.style.display = 'none';
      
      // Add to DOM, click, and remove
      document.body.appendChild(link);
      
      // Use setTimeout to ensure the link is in the DOM
      setTimeout(() => {
        console.log(`[FRONTEND] Triggering download for: ${filename}`);
        link.click();
        
        // Cleanup after a delay
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
          console.log(`[FRONTEND] Download cleanup completed for: ${filename}`);
        }, 100);
      }, 10);
      
    } catch (error) {
      console.error(`[FRONTEND] Download error:`, error);
      showToast(`❌ Download failed: ${error.message}`, false);
    }
  }

  // Enhanced toast notification function
  function showToast(msg, success = true) {
    console.log(`[FRONTEND] Showing toast: ${msg}, success: ${success}`);
    
    const toast = document.getElementById('toast');
    if (!toast) {
      console.error('[FRONTEND] Toast element not found');
      return;
    }
    
    // Clear any existing timeout
    if (toast.timeoutId) {
      clearTimeout(toast.timeoutId);
    }
    
    // Set message and styling
    toast.textContent = msg;
    toast.className = `show ${success ? 'success' : 'error'}`;
    
    // Auto-hide after 5 seconds (longer for error messages)
    const duration = success ? 3000 : 5000;
    toast.timeoutId = setTimeout(() => {
      toast.className = '';
      console.log(`[FRONTEND] Toast hidden after ${duration}ms`);
    }, duration);
  }

  // Setup drop zones with enhanced error handling
  try {
    console.log('[FRONTEND] Setting up compression drop zone...');
    setupDropZone(
      'drop-zone', 
      'fileInput', 
      'fileInfo', 
      'compressBtn', 
      '/compress', 
      'spinner', 
      'sizeInfo'
    );

    console.log('[FRONTEND] Setting up decompression drop zone...');
    setupDropZone(
      'drop-zone-decompress', 
      'fileInputDecompress', 
      'fileInfoDecompress', 
      'decompressBtn', 
      '/decompress', 
      'spinnerDecompress'
    );
    
    console.log('[FRONTEND] Drop zones setup completed successfully');
    
  } catch (error) {
    console.error('[FRONTEND] Error setting up drop zones:', error);
    showToast('❌ Failed to initialize interface. Please refresh the page.', false);
  }

  // Enhanced theme toggle functionality
  function initializeThemeToggle() {
    console.log('[FRONTEND] Initializing theme toggle...');
    
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;

    if (!themeToggle) {
      console.error('[FRONTEND] Theme toggle element not found');
      return;
    }

    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    console.log(`[FRONTEND] Saved theme preference: ${savedTheme}`);
    
    if (savedTheme === 'light') {
      body.setAttribute('data-theme', 'light');
      themeToggle.checked = true;
      console.log('[FRONTEND] Applied light theme from saved preference');
    } else {
      body.removeAttribute('data-theme'); // Default to dark
      themeToggle.checked = false;
      console.log('[FRONTEND] Applied dark theme (default)');
    }

    // Theme toggle event listener
    themeToggle.addEventListener('change', function() {
      const isLight = this.checked;
      console.log(`[FRONTEND] Theme toggle changed: ${isLight ? 'light' : 'dark'}`);
      
      if (isLight) {
        body.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
        console.log('[FRONTEND] Switched to light theme');
      } else {
        body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'dark');
        console.log('[FRONTEND] Switched to dark theme');
      }
    });
  }

  // Enhanced FAQ functionality
  function initializeFAQ() {
    console.log('[FRONTEND] Initializing FAQ functionality...');
    
    const faqQuestions = document.querySelectorAll('.faq-question');
    
    faqQuestions.forEach((question, index) => {
      question.addEventListener('click', () => {
        const answer = question.nextElementSibling;
        const isOpen = answer.style.display === 'block';
        
        console.log(`[FRONTEND] FAQ item ${index} clicked, currently ${isOpen ? 'open' : 'closed'}`);
        
        // Close all other answers
        document.querySelectorAll('.faq-answer').forEach(ans => {
          ans.style.display = 'none';
        });
        
        // Reset all question indicators
        document.querySelectorAll('.faq-question').forEach(q => {
          q.querySelector('::after, .indicator')?.remove();
        });
        
        // Toggle current answer
        if (!isOpen) {
          answer.style.display = 'block';
          question.style.background = 'var(--bg-secondary)';
          console.log(`[FRONTEND] Opened FAQ item ${index}`);
        } else {
          answer.style.display = 'none';
          question.style.background = '';
          console.log(`[FRONTEND] Closed FAQ item ${index}`);
        }
      });
    });
    
    console.log(`[FRONTEND] FAQ initialization completed for ${faqQuestions.length} items`);
  }

  // Global error handler
  window.addEventListener('error', (event) => {
    console.error('[FRONTEND] Global error:', event.error);
    showToast('❌ An unexpected error occurred. Please refresh the page.', false);
  });

  // Unhandled promise rejection handler
  window.addEventListener('unhandledrejection', (event) => {
    console.error('[FRONTEND] Unhandled promise rejection:', event.reason);
    showToast('❌ A network error occurred. Please try again.', false);
  });

  // Initialize all components
  try {
    initializeThemeToggle();
    initializeFAQ();
    console.log('[FRONTEND] All components initialized successfully');
    
    // Show ready message
    setTimeout(() => {
      showToast('🚀 Compression portal ready!', true);
    }, 500);
    
  } catch (error) {
    console.error('[FRONTEND] Error during initialization:', error);
    showToast('❌ Some features may not work properly. Please refresh the page.', false);
  }
});
