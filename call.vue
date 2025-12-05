<template>
  <div class="min-h-screen bg-gray-900 text-white p-4">
    <!-- Header -->
    <div class="mb-6">
      <div class="flex flex-wrap justify-between items-center gap-4 mb-4">
        <div>
          <h1 class="text-2xl font-bold">
            Video Call Room
          </h1>
          <div class="flex flex-wrap gap-2 mt-2">
            <div class="px-3 py-1.5 bg-gray-800 rounded">
              <span class="text-sm">Room: {{ room }}</span>
            </div>
            <div class="px-3 py-1.5 bg-gray-800 rounded">
              <span class="text-sm">You: {{ userName }}</span>
            </div>
            <div class="px-3 py-1.5 bg-gray-800 rounded">
              <span class="text-sm">Users: {{ roomUsers?.length || 0 }}</span>
            </div>
            <div class="px-3 py-1.5 bg-green-900 rounded">
              <span class="text-sm">Connected: {{ peerConnections?.size || 0 }}</span>
            </div>
            <div class="px-3 py-1.5 bg-blue-900 rounded flex items-center">
              <span class="text-sm mr-2">Status:</span>
              <div class="flex items-center">
                <div
                  class="w-2 h-2 rounded-full mr-1"
                  :class="connectionStatusClass"
                />
                <span class="text-xs">{{ connectionStatusText }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="flex gap-2">
          <button
            class="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!socketConnected"
            @click="copyRoomLink"
          >
            📋 Copy Link
          </button>
          <button
            class="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!socketConnected"
            @click="forceReconnectAll"
          >
            🔄 Refresh All
          </button>
          <button
            class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!localStream"
            @click="toggleMedia('camera')"
          >
            {{ isCameraOn ? '📹' : '📴' }}
          </button>
          <button
            class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="!localStream"
            @click="toggleMedia('mic')"
          >
            {{ isMicOn ? '🎤' : '🔇' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Connection Status -->
    <div
      v-if="!socketConnected"
      class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg"
    >
      <div class="flex items-center">
        <div class="text-xl mr-3 animate-pulse">
          🔌
        </div>
        <div>
          <p class="font-medium">
            Connecting to server...
          </p>
          <p class="text-sm text-gray-300">
            Please wait while we establish connection
          </p>
        </div>
      </div>
    </div>

    <div
      v-else-if="!localStream"
      class="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg"
    >
      <div class="flex items-center">
        <div class="text-xl mr-3">
          ⚠️
        </div>
        <div>
          <p class="font-medium">
            Camera/Microphone Access Required
          </p>
          <p class="text-sm text-gray-300">
            Please allow access to your camera and microphone
          </p>
          <button
            class="mt-2 px-3 py-1 bg-yellow-600 rounded text-sm"
            @click="getLocalMedia"
          >
            Retry Media Access
          </button>
        </div>
      </div>
    </div>

    <div
      v-else-if="otherUsers?.length > 0 && peerConnections?.size < otherUsers.length"
      class="mb-4 p-3 bg-blue-900/50 border border-blue-700 rounded-lg"
    >
      <div class="flex items-center">
        <div class="text-xl mr-3 animate-pulse">
          🔄
        </div>
        <div>
          <p class="font-medium">
            Auto-connecting to {{ otherUsers.length - peerConnections.size }} user(s)...
          </p>
          <p class="text-sm text-gray-300">
            This happens automatically when others join
          </p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Sidebar - User List -->
      <div class="lg:col-span-1">
        <div class="bg-gray-800 rounded-lg overflow-hidden mb-6">
          <div class="p-4 bg-gray-700">
            <h3 class="font-bold flex items-center">
              <span class="mr-2">👥</span>
              Users in Room
              <span class="ml-2 px-2 py-1 bg-gray-600 rounded text-xs">
                {{ roomUsers?.length || 0 }}
              </span>
            </h3>
          </div>
          <div class="p-3 max-h-96 overflow-y-auto">
            <!-- Your Info -->
            <div class="mb-3 p-3 bg-blue-900/30 rounded-lg">
              <div class="flex items-center">
                <div class="text-2xl mr-3">
                  {{ userAvatar }}
                </div>
                <div class="flex-1">
                  <div class="font-medium">
                    {{ userName }}
                  </div>
                  <div class="text-xs text-gray-400">
                    You ({{ userId }})
                  </div>
                  <div class="text-xs mt-1">
                    <span class="px-2 py-0.5 bg-green-900 rounded mr-2">
                      {{ isCameraOn ? '📹 On' : '📹 Off' }}
                    </span>
                    <span class="px-2 py-0.5 bg-green-900 rounded">
                      {{ isMicOn ? '🎤 On' : '🎤 Off' }}
                    </span>
                  </div>
                </div>
                <div class="text-right">
                  <div class="text-xs px-2 py-1 bg-green-900 rounded">
                    Online
                  </div>
                </div>
              </div>
            </div>

            <!-- Other Users -->
            <div
              v-for="user in otherUsers"
              :key="user.id"
              class="mb-3 p-3 bg-gray-750 rounded-lg transition-all duration-300"
              :class="{
                'border-2 border-green-500': isConnectedToUser(user.id),
                'border border-yellow-500': isConnectingToUser(user.id),
                'border border-red-500': !user.isOnline,
                'hover:bg-gray-700': user.isOnline,
              }"
            >
              <div class="flex items-center justify-between">
                <div class="flex items-center">
                  <div class="text-2xl mr-3">
                    {{ user.avatar }}
                  </div>
                  <div>
                    <div class="font-medium">
                      {{ user.name }}
                    </div>
                    <div class="text-xs text-gray-400 flex items-center">
                      <span
                        class="w-2 h-2 rounded-full mr-2"
                        :class="user.isOnline ? 'bg-green-500' : 'bg-red-500'"
                      />
                      {{ user.isOnline ? 'Online' : 'Offline' }}
                      <span
                        v-if="userAudioLevels[user.id] > 0.1 && user.isOnline"
                        class="ml-2 text-green-400"
                      >
                        🔊 Speaking
                      </span>
                    </div>
                  </div>
                </div>

                <div class="text-right">
                  <div
                    v-if="isConnectedToUser(user.id)"
                    class="text-xs px-2 py-1 bg-green-900 rounded"
                  >
                    <div class="flex items-center">
                      <div class="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />
                      Live
                    </div>
                  </div>
                  <div
                    v-else-if="isConnectingToUser(user.id)"
                    class="text-xs px-2 py-1 bg-yellow-900 rounded"
                  >
                    <div class="flex items-center">
                      <div class="w-1.5 h-1.5 rounded-full bg-yellow-400 mr-1 animate-pulse" />
                      Connecting...
                    </div>
                  </div>
                  <div
                    v-else-if="user.isOnline"
                    class="text-xs px-2 py-1 bg-blue-900 rounded"
                  >
                    <div class="flex items-center">
                      <div class="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1" />
                      Ready
                    </div>
                  </div>
                  <div
                    v-else
                    class="text-xs px-2 py-1 bg-gray-900 rounded"
                  >
                    <div class="flex items-center">
                      <div class="w-1.5 h-1.5 rounded-full bg-gray-400 mr-1" />
                      Offline
                    </div>
                  </div>
                </div>
              </div>

              <!-- Audio Level -->
              <div
                v-if="userAudioLevels[user.id] > 0 && user.isOnline"
                class="mt-2"
              >
                <div class="flex items-center">
                  <div class="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-green-500 transition-all duration-100"
                      :style="{ width: `${Math.min(userAudioLevels[user.id] * 100, 100)}%` }"
                    />
                  </div>
                </div>
              </div>

              <!-- Connection Controls -->
              <div
                v-if="user.isOnline"
                class="mt-2 flex gap-2"
              >
                <button
                  v-if="!isConnectedToUser(user.id) && !isConnectingToUser(user.id)"
                  class="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 rounded"
                  @click="connectToUser(user.id)"
                >
                  Connect
                </button>
                <button
                  v-if="isConnectedToUser(user.id)"
                  class="flex-1 px-2 py-1 text-xs bg-red-600 hover:bg-red-700 rounded"
                  @click="disconnectFromUser(user.id)"
                >
                  Disconnect
                </button>
              </div>
            </div>

            <!-- Empty State -->
            <div
              v-if="!otherUsers || otherUsers.length === 0"
              class="text-center py-8 text-gray-400"
            >
              <div class="text-4xl mb-2">
                👤
              </div>
              <p>You're alone in this room</p>
              <p class="text-sm mt-1">
                Share the link below to invite others
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Center - Video Grid -->
      <div class="lg:col-span-2">
        <!-- Your Video -->
        <div class="mb-6">
          <div class="bg-gray-800 rounded-lg overflow-hidden">
            <div class="p-3 bg-gray-700 flex justify-between items-center">
              <div>
                <h3 class="font-bold">
                  Your Camera
                </h3>
                <div class="text-sm text-gray-300">
                  {{ userName }}
                </div>
              </div>
              <div class="flex items-center space-x-2">
                <div
                  class="text-xs px-2 py-1 rounded"
                  :class="isCameraOn ? 'bg-green-900' : 'bg-red-900'"
                >
                  {{ isCameraOn ? '📹 ON' : '📹 OFF' }}
                </div>
                <div
                  class="text-xs px-2 py-1 rounded"
                  :class="isMicOn ? 'bg-green-900' : 'bg-red-900'"
                >
                  {{ isMicOn ? '🎤 ON' : '🎤 OFF' }}
                </div>
              </div>
            </div>
            <div class="relative h-64 bg-black rounded-b-lg">
              <video
                ref="localVideo"
                autoplay
                muted
                playsinline
                class="w-full h-full object-cover"
                @loadeddata="onLocalVideoLoaded"
              />
              <div
                v-if="!isCameraOn || !localStream"
                class="absolute inset-0 flex items-center justify-center bg-gray-900"
              >
                <div class="text-center">
                  <div class="text-3xl mb-2">
                    {{ !localStream ? '🎥' : '📵' }}
                  </div>
                  <p class="text-sm">
                    {{ !localStream ? 'No Camera' : 'Camera Off' }}
                  </p>
                </div>
              </div>
              <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs flex items-center">
                <span class="mr-1">{{ userAvatar }}</span>
                You
              </div>
            </div>
          </div>
        </div>

        <!-- Remote Videos Grid -->
        <div>
          <div class="bg-gray-800 rounded-lg overflow-hidden">
            <div class="p-3 bg-gray-700">
              <h3 class="font-bold flex items-center">
                <span class="mr-2">📹</span>
                Remote Videos
                <span class="ml-2 px-2 py-1 bg-gray-600 rounded text-xs">
                  {{ remoteVideos.length }}
                </span>
              </h3>
            </div>
            <div class="p-4">
              <!-- Empty State -->
              <div
                v-if="remoteVideos.length === 0"
                class="flex items-center justify-center h-64 text-gray-400"
              >
                <div class="text-center">
                  <div class="text-4xl mb-3">
                    👥
                  </div>
                  <p>No one else is connected yet</p>
                  <p class="text-sm mt-1">
                    <span v-if="otherUsers && otherUsers.length > 0">
                      {{ otherUsers.filter(u => u.isOnline).length }} user(s) online
                    </span>
                    <span v-else>
                      Share the room link to invite others
                    </span>
                  </p>
                </div>
              </div>

              <!-- Videos Grid -->
              <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div
                  v-for="video in remoteVideos"
                  :key="video.userId"
                  class="relative bg-black rounded-lg overflow-hidden aspect-video"
                >
                  <video
                    :ref="el => setVideoElement(video.userId, el)"
                    autoplay
                    playsinline
                    class="w-full h-full object-cover"
                    :data-user-id="video.userId"
                    @loadeddata="onVideoLoaded(video.userId)"
                    @error="onVideoError(video.userId)"
                  />

                  <!-- Loading overlay -->
                  <div
                    v-if="!videoReadyStates[video.userId]"
                    class="absolute inset-0 flex items-center justify-center bg-gray-900/80"
                  >
                    <div class="text-center">
                      <div class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                      <div class="text-sm text-gray-300">
                        Loading video...
                      </div>
                    </div>
                  </div>

                  <!-- User Info Overlay -->
                  <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                    <div class="flex items-center justify-between">
                      <div class="text-sm font-medium">
                        {{ video.userName }}
                      </div>
                      <div class="text-xs px-2 py-1 bg-green-900/70 rounded flex items-center">
                        <div class="w-1.5 h-1.5 rounded-full bg-green-400 mr-1 animate-pulse" />
                        Live
                      </div>
                    </div>
                  </div>

                  <!-- Audio Indicator -->
                  <div
                    v-if="userAudioLevels[video.userId] > 0.05"
                    class="absolute top-2 right-2"
                  >
                    <div class="flex space-x-0.5">
                      <div
                        v-for="n in 3"
                        :key="n"
                        class="w-1 h-3 rounded bg-green-500"
                        :style="{
                          opacity: userAudioLevels[video.userId] > (n * 0.33) ? 1 : 0.3,
                          height: `${Math.min(userAudioLevels[video.userId] * 15, 12)}px`,
                        }"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Connection Log -->
        <div class="mt-6 bg-gray-800 rounded-lg p-4">
          <div class="flex justify-between items-center mb-3">
            <h3 class="font-bold flex items-center">
              <span class="mr-2">📝</span>
              Connection Log
            </h3>
            <button
              class="text-sm text-gray-400 hover:text-white"
              @click="logs = []"
            >
              Clear
            </button>
          </div>
          <div class="h-40 overflow-y-auto font-mono text-sm bg-black/50 rounded p-2">
            <div
              v-for="(log, index) in logs"
              :key="index"
              class="py-1 border-b border-gray-700 last:border-0"
              :class="{
                'text-green-400': log.includes('✅'),
                'text-red-400': log.includes('❌'),
                'text-yellow-400': log.includes('⚠️') || log.includes('🔄'),
                'text-blue-400': log.includes('📤') || log.includes('📨'),
              }"
            >
              {{ log }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { io, type Socket } from 'socket.io-client'

// ========== TYPE DEFINITIONS ==========
interface User {
  id: string
  name: string
  avatar: string
  isOnline: boolean
  joinedAt: string
  socketId?: string
}

interface RemoteVideo {
  userId: string
  userName: string
  stream: MediaStream
}

// ========== REACTIVE STATE ==========
const room = ref<string>('')
const userId = ref<string>('')
const userName = ref<string>('')
const userAvatar = ref<string>('👤')

const roomUsers = ref<User[]>([])
const peerConnections = ref<Map<string, RTCPeerConnection>>(new Map())
const remoteStreams = ref<Map<string, MediaStream>>(new Map())
const videoElements = ref<Map<string, HTMLVideoElement>>(new Map())
const connectionStatus = ref<Record<string, string>>({})
const userAudioLevels = ref<Record<string, number>>({})
const videoReadyStates = ref<Record<string, boolean>>({})
const audioAnalysers = ref<Map<string, AnalyserNode>>(new Map())
const audioContexts = ref<Map<string, AudioContext>>(new Map())

const isCameraOn = ref<boolean>(false)
const isMicOn = ref<boolean>(false)
const socketConnected = ref<boolean>(false)
const logs = ref<string[]>([])

// ========== DOM REFS ==========
const localVideo = ref<HTMLVideoElement | null>(null)

// ========== MEDIA ==========
let localStream: MediaStream | null = null
let socket: Socket | null = null

// ========== COMPUTED PROPERTIES ==========
const otherUsers = computed(() => {
  if (!roomUsers.value) return []
  return roomUsers.value.filter(user => user.id !== userId.value)
})

const remoteVideos = computed(() => {
  const videos: RemoteVideo[] = []
  remoteStreams.value.forEach((stream, userId) => {
    const user = roomUsers.value.find(u => u.id === userId)
    if (stream && stream.active && stream.getTracks().length > 0) {
      videos.push({
        userId,
        userName: user?.name || `User_${userId.slice(0, 4)}`,
        stream,
      })
    }
  })
  return videos
})

const connectionStatusClass = computed(() => {
  if (!socketConnected.value) return 'bg-red-500'
  if (peerConnections.value && peerConnections.value.size > 0) return 'bg-green-500'
  if (otherUsers.value && otherUsers.value.filter(u => u.isOnline).length > 0) return 'bg-yellow-500 animate-pulse'
  return 'bg-gray-500'
})

const connectionStatusText = computed(() => {
  if (!socketConnected.value) return 'Disconnected'
  if (peerConnections.value && peerConnections.value.size > 0) return 'Connected'
  if (otherUsers.value && otherUsers.value.filter(u => u.isOnline).length > 0) return 'Connecting...'
  return 'Waiting'
})

// ========== UTILITY FUNCTIONS ==========
const addLog = (message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info') => {
  const timestamp = new Date().toLocaleTimeString()
  const icons = {
    info: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '❌',
  }
  const log = `[${timestamp}] ${icons[type]} ${message}`
  logs.value.unshift(log)
  console.log(log)
  if (logs.value.length > 50) logs.value.pop()
}

const getUserName = (userId: string): string => {
  const user = roomUsers.value?.find(u => u.id === userId)
  return user?.name || `User_${userId?.slice(0, 4) || 'unknown'}`
}

const isConnectedToUser = (userId: string) => {
  const pc = peerConnections.value.get(userId)
  return pc && pc.connectionState === 'connected'
}

const isConnectingToUser = (userId: string) => {
  const pc = peerConnections.value.get(userId)
  return pc && (pc.connectionState === 'connecting' || pc.connectionState === 'new')
}

// ========== MEDIA HANDLING ==========
const getLocalMedia = async (): Promise<void> => {
  try {
    addLog('Requesting camera and microphone...', 'info')

    localStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    })

    if (localVideo.value) {
      localVideo.value.srcObject = localStream
      addLog('✅ Media access granted', 'success')
    }

    // Update status
    const videoTrack = localStream.getVideoTracks()[0]
    const audioTrack = localStream.getAudioTracks()[0]

    if (videoTrack) {
      isCameraOn.value = videoTrack.enabled
      addLog(`Video track ready`, 'info')
    }

    if (audioTrack) {
      isMicOn.value = audioTrack.enabled
      audioTrack.enabled = true
      addLog(`Audio track ready`, 'info')
    }

    // Notify server we're ready
    if (socket?.connected) {
      socket.emit('user-ready', {
        room: room.value,
        userId: userId.value,
        capabilities: {
          video: isCameraOn.value,
          audio: isMicOn.value,
        },
      })
    }
  }
  catch (error: any) {
    addLog(`❌ Cannot access camera/microphone: ${error.message}`, 'error')

    // Create empty stream for audio only
    try {
      addLog('Trying audio only...', 'warning')
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      isMicOn.value = true
      addLog('✅ Microphone ready', 'success')
    }
    catch (audioError: any) {
      addLog(`❌ Audio also failed: ${audioError.message}`, 'error')
      // Create dummy stream for connection purposes
      localStream = new MediaStream()
    }
  }
}

