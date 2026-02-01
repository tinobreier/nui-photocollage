import { useState, useEffect, useRef, useCallback } from "react";
import * as Comlink from "comlink";

export function useAprilTag() {
	const [isReady, setIsReady] = useState(false);
	const [error, setError] = useState(null);
	const apriltagRef = useRef(null);

	useEffect(() => {
		let mounted = true;

		async function init() {
			try {
				console.log("[AprilTag] Initializing detector...");

				// Create worker - use base path for GitHub Pages compatibility
				const basePath = import.meta.env.BASE_URL || "/";
				const workerUrl = new URL(basePath + "apriltag.js", window.location.origin).href;
				console.log("[AprilTag] Worker URL:", workerUrl);

				const worker = new Worker(workerUrl);
				const Apriltag = Comlink.wrap(worker);

				// Create detector instance
				const detector = await new Apriltag(
					Comlink.proxy(() => {
						console.log("[AprilTag] Detector ready!");
						if (mounted) {
							setIsReady(true);
						}
					}),
				);

				apriltagRef.current = detector;
			} catch (err) {
				console.error("[AprilTag] Failed to initialize:", err);
				if (mounted) {
					setError(err.message);
				}
			}
		}

		init();

		return () => {
			mounted = false;
		};
	}, []);

	const detect = useCallback(async (grayscalePixels, width, height) => {
		if (!apriltagRef.current) {
			return [];
		}

		try {
			const detections = await apriltagRef.current.detect(grayscalePixels, width, height);
			return detections || [];
		} catch (err) {
			console.error("[AprilTag] Detection error:", err);
			return [];
		}
	}, []);

	return {
		isReady,
		error,
		detect,
	};
}