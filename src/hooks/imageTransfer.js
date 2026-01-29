/**
 * IMPROVED Image Transfer Utilities
 * Fixes issues with wide/large images failing to arrive at tablet
 */

/**
 * Convert image blob/url to base64 string with AGGRESSIVE compression
 * Specifically optimized for wide images that were failing
 * 
 * @param {string} imageSrc - Image source URL (blob or data URL)
 * @param {number} maxDimension - Maximum width or height (default: 800, reduced from 1200)
 * @param {number} targetSizeKB - Target file size in KB (default: 100, reduced from 200)
 * @returns {Promise<string>} Base64 encoded image data
 */
export async function convertImageToBase64(imageSrc, maxDimension = 800, targetSizeKB = 100) {
  try {
    const response = await fetch(imageSrc);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        
        console.log('[ImageTransfer] Original dimensions:', width, 'x', height);
        
        // SPECIAL HANDLING FOR WIDE IMAGES
        // Wide images (aspect ratio > 2:1) need extra compression
        const aspectRatio = width / height;
        const isWide = aspectRatio > 2 || aspectRatio < 0.5;
        
        if (isWide) {
          console.log('[ImageTransfer] ⚠️ Wide image detected (ratio:', aspectRatio.toFixed(2), ') - applying extra compression');
          // Reduce max dimension for wide images
          maxDimension = Math.min(maxDimension, 600);
          targetSizeKB = Math.min(targetSizeKB, 80);
        }
        
        // Scale down based on longest dimension
        const longestSide = Math.max(width, height);
        if (longestSide > maxDimension) {
          const scale = maxDimension / longestSide;
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        
        canvas.width = width;
        canvas.height = height;
        
        const ctx = canvas.getContext('2d');
        // Improve quality with image smoothing
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, width, height);
        
        // Start with lower quality for wide images
        let quality = isWide ? 0.65 : 0.75;
        let base64data = canvas.toDataURL('image/jpeg', quality);
        let currentSizeKB = (base64data.length * 0.75) / 1024; // More accurate base64 size
        
        console.log('[ImageTransfer] Initial compression:', {
          original: `${img.width}x${img.height}`,
          resized: `${width}x${height}`,
          quality: quality,
          size: `${currentSizeKB.toFixed(2)} KB`,
          isWide: isWide
        });
        
        // AGGRESSIVE quality reduction if needed
        const qualitySteps = [0.6, 0.5, 0.4, 0.35, 0.3, 0.25];
        let stepIndex = 0;
        
        while (currentSizeKB > targetSizeKB && stepIndex < qualitySteps.length) {
          quality = qualitySteps[stepIndex];
          base64data = canvas.toDataURL('image/jpeg', quality);
          currentSizeKB = (base64data.length * 0.75) / 1024;
          
          console.log('[ImageTransfer] Reducing quality:', {
            quality: quality,
            size: `${currentSizeKB.toFixed(2)} KB`
          });
          
          stepIndex++;
        }
        
        // LAST RESORT: Further reduce dimensions
        if (currentSizeKB > targetSizeKB * 1.2) {
          console.log('[ImageTransfer] ⚠️ Still too large, reducing dimensions further...');
          
          const reductionFactor = isWide ? 0.6 : 0.7;
          canvas.width = Math.round(width * reductionFactor);
          canvas.height = Math.round(height * reductionFactor);
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          base64data = canvas.toDataURL('image/jpeg', 0.5);
          currentSizeKB = (base64data.length * 0.75) / 1024;
          
          console.log('[ImageTransfer] Further reduced:', {
            dimensions: `${canvas.width}x${canvas.height}`,
            size: `${currentSizeKB.toFixed(2)} KB`
          });
        }
        
        // FINAL CHECK - if still over 150KB, apply emergency compression
        if (currentSizeKB > 150) {
          console.log('[ImageTransfer] 🚨 EMERGENCY COMPRESSION - image too large!');
          
          // Reduce to max 500px
          const emergencyMax = 500;
          const currentMax = Math.max(canvas.width, canvas.height);
          if (currentMax > emergencyMax) {
            const scale = emergencyMax / currentMax;
            canvas.width = Math.round(canvas.width * scale);
            canvas.height = Math.round(canvas.height * scale);
          }
          
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'medium';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          base64data = canvas.toDataURL('image/jpeg', 0.4);
          currentSizeKB = (base64data.length * 0.75) / 1024;
          
          console.log('[ImageTransfer] Emergency compression complete:', {
            dimensions: `${canvas.width}x${canvas.height}`,
            size: `${currentSizeKB.toFixed(2)} KB`
          });
        }
        
        console.log('[ImageTransfer] ✅ Final result:', {
          dimensions: `${canvas.width}x${canvas.height}`,
          quality: quality,
          size: `${currentSizeKB.toFixed(2)} KB`,
          dataLength: base64data.length
        });
        
        // HARD LIMIT CHECK
        if (currentSizeKB > 200) {
          console.error('[ImageTransfer] ❌ Image still too large after all compression attempts!');
          reject(new Error('Image too large to send - please try a different photo'));
          return;
        }
        
        resolve(base64data);
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(blob);
    });
  } catch (err) {
    console.error('[ImageTransfer] Error converting image:', err);
    throw err;
  }
}