const toggleMedia = (type: 'camera' | 'mic') => {
  if (!localStream) return

  if (type === 'camera') {
    const videoTrack = localStream.getVideoTracks()[0]
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled
      isCameraOn.value = videoTrack.enabled
      addLog(`Camera ${isCameraOn.value ? 'enabled' : 'disabled'}`, 'info')

      // Update all peer connections
      peerConnections.value.forEach((pc, targetUserId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video')
        if (sender && videoTrack) {
          sender.replaceTrack(videoTrack)
        }
      })
    }
  }
  else {
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled
      isMicOn.value = audioTrack.enabled
      addLog(`Microphone ${isMicOn.value ? 'unmuted' : 'muted'}`, 'info')

      // Update all peer connections
      peerConnections.value.forEach((pc, targetUserId) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio')
        if (sender && audioTrack) {
          sender.replaceTrack(audioTrack)
        }
      })
    }
  }
}

// ========== WEBRTC CONNECTION ==========
const createPeerConnection = (targetUserId: string): RTCPeerConnection => {
  addLog(`Creating connection to ${getUserName(targetUserId)}...`, 'info')

  // Close existing if any
  const existingConnection = peerConnections.value.get(targetUserId)
  if (existingConnection) {
    try {
      existingConnection.close()
    }
    catch (e) {
      // Ignore close errors
    }
  }

  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
    ],
    iceCandidatePoolSize: 10,
  })

  // Handle incoming tracks
  pc.ontrack = (event: RTCTrackEvent) => {
    console.log(`🎬 ONTRACK from ${targetUserId}:`, event)

    let stream: MediaStream
    if (event.streams && event.streams.length > 0) {
      stream = event.streams[0]
    }
    else {
      stream = new MediaStream([event.track])
    }

    // Save stream
    remoteStreams.value.set(targetUserId, stream)
    addLog(`✅ Received ${event.track.kind} from ${getUserName(targetUserId)}`, 'success')

    // Setup audio monitoring if audio track
    if (event.track.kind === 'audio' && stream.getAudioTracks().length > 0) {
      setTimeout(() => {
        setupAudioMonitoring(targetUserId, stream)
      }, 1000)
    }

    // Update video element
    nextTick(() => {
      updateVideoElement(targetUserId, stream)
    })
  }

  // Add local tracks
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      if (track.enabled) {
        pc.addTrack(track, localStream)
      }
    })
  }

  // ICE candidates
  pc.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate && socket?.connected) {
      socket.emit('ice-candidate', {
        room: room.value,
        to: targetUserId,
        candidate: event.candidate,
      })
    }
  }

  // Connection state
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    connectionStatus.value[targetUserId] = state
    console.log(`Connection state with ${targetUserId}: ${state}`)

    if (state === 'connected') {
      addLog(`✅ Connected with ${getUserName(targetUserId)}`, 'success')
    }

    if (state === 'failed' || state === 'disconnected') {
      addLog(`⚠️ Connection ${state} with ${getUserName(targetUserId)}`, 'warning')

      // Auto-reconnect after delay
      setTimeout(() => {
        const user = roomUsers.value?.find(u => u.id === targetUserId)
        if (user?.isOnline) {
          addLog(`🔄 Reconnecting to ${getUserName(targetUserId)}...`, 'info')
          connectToUser(targetUserId)
        }
      }, 3000)
    }

    if (state === 'closed') {
      cleanupUserConnection(targetUserId)
    }
  }

  // ICE connection state
  pc.oniceconnectionstatechange = () => {
    console.log(`ICE connection state for ${targetUserId}:`, pc.iceConnectionState)
  }

  // Save connection
  peerConnections.value.set(targetUserId, pc)

  return pc
}

