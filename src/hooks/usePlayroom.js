import { useState, useEffect, useCallback } from "react";

const ROOM_CODE = "NUI-2026-PHOTOCOLLAGE";

let globalState = {
	isInitializing: false,
	isInitialized: false,
	isConnected: false,
	isHost: false,
	playerCount: 0,
	error: null,
	playroom: null,
	rpc: null,
	listeners: [],
	stateSubscribers: new Set(),
	reservedMarkers: {},
	myPlayerId: null,
	players: new Map(),
};

function notifySubscribers() {
	globalState.stateSubscribers.forEach((callback) => callback());
}

export function usePlayroom() {
	const [, forceUpdate] = useState({});

	useEffect(() => {
		const callback = () => forceUpdate({});
		globalState.stateSubscribers.add(callback);
		return () => globalState.stateSubscribers.delete(callback);
	}, []);

	useEffect(() => {
		if (globalState.isInitialized || globalState.isInitializing) return;
		globalState.isInitializing = true;

		async function init() {
			try {
				const Playroom = await import("playroomkit");
				const { insertCoin, onPlayerJoin, isHost: checkIsHost, onDisconnect, RPC } = Playroom;

				globalState.playroom = Playroom;
				globalState.rpc = RPC;

				console.log("[Playroom] Initializing with code:", ROOM_CODE);

				await insertCoin({
					roomCode: ROOM_CODE,
					skipLobby: true,
					maxPlayersPerRoom: 9,
				});

				globalState.isInitialized = true;
				globalState.isInitializing = false;
				globalState.isConnected = true;
				globalState.isHost = checkIsHost();
				globalState.myPlayerId = Playroom.myPlayer()?.id || null;
				console.log("[Playroom] Connected. Host:", globalState.isHost, "MyId:", globalState.myPlayerId);
				notifySubscribers();

				// Request sync from others immediately after connecting
				console.log("[Playroom] >>> Requesting reservation sync from others (on connect)...");
				setTimeout(() => {
					RPC.call("sync-reservations-request", {}, RPC.Mode.OTHERS);
				}, 300);

				RPC.register("marker-confirmed", (data, sender) => {
					// Edge Case: Ignore own RPC calls (sender is undefined when we are the sender)
					if (!sender?.id) return "ok";

					console.log("[Playroom] RPC received: marker-confirmed from", sender.id, data);
					globalState.listeners.forEach((cb) => {
						cb({
							type: "marker-confirmed",
							markerId: data.markerId,
							position: data.position,
							playerId: sender.id,
						});
					});
					return "ok";
				});

				RPC.register("marker-cancelled", (data, sender) => {
					// Edge Case: Ignore own RPC calls (sender is undefined when we are the sender)
					if (!sender?.id) return "ok";

					console.log("[Playroom] RPC received: marker-cancelled from", sender.id);

					// Release the marker reservation
					const markerIdToRelease = Object.entries(globalState.reservedMarkers).find(([_, playerId]) => playerId === sender.id)?.[0];
					if (markerIdToRelease !== undefined) {
						delete globalState.reservedMarkers[markerIdToRelease];
						console.log("[Playroom] Released marker", markerIdToRelease, "from player", sender.id);
						notifySubscribers();
					}

					globalState.listeners.forEach((cb) => {
						cb({ type: "marker-cancelled", playerId: sender.id });
					});
					return "ok";
				});

				RPC.register("marker-reserved", (data, sender) => {
					console.log("[Playroom] >>> RPC marker-reserved received! sender:", sender, "data:", data);

					if (!sender?.id) {
						console.log("[Playroom] >>> Ignoring own RPC call (no sender.id)");
						return "ok";
					}

					console.log("[Playroom] >>> Processing marker-reserved from", sender.id, "for marker", data.markerId);
					console.log("[Playroom] >>> Current reservedMarkers before:", JSON.stringify(globalState.reservedMarkers));

					// Check if marker is already reserved by someone else
					const existingOwner = globalState.reservedMarkers[data.markerId];
					if (existingOwner && existingOwner !== sender.id) {
						console.log("[Playroom] >>> CONFLICT: Marker", data.markerId, "already reserved by", existingOwner);
						return "already-reserved";
					}

					// Reserve the marker
					globalState.reservedMarkers[data.markerId] = sender.id;
					console.log("[Playroom] >>> SUCCESS: Marker", data.markerId, "now reserved by", sender.id);
					console.log("[Playroom] >>> Current reservedMarkers after:", JSON.stringify(globalState.reservedMarkers));
					notifySubscribers();

					globalState.listeners.forEach((cb) => {
						cb({
							type: "marker-reserved",
							markerId: data.markerId,
							playerId: sender.id,
						});
					});
					return "ok";
				});

				// marker-released = when a player explicitly releases a marker
				RPC.register("marker-released", (data, sender) => {
					console.log("[Playroom] >>> RPC marker-released received! sender:", sender, "data:", data);

					if (!sender?.id) {
						console.log("[Playroom] >>> Ignoring own RPC call (no sender.id)");
						return "ok";
					}

					console.log("[Playroom] >>> Processing marker-released from", sender.id, "for marker", data.markerId);
					console.log("[Playroom] >>> Current reservedMarkers before:", JSON.stringify(globalState.reservedMarkers));

					// Only release if the sender owns this marker
					if (globalState.reservedMarkers[data.markerId] === sender.id) {
						delete globalState.reservedMarkers[data.markerId];
						console.log("[Playroom] >>> SUCCESS: Marker", data.markerId, "released by", sender.id);
						console.log("[Playroom] >>> Current reservedMarkers after:", JSON.stringify(globalState.reservedMarkers));
						notifySubscribers();

						globalState.listeners.forEach((cb) => {
							cb({
								type: "marker-released",
								markerId: data.markerId,
								playerId: sender.id,
							});
						});
					} else {
						console.log(
							"[Playroom] >>> SKIP: Marker",
							data.markerId,
							"not owned by",
							sender.id,
							"(owner:",
							globalState.reservedMarkers[data.markerId],
							")",
						);
					}
					return "ok";
				});

				// RPC for syncing reservations to new players
				RPC.register("sync-reservations-request", (data, sender) => {
					if (!sender?.id) return "ok";
					console.log("[Playroom] >>> Received sync-reservations-request from", sender.id);
					console.log("[Playroom] >>> Sending current reservations:", JSON.stringify(globalState.reservedMarkers));

					// Send our current reservations back to the requester
					RPC.call(
						"sync-reservations-response",
						{
							reservedMarkers: globalState.reservedMarkers,
						},
						RPC.Mode.OTHERS,
					);

					return "ok";
				});

				RPC.register("sync-reservations-response", (data, sender) => {
					if (!sender?.id) return "ok";
					console.log("[Playroom] >>> Received sync-reservations-response from", sender.id, "data:", data);

					// Merge received reservations into our state (don't overwrite our own)
					if (data.reservedMarkers) {
						Object.entries(data.reservedMarkers).forEach(([markerId, playerId]) => {
							// Only add if we don't already have this marker reserved by someone
							if (!globalState.reservedMarkers[markerId]) {
								globalState.reservedMarkers[markerId] = playerId;
								console.log("[Playroom] >>> Synced reservation: Marker", markerId, "owned by", playerId);
							}
						});
						console.log("[Playroom] >>> Reservations after sync:", JSON.stringify(globalState.reservedMarkers));
						notifySubscribers();
					}
					return "ok";
				});

				// RPC for sending images from phone to tablet
				RPC.register("image-sent", (data, sender) => {
					if (!sender?.id) return "ok";

					globalState.listeners.forEach((cb) => {
						cb({
							type: "image-sent",
							imageData: data.imageData,
							position: data.position,
							playerId: sender.id,
							timestamp: data.timestamp,
						});
					});
					return "ok";
				});

				RPC.register("kick-player-rpc", (data) => {
					if (data.playerId === globalState.myPlayerId) {
						console.log("Sie wurden vom Host entfernt.");
						window.location.reload();
					}
					return "ok";
				});

				onPlayerJoin((player) => {
					console.log("[Playroom] Player joined:", player.id);
					globalState.players.set(player.id, player);
					globalState.playerCount = globalState.players.size;
					notifySubscribers();

					player.onQuit(() => {
						console.log("[Playroom] Player left:", player.id);
						globalState.players.delete(player.id);
						globalState.playerCount = globalState.players.size;

						// Release any markers reserved by this player
						const markersToRelease = Object.entries(globalState.reservedMarkers)
							.filter(([_, playerId]) => playerId === player.id)
							.map(([markerId]) => markerId);

						markersToRelease.forEach((markerId) => {
							delete globalState.reservedMarkers[markerId];
							console.log("[Playroom] Auto-released marker", markerId, "from disconnected player", player.id);
						});

						globalState.listeners.forEach((cb) => {
							cb({ type: "player-left", playerId: player.id });
						});
						notifySubscribers();
					});
				});

				onDisconnect(() => {
					console.log("[Playroom] Disconnected");
					globalState.isConnected = false;
					notifySubscribers();
				});
			} catch (err) {
				console.error("[Playroom] Init Error:", err);
				globalState.isInitializing = false;
				globalState.error = err.message;
				notifySubscribers();
			}
		}

		init();
	}, []);

	const sendMarkerConfirmation = useCallback((markerId, position) => {
		if (!globalState.rpc) return false;
		console.log("[Playroom] Sending marker-confirmed:", markerId, position);

		globalState.rpc.call(
			"marker-confirmed",
			{
				markerId,
				position,
				timestamp: Date.now(),
			},
			globalState.rpc.Mode.OTHERS,
		);

		return true;
	}, []);

	const cancelMarker = useCallback(() => {
		if (!globalState.rpc) return;
		console.log("[Playroom] Sending marker-cancelled");
		globalState.rpc.call("marker-cancelled", {}, globalState.rpc.Mode.OTHERS);
	}, []);

	const reserveMarker = useCallback(async (markerId) => {
		console.log("[Playroom] reserveMarker() called with markerId:", markerId);
		console.log("[Playroom] Current state - rpc:", !!globalState.rpc, "myPlayerId:", globalState.myPlayerId);
		console.log("[Playroom] Current reservedMarkers:", JSON.stringify(globalState.reservedMarkers));

		if (!globalState.rpc) {
			console.log("[Playroom] reserveMarker() FAILED - no RPC available");
			return false;
		}

		// Check locally first if marker is already reserved
		const existingOwner = globalState.reservedMarkers[markerId];
		if (existingOwner && existingOwner !== globalState.myPlayerId) {
			console.log("[Playroom] reserveMarker() FAILED - Marker", markerId, "already reserved locally by", existingOwner);
			return false;
		}

		// Try to reserve via RPC and wait for response
		console.log("[Playroom] Sending marker-reserved RPC and waiting for response...");
		try {
			const response = await globalState.rpc.call(
				"marker-reserved",
				{
					markerId,
					timestamp: Date.now(),
				},
				globalState.rpc.Mode.OTHERS,
			);

			console.log("[Playroom] marker-reserved RPC response:", response);

			if (response === "already-reserved") {
				console.log("[Playroom] reserveMarker() FAILED - Another client reported marker already reserved");
				return false;
			}

			globalState.reservedMarkers[markerId] = globalState.myPlayerId;
			console.log("[Playroom] reserveMarker() SUCCESS - Reserved marker", markerId, "for", globalState.myPlayerId);
			console.log("[Playroom] Updated reservedMarkers:", JSON.stringify(globalState.reservedMarkers));
			notifySubscribers();

			return true;
		} catch (err) {
			console.log("[Playroom] reserveMarker() RPC error:", err);
			globalState.reservedMarkers[markerId] = globalState.myPlayerId;
			notifySubscribers();
			return true;
		}
	}, []);

	// Release a specific marker
	const releaseMarker = useCallback((markerId) => {
		if (!globalState.rpc) return;

		// Only release if we own it
		if (globalState.reservedMarkers[markerId] === globalState.myPlayerId) {
			delete globalState.reservedMarkers[markerId];
			console.log("[Playroom] Releasing marker", markerId);
			notifySubscribers();

			globalState.rpc.call(
				"marker-released",
				{
					markerId,
				},
				globalState.rpc.Mode.OTHERS,
			);
		}
	}, []);

	// Release all markers owned by this player
	const releaseAllMyMarkers = useCallback(() => {
		if (!globalState.rpc) return;

		const myMarkers = Object.entries(globalState.reservedMarkers)
			.filter(([_, playerId]) => playerId === globalState.myPlayerId)
			.map(([markerId]) => parseInt(markerId));

		myMarkers.forEach((markerId) => {
			delete globalState.reservedMarkers[markerId];
			globalState.rpc.call("marker-released", { markerId }, globalState.rpc.Mode.OTHERS);
		});

		if (myMarkers.length > 0) {
			console.log("[Playroom] Released all my markers:", myMarkers);
			notifySubscribers();
		}
	}, []);

	const getMarkerOwner = useCallback((markerId) => {
		return globalState.reservedMarkers[markerId] || null;
	}, []);

	const isMarkerAvailable = useCallback((markerId) => {
		const owner = globalState.reservedMarkers[markerId];
		const available = !owner || owner === globalState.myPlayerId;
		if (!available) {
			console.log("[Playroom] isMarkerAvailable(", markerId, ") = false, owned by:", owner, ", myId:", globalState.myPlayerId);
		}
		return available;
	}, []);

	const sendImage = useCallback((imageData, position) => {
		if (!globalState.rpc) {
			console.warn("cannot send image");
			return false;
		}

		try {
			globalState.rpc.call(
				"image-sent",
				{
					imageData,
					position,
					timestamp: Date.now(),
				},
				globalState.rpc.Mode.OTHERS,
			);

			console.log("Image sent successfully");
			return true;
		} catch (err) {
			console.error("Error sending image:", err);
			return false;
		}
	}, []);

	const onMessage = useCallback((callback) => {
		globalState.listeners.push(callback);
		return () => {
			globalState.listeners = globalState.listeners.filter((cb) => cb !== callback);
		};
	}, []);

	return {
		isConnected: globalState.isConnected,
		isHost: globalState.isHost,
		playerCount: globalState.playerCount,
		error: globalState.error,
		myPlayerId: globalState.myPlayerId,
		reservedMarkers: globalState.reservedMarkers,
		sendMarkerConfirmation,
		sendImage,
		cancelMarker,
		onMessage,
		reserveMarker,
		releaseMarker,
		releaseAllMyMarkers,
		getMarkerOwner,
		isMarkerAvailable,
		allPlayers: Array.from(globalState.players.values()),
		kickPlayer: (playerId) => {
			if (globalState.isHost && globalState.rpc) {
				globalState.rpc.call("kick-player-rpc", { playerId }, globalState.rpc.Mode.OTHERS);
			}
		},
		myPlayerId: globalState.myPlayerId,
	};
}