/**
 * Send image to tablet via Playroom RPC with retry logic
 * 
 * @param {Function} sendImageFn - The sendImage function from usePlayroom hook
 * @param {string} imageSrc - Image source URL
 * @param {string} position - User's position (e.g., "top-left")
 * @param {number} maxRetries - Maximum number of retry attempts (default: 2)
 * @returns {Promise<boolean>} Success status
 */
export async function sendImageToTablet(sendImageFn, imageSrc, position, maxRetries = 2) {
  if (!sendImageFn) {
    console.error('[ImageTransfer] ❌ sendImage function not provided');
    return false;
  }

  if (!imageSrc) {
    console.error('[ImageTransfer] ❌ No image source provided');
    return false;
  }

  if (!position) {
    console.error('[ImageTransfer] ❌ No position provided');
    return false;
  }

  // Attempt to send with retries
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`[ImageTransfer] 🔄 Retry attempt ${attempt}/${maxRetries}...`);
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      console.log('[ImageTransfer] 🔄 Converting image to base64...');
      console.log('[ImageTransfer] Image source:', imageSrc.substring(0, 50) + '...');
      
      const base64data = await convertImageToBase64(imageSrc);
      
      console.log('[ImageTransfer] ✅ Conversion complete. Data length:', base64data.length);
      console.log('[ImageTransfer] 📤 Sending image to tablet at position:', position);
      
      const success = sendImageFn(base64data, position);
      
      if (success) {
        console.log('[ImageTransfer] ✅ Send successful!');
        return true;
      } else {
        console.warn('[ImageTransfer] ⚠️ Send returned false');
        if (attempt === maxRetries) {
          return false;
        }
      }
    } catch (err) {
      console.error(`[ImageTransfer] ❌ Attempt ${attempt + 1} failed:`, err);
      
      if (attempt === maxRetries) {
        console.error('[ImageTransfer] ❌ All retry attempts exhausted');
        return false;
      }
    }
  }
  
  return false;
}

/**
 * Swipe threshold in pixels
 */
export const SWIPE_THRESHOLD = 100;

/**
 * Calculate if swipe gesture should trigger send
 * @param {number} startY - Initial Y position
 * @param {number} currentY - Current Y position
 * @returns {boolean} Whether swipe exceeds threshold
 */
export function shouldTriggerSend(startY, currentY) {
  const swipeDelta = startY - currentY;
  return swipeDelta > SWIPE_THRESHOLD;
}

/**
 * Calculate visual transform for swipe feedback
 * @param {number} startY - Initial Y position
 * @param {number} currentY - Current Y position
 * @returns {Object} Transform styles
 */
export function getSwipeTransform(startY, currentY) {
  const delta = Math.min(0, currentY - startY);
  const scale = 1 - Math.abs(delta) / 500;
  const opacity = Math.max(0.3, 1 - Math.abs(delta) / 300);
  
  return {
    transform: `translateY(${delta}px) scale(${scale})`,
    opacity,
  };
}
