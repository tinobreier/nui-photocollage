// Debug version of AprilTag worker with detailed status reporting
// This file helps identify where WASM loading fails

// Report initial load
postMessage({ type: 'status', message: '1/5: Worker script loaded successfully' });

try {
  // Step 1: Configure WASM module BEFORE loading
  postMessage({ type: 'status', message: '2/5: Configuring WASM module paths...' });

  // Configure the Module before apriltag_wasm.js loads
  // Emscripten expects this as a global Module object
  self.Module = self.Module || {};
  self.Module.locateFile = function(path) {
    postMessage({ type: 'status', message: `locateFile called with: ${path}` });
    // Override locateFile to use absolute path for WASM files
    if (path.endsWith('.wasm')) {
      const fullPath = '/lib/' + path;
      postMessage({ type: 'status', message: `→ Returning WASM path: ${fullPath}` });
      return fullPath;
    }
    postMessage({ type: 'status', message: `→ Returning path as-is: ${path}` });
    return path;
  };

  // Also set for AprilTagWasm in case it checks there
  self.AprilTagWasm = self.AprilTagWasm || {};
  self.AprilTagWasm.locateFile = self.Module.locateFile;

  postMessage({ type: 'status', message: '3/5: Loading WASM script (apriltag_wasm.js)...' });
  importScripts('/lib/apriltag_wasm.js');
  postMessage({ type: 'status', message: '4/5: ✓ WASM script loaded' });
} catch (error) {
  postMessage({
    type: 'error',
    message: `✗ Failed to load WASM script: ${error.message}`,
    error: error.toString(),
    stack: error.stack
  });
  throw error;
}

try {
  // Step 2: Load Comlink
  postMessage({ type: 'status', message: 'Loading Comlink...' });
  importScripts("https://unpkg.com/comlink/dist/umd/comlink.js");
  postMessage({ type: 'status', message: '✓ Comlink loaded' });
} catch (error) {
  postMessage({
    type: 'error',
    message: `✗ Failed to load Comlink: ${error.message}`,
    error: error.toString()
  });
  throw error;
}

/**
 * Debug version of Apriltag class with detailed logging
 */
class Apriltag {
  constructor(onDetectorReadyCallback) {
    postMessage({ type: 'status', message: '5/6: Initializing AprilTag detector...' });

    this.onDetectorReadyCallback = onDetectorReadyCallback;

    // detector options
    this._opt = {
      quad_decimate: 2.0,
      quad_sigma: 0.0,
      nthreads: 1,
      refine_edges: 1,
      max_detections: 0,
      return_pose: 1,
      return_solutions: 1
    };

    let _this = this;

    // Check if AprilTagWasm function exists
    if (typeof AprilTagWasm === 'undefined') {
      postMessage({
        type: 'error',
        message: '✗ AprilTagWasm function not defined - WASM script may not have loaded correctly'
      });
      return;
    }

    postMessage({ type: 'status', message: 'Configuring WASM file path...' });

    // Configure locateFile to fix WASM path with cache buster
    const wasmConfig = {
      locateFile: function(path) {
        postMessage({ type: 'status', message: `locateFile called with: ${path}` });
        if (path.endsWith('.wasm')) {
          // Add cache buster to force reload
          const cacheBuster = Date.now();
          const fullPath = '/lib/' + path + '?v=' + cacheBuster;
          postMessage({ type: 'status', message: `→ Returning with cache buster: ${fullPath}` });
          return fullPath;
        }
        postMessage({ type: 'status', message: `→ Returning: ${path}` });
        return path;
      }
    };

    postMessage({ type: 'status', message: 'Calling AprilTagWasm(config)...' });

    try {
      AprilTagWasm(wasmConfig).then(function (Module) {
        postMessage({ type: 'status', message: '6/6: ✓ WASM module loaded successfully!' });
        _this.onWasmInit(Module);
      }).catch(function(error) {
        postMessage({
          type: 'error',
          message: `✗ WASM module initialization failed: ${error.message}`,
          error: error.toString(),
          stack: error.stack
        });
      });
    } catch (error) {
      postMessage({
        type: 'error',
        message: `✗ Error calling AprilTagWasm(): ${error.message}`,
        error: error.toString(),
        stack: error.stack
      });
    }
  }