const connectToUser = async (targetUserId: string) => {
  if (targetUserId === userId.value || !socketConnected.value) return

  // Skip if already connected/connecting
  const existingPc = peerConnections.value.get(targetUserId)
  if (existingPc && (
    existingPc.connectionState === 'connected'
    || existingPc.connectionState === 'connecting'
  )) {
    return
  }

  addLog(`🔄 Connecting to ${getUserName(targetUserId)}...`, 'info')

  const pc = createPeerConnection(targetUserId)

  try {
    // Create and send offer
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    })

    await pc.setLocalDescription(offer)

    if (socket?.connected) {
      socket.emit('offer', {
        room: room.value,
        to: targetUserId,
        offer: offer,
      })
      addLog(`📤 Offer sent to ${getUserName(targetUserId)}`, 'info')
    }
  }
  catch (error: any) {
    addLog(`❌ Failed to connect to ${getUserName(targetUserId)}: ${error.message}`, 'error')
    cleanupUserConnection(targetUserId)
  }
}

const disconnectFromUser = (targetUserId: string) => {
  addLog(`Disconnecting from ${getUserName(targetUserId)}`, 'info')
  cleanupUserConnection(targetUserId)
}

const connectToAllUsers = async () => {
  if (!localStream || !socketConnected.value) return

  const others = otherUsers.value.filter(u => u.isOnline)
  if (others.length === 0) return

  addLog(`🔄 Connecting to all ${others.length} online users...`, 'info')

  for (const user of others) {
    if (user.id !== userId.value) {
      await connectToUser(user.id)
      // Delay to avoid overload
      await new Promise(resolve => setTimeout(resolve, 500))
    }
  }
}

