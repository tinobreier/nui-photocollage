import { useState, useEffect, useCallback, useRef } from 'react'

const ROOM_CODE = "NUI-2026-PHOTOCOLLAGE"

export function usePlayroom() {
  const [isConnected, setIsConnected] = useState(false)
  const [isHost, setIsHost] = useState(false)
  const [playerCount, setPlayerCount] = useState(0)
  const [error, setError] = useState(null)

  const playroomRef = useRef(null)
  const rpcRef = useRef(null)
  const listenersRef = useRef([])

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Dynamically import playroomkit
        const Playroom = await import('playroomkit')

        if (!mounted) return

        const { insertCoin, onPlayerJoin, isHost: checkIsHost, onDisconnect, RPC } = Playroom

        playroomRef.current = Playroom
        rpcRef.current = RPC

        console.log('[Playroom] Joining room with code:', ROOM_CODE)

        await insertCoin({
          roomCode: ROOM_CODE,
          skipLobby: true,
          maxPlayersPerRoom: 9,
          baseUrl: window.location.origin + window.location.pathname, // new, testwise
          shouldWriteURL: false, // new, testwise
        })

        if (!mounted) return

        setIsConnected(true)
        setIsHost(checkIsHost())
        console.log('[Playroom] Connected! Is host:', checkIsHost())

        // Register RPC handler for marker confirmations
        RPC.register('marker-confirmed', (data, sender) => {
          console.log('[Playroom] RPC received marker-confirmed from:', sender.id, data)
          listenersRef.current.forEach(cb => {
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

        // Track players
        let players = new Map()

        onPlayerJoin((player) => {
          console.log('[Playroom] Player joined:', player.id)
          players.set(player.id, player)
          setPlayerCount(players.size)

          player.onQuit(() => {
            console.log('[Playroom] Player left:', player.id)
            players.delete(player.id)
            setPlayerCount(players.size)
          })
        })

        onDisconnect(() => {
          console.log('[Playroom] Disconnected from room')
          if (mounted) {
            setIsConnected(false)
          }
        })

      } catch (err) {
        console.error('[Playroom] Failed to initialize:', err)
        if (mounted) {
          setError(err.message)
          setIsConnected(false)
        }
      }
    }

    init()

    return () => {
      mounted = false
    }
  }, [])

  const sendMarkerConfirmation = useCallback((markerId, position) => {
    if (!rpcRef.current) {
      console.warn('[Playroom] Not connected, cannot send marker confirmation')
      return false
    }

    console.log('[Playroom] Sending marker confirmation via RPC:', markerId, position)

    rpcRef.current.call('marker-confirmed', {
      markerId,
      position,
      timestamp: Date.now()
    }, rpcRef.current.Mode.OTHERS)

    return true
  }, [])

  const onMessage = useCallback((callback) => {
    listenersRef.current.push(callback)
    return () => {
      listenersRef.current = listenersRef.current.filter(cb => cb !== callback)
    }
  }, [])

  return {
    isConnected,
    isHost,
    playerCount,
    error,
    sendMarkerConfirmation,
    onMessage,
  }
}

export { ROOM_CODE }
