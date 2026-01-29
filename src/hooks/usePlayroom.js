import { useState, useEffect, useCallback, useRef } from 'react'

const ROOM_CODE = "NUI-2026-PHOTOCOLLAGE"

// Global singleton state for Playroom connection
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
  stateSubscribers: new Set(), // Functions to notify when state changes
}

// Notify all subscribers of state changes
function notifySubscribers() {
  globalState.stateSubscribers.forEach(callback => callback())
}

export function usePlayroom() {
  const [, forceUpdate] = useState({})

  // Subscribe to global state changes
  useEffect(() => {
    const callback = () => forceUpdate({})
    globalState.stateSubscribers.add(callback)
    return () => globalState.stateSubscribers.delete(callback)
  }, [])

  useEffect(() => {
    // If already initialized, no need to do anything
    if (globalState.isInitialized || globalState.isInitializing) {
      console.log('[Playroom] Already initialized or initializing, skipping...')
      return
    }
    globalState.isInitializing = true

    async function init() {
      try {
        console.log('[Playroom] 🔧 Starting initialization...')
        
        // Dynamically import playroomkit
        console.log('[Playroom] 📦 Importing playroomkit...')
        const Playroom = await import('playroomkit')
        console.log('[Playroom] ✅ Playroomkit loaded:', Playroom)

        const { insertCoin, onPlayerJoin, isHost: checkIsHost, onDisconnect, RPC } = Playroom

        globalState.playroom = Playroom
        globalState.rpc = RPC

        console.log('[Playroom] 🎮 Calling insertCoin with room code:', ROOM_CODE)

        await insertCoin({
          roomCode: ROOM_CODE,
          skipLobby: true,
          maxPlayersPerRoom: 9,
        })

        console.log('[Playroom] 🎉 insertCoin completed!')

        globalState.isInitialized = true
        globalState.isInitializing = false
        globalState.isConnected = true
        globalState.isHost = checkIsHost()
        console.log('[Playroom] Connected! Is host:', checkIsHost())
        notifySubscribers()

        // Register RPC handler for marker confirmations
        RPC.register('marker-confirmed', (data, sender) => {
          console.log('[Playroom] RPC received marker-confirmed from:', sender.id, data)
          globalState.listeners.forEach(cb => {
            try {
              cb({
                type: 'marker-confirmed',
                markerId: data.markerId,
                position: data.position,
                playerId: sender.id
              })
            } catch (err) {
              console.error('[Playroom] Error in listener:', err)
            }
          })
          return 'ok'
        })

        // Register RPC handler for image transfer
        RPC.register('image-sent', (data, sender) => {
          console.log('[Playroom] RPC received image from:', sender.id)
          globalState.listeners.forEach(cb => {
            try {
              cb({
                type: 'image-sent',
                imageData: data.imageData,
                position: data.position,
                playerId: sender.id,
                timestamp: data.timestamp
              })
            } catch (err) {
              console.error('[Playroom] Error in listener:', err)
            }
          })
          return 'ok'
        })

        // Track players
        let players = new Map()

        onPlayerJoin((player) => {
          console.log('[Playroom] Player joined:', player.id)
          players.set(player.id, player)
          globalState.playerCount = players.size
          notifySubscribers()

          player.onQuit(() => {
            console.log('[Playroom] Player left:', player.id)
            players.delete(player.id)
            globalState.playerCount = players.size
            notifySubscribers()
          })
        })

        onDisconnect(() => {
          console.log('[Playroom] Disconnected from room')
          globalState.isConnected = false
          notifySubscribers()
        })

      } catch (err) {
        globalState.isInitializing = false
        globalState.error = err.message
        console.error('[Playroom] ❌ Failed to initialize:', err)
        console.error('[Playroom] Error details:', {
          message: err.message,
          stack: err.stack,
          name: err.name
        })
        notifySubscribers()
      }
    }

    init()
  }, [])

  const sendMarkerConfirmation = useCallback((markerId, position) => {
    if (!globalState.rpc) {
      console.warn('[Playroom] Not connected, cannot send marker confirmation')
      return false
    }

    console.log('[Playroom] Sending marker confirmation via RPC:', markerId, position)

    globalState.rpc.call('marker-confirmed', {
      markerId,
      position,
      timestamp: Date.now()
    }, globalState.rpc.Mode.OTHERS)

    return true
  }, [])

  const sendImage = useCallback((imageData, position) => {
    if (!globalState.rpc) {
      console.warn('[Playroom] Not connected, cannot send image')
      return false
    }

    try {
      console.log('[Playroom] 📤 Sending image via RPC to position:', position)
      console.log('[Playroom] Image data length:', imageData?.length || 0)

      globalState.rpc.call('image-sent', {
        imageData,
        position,
        timestamp: Date.now()
      }, globalState.rpc.Mode.OTHERS)

      console.log('[Playroom] ✅ Image sent successfully')
      return true
    } catch (err) {
      console.error('[Playroom] ❌ Error sending image:', err)
      return false
    }
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
    sendImage,
    onMessage,
  }
}

export { ROOM_CODE }