// ========== AUDIO MONITORING ==========
const setupAudioMonitoring = (userId: string, stream: MediaStream) => {
  try {
    // Cleanup existing
    const existingContext = audioContexts.value.get(userId)
    if (existingContext) {
      existingContext.close()
    }

    const audioTracks = stream.getAudioTracks()
    if (audioTracks.length === 0) return

    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const analyser = audioContext.createAnalyser()
    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.8

    const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]]))
    audioSource.connect(analyser)

    audioContexts.value.set(userId, audioContext)
    audioAnalysers.value.set(userId, analyser)

    monitorAudioLevel(userId)
  }
  catch (error) {
    console.error(`Audio monitoring error for ${userId}:`, error)
  }
}

const monitorAudioLevel = (userId: string) => {
  const analyser = audioAnalysers.value.get(userId)
  if (!analyser) return

  const dataArray = new Uint8Array(analyser.frequencyBinCount)

  const updateLevel = () => {
    if (!analyser || !remoteStreams.value.has(userId)) return

    analyser.getByteFrequencyData(dataArray)
    let sum = 0
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i]
    }
    const level = (sum / dataArray.length) / 255

    userAudioLevels.value = {
      ...userAudioLevels.value,
      [userId]: level * 1.5, // Boost for better visibility
    }

    if (remoteStreams.value.has(userId)) {
      requestAnimationFrame(() => updateLevel())
    }
  }

  updateLevel()
}

