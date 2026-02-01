export async function convertImageToBase64(imageSrc, maxDimension = 800, targetSizeKB = 100) {
	try {
		const response = await fetch(imageSrc);
		const blob = await response.blob();

		return new Promise((resolve, reject) => {
			const img = new Image();

			img.onload = () => {
				const canvas = document.createElement("canvas");
				let width = img.width;
				let height = img.height;

				console.log("[ImageTransfer] Original dimensions:", width, "x", height);

				const aspectRatio = width / height;
				const isWide = aspectRatio > 2 || aspectRatio < 0.5;

				if (isWide) {
					console.log("[ImageTransfer] ⚠️ Wide image detected (ratio:", aspectRatio.toFixed(2), ") - applying extra compression");
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

				const ctx = canvas.getContext("2d");
				// Improve quality with image smoothing
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = "high";
				ctx.drawImage(img, 0, 0, width, height);

				// Start with lower quality for wide images
				let quality = isWide ? 0.65 : 0.75;
				let base64data = canvas.toDataURL("image/jpeg", quality);
				let currentSizeKB = (base64data.length * 0.75) / 1024; // More accurate base64 size

				console.log("[ImageTransfer] Initial compression:", {
					original: `${img.width}x${img.height}`,
					resized: `${width}x${height}`,
					quality: quality,
					size: `${currentSizeKB.toFixed(2)} KB`,
					isWide: isWide,
				});

				const qualitySteps = [0.6, 0.5, 0.4, 0.35, 0.3, 0.25];
				let stepIndex = 0;

				while (currentSizeKB > targetSizeKB && stepIndex < qualitySteps.length) {
					quality = qualitySteps[stepIndex];
					base64data = canvas.toDataURL("image/jpeg", quality);
					currentSizeKB = (base64data.length * 0.75) / 1024;

					stepIndex++;
				}

				if (currentSizeKB > targetSizeKB * 1.2) {
					const reductionFactor = isWide ? 0.6 : 0.7;
					canvas.width = Math.round(width * reductionFactor);
					canvas.height = Math.round(height * reductionFactor);

					ctx.clearRect(0, 0, canvas.width, canvas.height);
					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = "high";
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

					base64data = canvas.toDataURL("image/jpeg", 0.5);
					currentSizeKB = (base64data.length * 0.75) / 1024;

					console.log("[ImageTransfer] Further reduced:", {
						dimensions: `${canvas.width}x${canvas.height}`,
						size: `${currentSizeKB.toFixed(2)} KB`,
					});
				}

				if (currentSizeKB > 150) {
					console.log("[ImageTransfer] 🚨 EMERGENCY COMPRESSION - image too large!");

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
					ctx.imageSmoothingQuality = "medium";
					ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

					base64data = canvas.toDataURL("image/jpeg", 0.4);
					currentSizeKB = (base64data.length * 0.75) / 1024;

					console.log("[ImageTransfer] Emergency compression complete:", {
						dimensions: `${canvas.width}x${canvas.height}`,
						size: `${currentSizeKB.toFixed(2)} KB`,
					});
				}

				console.log("[ImageTransfer] ✅ Final result:", {
					dimensions: `${canvas.width}x${canvas.height}`,
					quality: quality,
					size: `${currentSizeKB.toFixed(2)} KB`,
					dataLength: base64data.length,
				});

				if (currentSizeKB > 200) {
					reject(new Error("Image too large to send - please try a different photo"));
					return;
				}

				resolve(base64data);
			};

			img.onerror = () => reject(new Error("Failed to load image"));
			img.src = URL.createObjectURL(blob);
		});
	} catch (err) {
		throw err;
	}
}
export async function sendImageToTablet(sendImageFn, imageSrc, position, maxRetries = 2) {
	if (!sendImageFn) {
		return false;
	}

	if (!imageSrc) {
		return false;
	}

	if (!position) {
		return false;
	}

	// Attempt to send with retries
	for (let attempt = 0; attempt <= maxRetries; attempt++) {
		try {
			if (attempt > 0) {
				console.log(`[ImageTransfer] 🔄 Retry attempt ${attempt}/${maxRetries}...`);
				// Wait before retrying
				await new Promise((resolve) => setTimeout(resolve, 500));
			}

			const base64data = await convertImageToBase64(imageSrc);

			const success = sendImageFn(base64data, position);

			if (success) {
				return true;
			} else {
				if (attempt === maxRetries) {
					return false;
				}
			}
		} catch (err) {
			if (attempt === maxRetries) {
				return false;
			}
		}
	}

	return false;
}

export const SWIPE_THRESHOLD = 100;

export function shouldTriggerSend(startY, currentY) {
	const swipeDelta = startY - currentY;
	return swipeDelta > SWIPE_THRESHOLD;
}

export function getSwipeTransform(startY, currentY) {
	const delta = Math.min(0, currentY - startY);
	const scale = 1 - Math.abs(delta) / 500;
	const opacity = Math.max(0.3, 1 - Math.abs(delta) / 300);

	return {
		transform: `translateY(${delta}px) scale(${scale})`,
		opacity,
	};
}