  onWasmInit(Module) {
    try {
      postMessage({ type: 'status', message: 'Setting up WASM function wrappers...' });

      this._Module = Module;
      this._init = Module.cwrap('atagjs_init', 'number', []);
      this._destroy = Module.cwrap('atagjs_destroy', 'number', []);
      this._set_detector_options = Module.cwrap('atagjs_set_detector_options', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number', 'number']);
      this._set_pose_info = Module.cwrap('atagjs_set_pose_info', 'number',
        ['number', 'number', 'number', 'number']);
      this._set_img_buffer = Module.cwrap('atagjs_set_img_buffer', 'number',
        ['number', 'number', 'number']);
      this._atagjs_set_tag_size = Module.cwrap('atagjs_set_tag_size', null,
        ['number', 'number']);
      this._detect = Module.cwrap('atagjs_detect', 'number', []);

      postMessage({ type: 'status', message: 'Initializing detector...' });
      this._init();

      postMessage({ type: 'status', message: 'Setting detector options...' });
      this._set_detector_options(
        this._opt.quad_decimate,
        this._opt.quad_sigma,
        this._opt.nthreads,
        this._opt.refine_edges,
        this._opt.max_detections,
        this._opt.return_pose,
        this._opt.return_solutions);

      postMessage({ type: 'status', message: '✓✓✓ AprilTag detector ready! ✓✓✓' });
      this.onDetectorReadyCallback();

    } catch (error) {
      postMessage({
        type: 'error',
        message: `✗ Error in onWasmInit: ${error.message}`,
        error: error.toString(),
        stack: error.stack
      });
    }
  }

  detect(grayscaleImg, imgWidth, imgHeight) {
    try {
      let imgBuffer = this._set_img_buffer(imgWidth, imgHeight, imgWidth);
      if (imgWidth * imgHeight < grayscaleImg.length) return { result: "Image data too large." };
      this._Module.HEAPU8.set(grayscaleImg, imgBuffer);
      let strJsonPtr = this._detect();
      let strJsonLen = this._Module.getValue(strJsonPtr, "i32");

      if (strJsonLen == 0) {
        return [];
      }

      let strJsonStrPtr = this._Module.getValue(strJsonPtr + 4, "i32");
      const strJsonView = new Uint8Array(this._Module.HEAP8.buffer, strJsonStrPtr, strJsonLen);
      let detectionsJson = '';
      for (let i = 0; i < strJsonLen; i++) {
        detectionsJson += String.fromCharCode(strJsonView[i]);
      }

      let detections = JSON.parse(detectionsJson);
      return detections;

    } catch (error) {
      postMessage({
        type: 'error',
        message: `✗ Detection error: ${error.message}`,
        error: error.toString()
      });
      return [];
    }
  }

  set_camera_info(fx, fy, cx, cy) {
    this._set_pose_info(fx, fy, cx, cy);
  }

  set_tag_size(tagid, size) {
    this._atagjs_set_tag_size(tagid, size);
  }

  set_max_detections(maxDetections) {
    this._opt.max_detections = maxDetections;
    this._set_detector_options(
      this._opt.quad_decimate,
      this._opt.quad_sigma,
      this._opt.nthreads,
      this._opt.refine_edges,
      this._opt.max_detections,
      this._opt.return_pose,
      this._opt.return_solutions);
  }

  set_return_pose(returnPose) {
    this._opt.return_pose = returnPose;
    this._set_detector_options(
      this._opt.quad_decimate,
      this._opt.quad_sigma,
      this._opt.nthreads,
      this._opt.refine_edges,
      this._opt.max_detections,
      this._opt.return_pose,
      this._opt.return_solutions);
  }

  set_return_solutions(returnSolutions) {
    this._opt.return_solutions = returnSolutions;
    this._set_detector_options(
      this._opt.quad_decimate,
      this._opt.quad_sigma,
      this._opt.nthreads,
      this._opt.refine_edges,
      this._opt.max_detections,
      this._opt.return_pose,
      this._opt.return_solutions);
  }
}

// Expose via Comlink
try {
  postMessage({ type: 'status', message: 'Exposing Apriltag class via Comlink...' });
  Comlink.expose(Apriltag);
  postMessage({ type: 'status', message: '✓ Class exposed, worker ready for Comlink calls' });
} catch (error) {
  postMessage({
    type: 'error',
    message: `✗ Failed to expose class: ${error.message}`,
    error: error.toString()
  });
}

// Handle uncaught errors
self.addEventListener('error', (event) => {
  postMessage({
    type: 'error',
    message: `✗ Uncaught worker error: ${event.message}`,
    filename: event.filename,
    lineno: event.lineno,
    colno: event.colno,
    error: event.error ? event.error.toString() : 'Unknown error'
  });
});