// ========== VIDEO HANDLING ==========
const setVideoElement = (userId: string, element: HTMLVideoElement | null) => {
  if (!element) return

  videoElements.value.set(userId, element)
  const stream = remoteStreams.value.get(userId)
  if (stream && stream.active) {
    updateVideoElement(userId, stream)
  }
}

const updateVideoElement = (userId: string, stream: MediaStream) => {
  const videoElement = videoElements.value.get(userId)
  if (videoElement && videoElement.srcObject !== stream) {
    try {
      videoElement.srcObject = stream

      videoElement.play().then(() => {
        console.log(`✅ Video playing for ${userId}`)
        videoReadyStates.value[userId] = true
      }).catch((error) => {
        console.log(`Auto-play prevented for ${userId}:`, error)
        videoElement.muted = true
        videoElement.play().then(() => {
          videoReadyStates.value[userId] = true
        }).catch(console.error)
      })
    }
    catch (error) {
      console.error(`Error updating video for ${userId}:`, error)
    }
  }
}

const onVideoLoaded = (userId: string) => {
  console.log(`Video loaded for ${userId}`)
  videoReadyStates.value[userId] = true
}

const onVideoError = (userId: string) => {
  console.error(`Video error for ${userId}`)
  videoReadyStates.value[userId] = false
}

