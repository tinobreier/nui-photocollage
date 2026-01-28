import { useState, useEffect, useCallback } from 'react'

const ROOM_CODE = "NUI-2026-PHOTOCOLLAGE"

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
}

function notifySubscribers() {
  globalState.stateSubscribers.forEach(callback => callback())
}

export function usePlayroom() {
  const [, forceUpdate] = useState({})

  useEffect(() => {
    const callback = () => forceUpdate({})
    globalState.stateSubscribers.add(callback)
    return () => globalState.stateSubscribers.delete(callback)
  }, [])

  useEffect(() => {
    if (globalState.isInitialized || globalState.isInitializing) return;
    globalState.isInitializing = true

    async function init() {
      try {
        const Playroom = await import('playroomkit')
        const { insertCoin, onPlayerJoin, isHost: checkIsHost, onDisconnect, RPC } = Playroom

        globalState.playroom = Playroom
        globalState.rpc = RPC

        console.log('[Playroom] Initializing with code:', ROOM_CODE);

        await insertCoin({
          roomCode: ROOM_CODE,
          skipLobby: true,
          maxPlayersPerRoom: 9,
        })

        globalState.isInitialized = true
        globalState.isInitializing = false
        globalState.isConnected = true
        globalState.isHost = checkIsHost()
        console.log('[Playroom] Connected. Host:', globalState.isHost);
        notifySubscribers()

        RPC.register('marker-confirmed', (data, sender) => {
          // Edge Case: Ignore own RPC calls (sender is undefined when we are the sender)
          if (!sender?.id) return 'ok'

          console.log('[Playroom] RPC received: marker-confirmed from', sender.id, data);
          globalState.listeners.forEach(cb => {
            cb({
              type: 'marker-confirmed',
              markerId: data.markerId,
              position: data.position,
              playerId: sender.id
            })
          })
          return 'ok'
        })

        RPC.register('marker-cancelled', (_, sender) => {
          // Edge Case: Ignore own RPC calls (sender is undefined when we are the sender)
          if (!sender?.id) return 'ok'

          console.log('[Playroom] RPC received: marker-cancelled from', sender.id);
          globalState.listeners.forEach(cb => {
            cb({ type: 'marker-cancelled', playerId: sender.id })
          })
          return 'ok'
        })

        let players = new Map()

        onPlayerJoin((player) => {
          console.log('[Playroom] Player joined:', player.id);
          players.set(player.id, player)
          globalState.playerCount = players.size
          notifySubscribers()

          player.onQuit(() => {
            console.log('[Playroom] Player left:', player.id);
            players.delete(player.id)
            globalState.playerCount = players.size
            globalState.listeners.forEach(cb => {
              cb({ type: 'player-left', playerId: player.id })
            })
            notifySubscribers()
          })
        })

        onDisconnect(() => {
          console.log('[Playroom] Disconnected');
          globalState.isConnected = false
          notifySubscribers()
        })

      } catch (err) {
        console.error('[Playroom] Init Error:', err);
        globalState.isInitializing = false
        globalState.error = err.message
        notifySubscribers()
      }
    }

    init()
  }, [])

  const sendMarkerConfirmation = useCallback((markerId, position) => {
    if (!globalState.rpc) return false
    console.log('[Playroom] Sending marker-confirmed:', markerId, position);
    globalState.rpc.call('marker-confirmed', {
      markerId,
      position,
      timestamp: Date.now()
    }, globalState.rpc.Mode.OTHERS)
    return true
  }, [])

  const cancelMarker = useCallback(() => {
    if (!globalState.rpc) return
    console.log('[Playroom] Sending marker-cancelled');
    globalState.rpc.call('marker-cancelled', {}, globalState.rpc.Mode.OTHERS)
  }, [])

  const onMessage = useCallback((callback) => {
    globalState.listeners.push(callback)
    return () => {
      globalState.listeners = globalState.listeners.filter(cb => cb !== callback)
    }
  }, [])

  return {
    isConnected: globalState.isConnected,
    isHost: globalState.isHost,
    playerCount: globalState.playerCount,
    error: globalState.error,
    sendMarkerConfirmation,
    cancelMarker,
    onMessage,
  }
}