const onLocalVideoLoaded = () => {
  console.log('Local video loaded')
}

// ========== SOCKET.IO ==========
const connectSocket = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      const url = 'https://802xcm3x-4444.asse.devtunnels.ms/calls'

      addLog(`Connecting to signaling server...`, 'info')

      socket = io(url, {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        timeout: 20000,
        forceNew: true,
      })

      socket.on('connect', () => {
        socketConnected.value = true
        addLog('✅ Connected to signaling server', 'success')
        resolve()
      })

      socket.on('connect_error', (error: Error) => {
        socketConnected.value = false
        addLog(`❌ Connection error: ${error.message}`, 'error')
        reject(error)
      })

      socket.on('disconnect', (reason) => {
        socketConnected.value = false
        addLog(`Disconnected from server: ${reason}`, 'warning')
      })

      socket.on('join-confirmation', (data: any) => {
        console.log('Join confirmation:', data)
        addLog(`✅ Joined room ${data.room} successfully`, 'success')
      })

      socket.on('existing-users', (data: any) => {
        console.log('Existing users received:', data)
        const existingUsers = data?.users || []

        existingUsers.forEach((user: any) => {
          const existingUser = roomUsers.value.find(u => u.id === user.id)
          if (!existingUser) {
            roomUsers.value.push({
              id: user.id,
              name: user.name || `User_${user.id.slice(0, 4)}`,
              avatar: user.avatar || '👤',
              isOnline: user.isOnline || true,
              joinedAt: user.joinedAt || new Date().toISOString(),
              socketId: user.socketId,
            })
          }
        })

        if (localStream && existingUsers.length > 0) {
          addLog(`Found ${existingUsers.length} existing user(s)`, 'info')
          setTimeout(() => {
            connectToAllUsers()
          }, 2000)
        }
      })

      socket.on('user-joined', (data: any) => {
        console.log('User joined:', data)
        if (data?.user && data.user.id !== userId.value) {
          const userName = data.user.name || `User_${data.user.id.slice(0, 4)}`
          addLog(`👤 ${userName} joined the room`, 'info')

          // Add to list
          const existingUser = roomUsers.value.find(u => u.id === data.user.id)
          if (!existingUser) {
            roomUsers.value.push({
              id: data.user.id,
              name: userName,
              avatar: data.user.avatar || '👤',
              isOnline: true,
              joinedAt: new Date().toISOString(),
              socketId: data.user.socketId,
            })
          }
          else {
            existingUser.isOnline = true
            existingUser.socketId = data.user.socketId
          }

          // Auto-connect
          if (localStream) {
            setTimeout(() => {
              connectToUser(data.user.id)
            }, 1000)
          }
        }
      })

      socket.on('room-users-updated', (data: any) => {
        console.log('Room users updated:', data)
        roomUsers.value = data?.users || []
      })

      socket.on('user-left', (data: any) => {
        console.log('User left:', data)
        if (data?.userId && data.userId !== userId.value) {
          cleanupUserConnection(data.userId)
          addLog(`${getUserName(data.userId)} left`, 'info')

          // Update user status
          const userIndex = roomUsers.value.findIndex(u => u.id === data.userId)
          if (userIndex !== -1) {
            roomUsers.value.splice(userIndex, 1)
          }
        }
      })

      socket.on('user-disconnected', (data: any) => {
        console.log('User disconnected:', data)
        if (data?.userId && data.userId !== userId.value) {
          addLog(`${getUserName(data.userId)} disconnected`, 'warning')

          // Mark as offline
          const user = roomUsers.value.find(u => u.id === data.userId)
          if (user) {
            user.isOnline = false
          }
        }
      })

      socket.on('user-ready', (data: any) => {
        console.log('User ready:', data)
        if (data?.userId && data.userId !== userId.value) {
          addLog(`${getUserName(data.userId)} is ready`, 'info')
        }
      })

      socket.on('offer', async (data: any) => {
        console.log('📨 Received offer:', data)
        const senderId = data?.from
        if (!senderId) return

        addLog(`Incoming call from ${getUserName(senderId)}`, 'info')

        // Create or get peer connection
        let pc = peerConnections.value.get(senderId)
        if (!pc) {
          pc = createPeerConnection(senderId)
        }

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer))

          const answer = await pc.createAnswer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true,
          })

          await pc.setLocalDescription(answer)

          if (socket?.connected) {
            socket.emit('answer', {
              room: room.value,
              to: senderId,
              answer: answer,
            })
            addLog(`📤 Answered ${getUserName(senderId)}`, 'info')
          }
        }
        catch (error: any) {
          addLog(`❌ Failed to handle offer: ${error.message}`, 'error')
        }
      })

      socket.on('answer', async (data: any) => {
        console.log('📩 Received answer:', data)
        const senderId = data?.from
        if (!senderId) return

        const pc = peerConnections.value.get(senderId)
        if (pc && pc.signalingState !== 'closed') {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data.answer))
            addLog(`✅ Call established with ${getUserName(senderId)}`, 'success')
          }
          catch (error: any) {
            addLog(`❌ Failed to handle answer: ${error.message}`, 'error')
          }
        }
      })

      socket.on('ice-candidate', async (data: any) => {
        const senderId = data?.from
        const pc = peerConnections.value.get(senderId)

        if (pc && data?.candidate && pc.remoteDescription) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data.candidate))
            console.log(`✅ Added ICE candidate from ${senderId}`)
          }
          catch (error) {
            console.log(`ICE candidate error from ${senderId}:`, error)
          }
        }
      })

      socket.on('error', (data: any) => {
        addLog(`Server error: ${data?.message}`, 'error')
      })

      // Timeout
      setTimeout(() => {
        if (!socket?.connected) {
          addLog('Connection timeout', 'warning')
          resolve()
        }
      }, 10000)
    }
    catch (error) {
      console.error('Error connecting socket:', error)
      reject(error)
    }
  })
}

// ========== ROOM MANAGEMENT ==========
const copyRoomLink = () => {
  const link = `${window.location.origin}${window.location.pathname}?room=${room.value}`
  navigator.clipboard.writeText(link)
  addLog('Room link copied to clipboard!', 'success')
  alert('Room link copied! Share it with others.')
}

const forceReconnectAll = () => {
  addLog('🔄 Force reconnecting to all users...', 'info')

  // Close all connections
  peerConnections.value.forEach((pc, userId) => {
    cleanupUserConnection(userId)
  })

  // Reconnect to all
  setTimeout(() => {
    connectToAllUsers()
  }, 500)
}

const cleanupUserConnection = (userId: string) => {
  console.log(`Cleaning up connection for ${userId}`)

  // Cleanup peer connection
  const pc = peerConnections.value.get(userId)
  if (pc) {
    try {
      pc.onconnectionstatechange = null
      pc.onicecandidate = null
      pc.ontrack = null
      pc.close()
    }
    catch (e) {
      console.error(`Error closing connection for ${userId}:`, e)
    }
  }

  // Cleanup stream
  const stream = remoteStreams.value.get(userId)
  if (stream) {
    stream.getTracks().forEach(track => track.stop())
  }

  // Cleanup video element
  const videoElement = videoElements.value.get(userId)
  if (videoElement) {
    videoElement.srcObject = null
  }

  // Remove from maps
  peerConnections.value.delete(userId)
  remoteStreams.value.delete(userId)
  videoElements.value.delete(userId)

  // Cleanup audio
  const audioContext = audioContexts.value.get(userId)
  if (audioContext) {
    try {
      audioContext.close()
    }
    catch (e) {
      console.error(`Error closing audio context for ${userId}:`, e)
    }
  }
  audioContexts.value.delete(userId)
  audioAnalysers.value.delete(userId)

  // Cleanup state
  delete userAudioLevels.value[userId]
  delete connectionStatus.value[userId]
  delete videoReadyStates.value[userId]
}

// ========== INITIALIZATION ==========
const initialize = async () => {
  try {
    addLog('Initializing video call...', 'info')

    // Connect socket first
    await connectSocket()

    // Get media
    await getLocalMedia()

    // Join room
    if (socket?.connected) {
      socket.emit('join-room', {
        room: room.value,
        userId: userId.value,
        userInfo: {
          name: userName.value,
          avatar: userAvatar.value,
        },
      })
    }

    addLog('✅ System ready. Waiting for others...', 'success')
  }
  catch (error: any) {
    addLog(`❌ Initialization failed: ${error.message}`, 'error')
  }
}

// ========== LIFECYCLE ==========
onMounted(async () => {
  try {
    // Get room from URL
    const urlParams = new URLSearchParams(window.location.search)
    room.value = urlParams.get('room') || ''

    // Create room if needed
    if (!room.value) {
      room.value = `room_${Date.now()}`
      window.history.replaceState({}, '', `?room=${room.value}`)
      addLog(`Created new room: ${room.value}`, 'info')
    }

    // Create user info
    userId.value = `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    userName.value = `User_${userId.value.slice(-4)}`

    addLog(`Joining room: ${room.value}`, 'info')
    addLog(`Your ID: ${userId.value}`, 'info')

    // Initialize system
    await initialize()
  }
  catch (error: any) {
    console.error('Error in onMounted:', error)
    addLog(`❌ Failed to initialize: ${error.message}`, 'error')
  }
})

onUnmounted(() => {
  try {
    // Leave room
    if (socket?.connected) {
      socket.emit('leave-room', {
        room: room.value,
        userId: userId.value,
      })
      socket.disconnect()
    }

    // Cleanup local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop())
    }

    // Cleanup all peer connections
    peerConnections.value.forEach((pc) => {
      try {
        pc.close()
      }
      catch (e) {
        // Ignore
      }
    })
  }
  catch (error) {
    console.error('Error in onUnmounted:', error)
  }
})

// ========== WATCHERS ==========
watch(
  () => otherUsers.value,
  (newUsers, oldUsers) => {
    if (!newUsers || newUsers.length === 0) return

    // Find new online users
    const newOnlineUsers = newUsers.filter((newUser) => {
      if (!newUser.isOnline) return false
      if (!oldUsers || oldUsers.length === 0) return true
      const oldUser = oldUsers.find(u => u.id === newUser.id)
      return !oldUser || !oldUser.isOnline
    })

    // Auto-connect to new online users
    if (newOnlineUsers.length > 0 && localStream && socketConnected.value) {
      addLog(`🔄 Auto-connecting to ${newOnlineUsers.length} new user(s)...`, 'info')
      newOnlineUsers.forEach((user) => {
        if (user.id !== userId.value) {
          setTimeout(() => connectToUser(user.id), 1000)
        }
      })
    }
  },
  { deep: true },
)

// Auto-reconnect when socket reconnects
watch(() => socketConnected.value, (connected) => {
  if (connected && localStream) {
    addLog('Socket reconnected, re-establishing connections...', 'info')
    setTimeout(() => {
      connectToAllUsers()
    }, 1000)
  }
})
</script>

<style scoped>
video {
  transform: scaleX(-1);
}

.bg-gray-750 {
  background-color: #374151;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #374151;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #4B5563;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #6B7280;
}

/* Video grid */
.aspect-video {
  aspect-ratio: 16 / 9;
}

/* Animations */
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

.animate-spin {
  animation: spin 1s linear infinite;
}

/* Loading overlay */
.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* Connection status dots */
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
  margin-right: 4px;
}

.status-dot.connected { background-color: #10B981; }
.status-dot.connecting { background-color: #F59E0B; animation: pulse 1s infinite; }
.status-dot.disconnected { background-color: #EF4444; }
</style>
