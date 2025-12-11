<template>
  <div
    class="h-screen bg-gray-900 text-white p-4 overflow-y-auto max-lg:flex max-lg:flex-col max-lg:justify-center max-lg:items-center">
    <template v-if="isCallReject">
      <div class="flex flex-col items-center justify-center h-full">
        <div class="mb-4">
          <Icon name="material-symbols:call-end" size="30" />
        </div>
        <h2 class="text-2xl font-bold mb-2">
          Cuộc gọi đã bị từ chối
        </h2>
        <button type="button" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white"
          @click="navigateTo('/')">
          Trang chủ
        </button>
      </div>
    </template>
    <template v-else>
      <template v-if="isCallEnded">
        <div class="flex flex-col items-center justify-center h-full">
          <div class="mb-4">
            <Icon name="material-symbols:call-end" size="30" />
          </div>
          <h2 class="text-2xl font-bold mb-2">
            Cuộc gọi đã kết thúc
          </h2>
          <button type="button" class="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded text-white"
            @click="navigateTo('/')">
            Trang chủ
          </button>
        </div>
      </template>
      <template v-else>
        <div v-if="isLoading" class="fixed inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div class="text-center">
            <div
              class="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <div class="text-lg">
              Đang khởi tạo...
            </div>
          </div>
        </div>

        <div v-if="!isPermissionGranted" class="fixed inset-0 bg-gray-900 flex items-center justify-center z-10 p-4">
          <div class="text-center bg-gray-800 p-6 rounded-lg shadow-lg">
            <div class="text-3xl mb-4">
              ⚠️
            </div>
            <h2 class="text-xl font-bold mb-2">
              Quyền truy cập camera/microphone bị từ chối
            </h2>
            <p class="mb-4">
              Vui lòng cho phép truy cập camera và microphone để tham gia cuộc gọi video.
            </p>

          </div>

        </div>
        <!-- Connection Status -->
        <div v-if="!isConnectedSocket" class="mb-4 p-3 bg-red-900/50 border border-red-700 rounded-lg">
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

        <div v-else-if="!localStream" class="mb-4 p-3 bg-yellow-900/50 border border-yellow-700 rounded-lg">
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
              <button class="mt-2 px-3 py-1 bg-yellow-600 rounded text-sm" @click="getLocalMedia">
                Retry Media Access
              </button>
            </div>
          </div>
        </div>


        <template v-if="isGroup">
          <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <!-- Left Sidebar - User List -->
            <div class="lg:col-span-1 flex flex-col">
              <!-- Your Video -->
              <div class="max-lg:order-last mb-6">
                <div class="bg-gray-800 rounded-lg overflow-hidden">
                  <div class="relative aspect-video flex justify-center items-center bg-black rounded-b-lg">
                    <video ref="localVideo" autoplay muted class="object-contain h-full" playsinline
                      @loadeddata="onLocalVideoLoaded" />
                    <div class="absolute left-0 top-0 text-xs mt-1 ml-1 flex justify-start items-center gap-x-1">
                      <p class="size-9 rounded-full flex justify-center items-center " :class="[
                        isCameraOn
                          ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20 text-white'
                          : 'bg-gradient-to-br from-gray-800/60 to-gray-900/50 text-gray-400'
                      ]">
                        <template v-if="isCameraOn">
                          <Icon size="15" name="ph:video-camera-fill" />
                        </template>
                        <template v-else>
                          <Icon size="15" name="ph:video-camera-slash-fill" />
                        </template>
                      </p>
                    </div>

                    <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs flex items-center">
                      <AvaterUser :key="user?.avatar" :src="user?.avatar"
                        class="mr-1 size-5 shadow-[rgba(50,50,93,0.25)_0px_6px_12px_-2px,_rgba(0,0,0,0.3)_0px_3px_7px_-3px]" />
                      Bạn
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- Center - Video Grid -->
            <div class="lg:col-span-3">
              <!-- Remote Videos Grid -->
              <div>
                <div class="bg-gray-800 rounded-lg overflow-hidden">
                  <div class="p-4">
                    <!-- Empty State -->
                    <div v-if="remoteVideos.length === 0" class="flex items-center justify-center h-64 text-gray-400">
                      <div class="text-center">
                        <div class="text-4xl mb-3">
                          👥
                        </div>
                        <p>Chưa có ai kết nối</p>
                      </div>
                    </div>
                    <!-- Videos Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div v-for="video in remoteVideos" :key="video.userId"
                        class="relative  bg-black rounded-lg overflow-hidden aspect-video flex justify-center items-center">
                        <video :ref="(el: HTMLVideoElement) => setVideoElement(video.userId, el)" autoplay playsinline
                          class="object-contain h-full" :data-user-id="video.userId"
                          @loadeddata="onVideoLoaded(video.userId)" @error="onVideoError(video.userId)" />

                        <!-- Loading overlay -->
                        <div v-if="!videoReadyStates[video.userId]"
                          class="absolute inset-0 flex items-center justify-center bg-gray-900/80 size-full">
                          <div class="text-center">
                            <div
                              class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                            <div class="text-sm text-gray-300">
                              Loading video...
                            </div>
                          </div>
                        </div>

                        <div class="absolute left-0 top-0 text-xs mt-1 ml-1 flex justify-start items-center gap-x-1">
                          <p class="size-9 rounded-full flex justify-center items-center " :class="[
                            video.capabilities?.video
                              ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20 text-white'
                              : 'bg-gradient-to-br from-gray-800/60 to-gray-900/50 text-gray-400'
                          ]">
                            <template v-if="video.capabilities?.video">
                              <Icon size="15" name="ph:video-camera-fill" />
                            </template>
                            <template v-else>
                              <Icon size="15" name="ph:video-camera-slash-fill" />
                            </template>
                          </p>
                          <div
                            class="relative size-9 rounded-full flex justify-center items-center transition-all duration-500"
                            :class="[
                              video.capabilities?.audio
                                ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20'
                                : 'bg-gradient-to-br from-gray-800/60 to-gray-900/50'
                            ]">

                            <!-- Icon chính -->
                            <Icon size="17"
                              :name="video.capabilities?.audio ? 'famicons:mic-sharp' : 'famicons:mic-off-sharp'"
                              class="relative z-10 transition-all duration-300" :class="[
                                video.capabilities?.audio
                                  ? userAudioLevels[video.userId]! > 0.05
                                    ? 'text-green-400 scale-105'
                                    : 'text-green-300'
                                  : 'text-gray-400'
                              ]" :style="{
                              filter: video.capabilities?.audio && userAudioLevels[video.userId]! > 0.05
                                ? `drop-shadow(0 0 ${4 + userAudioLevels[video.userId]! * 8}px rgba(74, 222, 128, 0.5))`
                                : 'none'
                            }" />

                            <!-- Live indicator dot -->
                            <div class="absolute top-1 right-1 size-2 rounded-full 
                              bg-gradient-to-br from-green-400 to-emerald-500 
                              border border-white/50 shadow-lg shadow-green-500/50" :style="{
                                animation: userAudioLevels[video.userId]! > 0.1
                                  ? 'pulse-rapid 0.4s infinite'
                                  : 'pulse 1.5s infinite'
                              }" />
                          </div>
                        </div>

                        <!-- User Info Overlay -->
                        <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                          <div class="text-sm  font-medium line-clamp-1">
                            {{ video.userName }}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>


            </div>
          </div>
        </template>
        <template v-else>
          <div v-show="isCameraOn"
            class="lg:fixed lg:z-50 lg:bottom-20 lg:right-0  lg:mb-6 lg:mr-6 bg-black rounded-lg overflow-hidden lg:max-w-sm w-full max-lg:mb-10">
            <div class="relative aspect-video flex justify-center items-center ">
              <video ref="localVideo" autoplay muted class="object-contain h-full" playsinline
                @loadeddata="onLocalVideoLoaded" />
              <div class="absolute left-0 top-0 text-xs mt-1 ml-1 flex justify-start items-center gap-x-1">
                <p
                  class="size-9 rounded-full flex justify-center items-center bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20 text-white ">
                  <Icon size="15" name="ph:video-camera-fill" />
                </p>
              </div>

              <div class="absolute bottom-2 left-2 px-2 py-1 bg-black/70 rounded text-xs flex items-center">
                <AvaterUser :key="user?.avatar" :src="user?.avatar"
                  class="mr-1 size-5 shadow-[rgba(50,50,93,0.25)_0px_6px_12px_-2px,_rgba(0,0,0,0.3)_0px_3px_7px_-3px]" />
                Bạn
              </div>
            </div>
          </div>

          <div class="rounded-lg overflow-hidden lg:h-full lg:w-full">
            <div v-if="remoteVideos.length === 0" class="flex items-center justify-center  text-gray-400 h-full">
              <div class="text-center">
                <div
                  class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <p>Đang kết nối tới...</p>
              </div>
            </div>
            <template v-else>
              <div v-for="video in remoteVideos" :key="video.userId"
                class="relative  bg-black rounded-lg overflow-hidden aspect-video flex justify-center items-center size-full">
                <video :ref="(el: HTMLVideoElement) => setVideoElement(video.userId, el)" autoplay playsinline
                  class="object-contain size-full" :data-user-id="video.userId"
                  @loadeddata="onVideoLoaded(video.userId)" @error="onVideoError(video.userId)" />

                <!-- Loading overlay -->
                <div v-if="!videoReadyStates[video.userId]"
                  class="absolute inset-0 flex items-center justify-center bg-gray-900/80">
                  <div class="text-center">
                    <div
                      class="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    <div class="text-sm text-gray-300">
                      Loading video...
                    </div>
                  </div>
                </div>

                <div class="absolute left-0 top-0 text-xs mt-1 ml-1 flex justify-start items-center gap-x-1">
                  <p v-if="hasVideo" class="size-9 rounded-full flex justify-center items-center " :class="[
                    video.capabilities?.video
                      ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20 text-white'
                      : 'bg-gradient-to-br from-gray-800/60 to-gray-900/50 text-gray-400'
                  ]">
                    <template v-if="video.capabilities?.video">
                      <Icon size="15" name="ph:video-camera-fill" />
                    </template>
                    <template v-else>
                      <Icon size="15" name="ph:video-camera-slash-fill" />
                    </template>
                  </p>
                  <div class="relative size-9 rounded-full flex justify-center items-center transition-all duration-500"
                    :class="[
                      video.capabilities?.audio
                        ? 'bg-gradient-to-br from-green-500/20 via-emerald-500/15 to-green-500/20'
                        : 'bg-gradient-to-br from-gray-800/60 to-gray-900/50'
                    ]">

                    <!-- Icon chính -->
                    <Icon size="17" :name="video.capabilities?.audio ? 'famicons:mic-sharp' : 'famicons:mic-off-sharp'"
                      class="relative z-10 transition-all duration-300" :class="[
                        video.capabilities?.audio
                          ? userAudioLevels[video.userId]! > 0.05
                            ? 'text-green-400 scale-105'
                            : 'text-green-300'
                          : 'text-gray-400'
                      ]" :style="{
                      filter: video.capabilities?.audio && userAudioLevels[video.userId]! > 0.05
                        ? `drop-shadow(0 0 ${4 + userAudioLevels[video.userId]! * 8}px rgba(74, 222, 128, 0.5))`
                        : 'none'
                    }" />

                    <!-- Live indicator dot -->
                    <div v-if="video.capabilities?.audio" class="absolute top-1 right-1 size-2 rounded-full 
                              bg-gradient-to-br from-green-400 to-emerald-500 
                              border border-white/50 shadow-lg shadow-green-500/50" :style="{
                                animation: userAudioLevels[video.userId]! > 0.1
                                  ? 'pulse-rapid 0.4s infinite'
                                  : 'pulse 1.5s infinite'
                              }" />
                  </div>
                </div>

                <!-- User Info Overlay -->
                <div class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <div class="text-sm  font-medium line-clamp-1">
                    {{ video.userName }}
                  </div>
                </div>
              </div>
            </template>
          </div>
        </template>

        <div class="fixed bottom-0 left-1/2 -translate-x-1/2 flex justify-center items-center gap-4 mb-10">
          <div class=" flex gap-2">
            <button v-if="hasVideo" type="button"
              class="px-4 py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              :class="isCameraOn ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'"
              :disabled="!localStream" @click="toggleMedia('camera')">
              <template v-if="isCameraOn">
                <Icon size="20" name="ph:video-camera-fill" />
              </template>
              <template v-else>
                <Icon size="20" name="ph:video-camera-slash-fill" />
              </template>
            </button>
            <button type="button"
              class="px-4 py-2  rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              :class="isMicOn ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'"
              :disabled="!localStream" @click="toggleMedia('mic')">
              <template v-if="isMicOn">
                <Icon size="20" name="famicons:mic-sharp" />
              </template>
              <template v-else>
                <Icon size="20" name="famicons:mic-off-sharp" />
              </template>
            </button>
            <button type="button" @click="endRoomCallAll"
              class="px-4 py-2 bg-red-600 hover:bg-red-700 rounded disabled:opacity-50 disabled:cursor-not-allowed flex items-center">
              <Icon size="24" name="material-symbols:call-end" />
            </button>
          </div>
        </div>
      </template>
    </template>


  </div>
</template>

<script setup lang="ts">
import type { IConversation } from '~~/interfaces/conversation'


// ========== TYPE DEFINITIONS ==========
interface User {
  id: string
  full_name: string
  avatar: string
  isOnline: boolean
  socketId?: string
  capabilities: {
    video?: boolean
    audio?: boolean
    bandwidth?: string
  }
}

interface RemoteVideo {
  userId: string
  userName: string
  stream: MediaStream
  capabilities: {
    video?: boolean
    audio?: boolean
    bandwidth?: string
  }
}
definePageMeta({
  middleware: ['auth'],
})

const { sendMessageSocket, onEventSocket } = useSocketChatStore()
const { isConnected: isConnectedSocket } = storeToRefs(useSocketChatStore())
const authStore = useAuthStore()
const { user, userId } = storeToRefs(authStore)

const route = useRoute()
// ========== REACTIVE STATE ==========
const callerId = ref<string>(route.query.callerId as string || '') // ID của người gọi
const room = ref<string>('') // ID phòng cuộc gọi
const hasVideo = ref<boolean>(true) // Có video hay không
const isLoading = ref<boolean>(true) // Trạng thái tải
const isPermissionGranted = ref<boolean>(false) // Trạng thái quyền truy cập
const roomUsers = ref<User[]>([]) // Danh sách người dùng trong phòng
const peerConnections = ref<Map<string, RTCPeerConnection>>(new Map()) // Kết nối peer
const remoteStreams = ref<Map<string, MediaStream>>(new Map()) // Luồng media từ xa
const videoElements = ref<Map<string, HTMLVideoElement>>(new Map()) // Phần tử video từ xa
const userAudioLevels = ref<Record<string, number>>({}) // Mức độ âm thanh của người dùng
const videoReadyStates = ref<Record<string, boolean>>({}) // Trạng thái sẵn sàng của video
const audioAnalysers = ref<Map<string, AnalyserNode>>(new Map()) // Audio analysers cho mỗi người dùng
const audioContexts = ref<Map<string, AudioContext>>(new Map()) // Audio contexts cho mỗi người dùng
const isCallEnded = ref<boolean>(false) // Trạng thái cuộc gọi đã kết thúc
const isCameraOn = ref<boolean>(false) // Trạng thái camera
const isMicOn = ref<boolean>(false) // Trạng thái microphone
const logs = ref<string[]>([])
const isCallReject = ref<boolean>(false) // Trạng thái cuộc gọi bị từ chối
const isInitSuccess = computed(() => {
  return isPermissionGranted.value && isConnectedSocket.value && localStream !== null && localStream.getTracks().length > 0 && !isLoading.value
}) // Trạng thái khởi tạo thành công

// ========== DOM REFS ==========
const localVideo = ref<HTMLVideoElement | null>(null)

// ========== MEDIA ==========
let localStream: MediaStream | null = null

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
        userName: user?.full_name || `User_${userId.slice(0, 4)}`,
        stream,
        capabilities: user?.capabilities || {},
      })
    }
  })
  return videos
})


const isGroup = computed(() => {
  return conversation.value?.is_group
})
const {
  data: conversation,
} = await useFetchChat<IConversation>(() => `/api/converse/v1/chat/conversation/${route.query.room}`)


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
  // console.log(log)
  if (logs.value.length > 50) logs.value.pop()
}

const getUserName = (userId: string): string => {
  const user = roomUsers.value?.find(u => u.id === userId)
  return user?.full_name || `User_${userId?.slice(0, 4) || 'unknown'}`
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
    const constraints: MediaStreamConstraints = {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: hasVideo.value ? {
        width: { ideal: 640 },
        height: { ideal: 480 },
        facingMode: 'user',
      } : false
    }

    console.log('UserMedia constraints:', constraints)

    // QUAN TRỌNG: Dòng này sẽ fail nếu không được gọi từ user gesture
    localStream = await navigator.mediaDevices.getUserMedia(constraints)

    if (localVideo.value && hasVideo.value) {
      localVideo.value.srcObject = localStream
      addLog('✅ Media access granted', 'success')
    }

    // Update status
    if (hasVideo.value) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        isCameraOn.value = videoTrack.enabled
        addLog(`Video track ready`, 'info')
      }

    }
    // Update status
    const audioTrack = localStream.getAudioTracks()[0]
    if (audioTrack) {
      isMicOn.value = audioTrack.enabled
      audioTrack.enabled = true
      addLog(`Audio track ready`, 'info')
    }

    // Notify server we're ready
    if (isConnectedSocket.value) {
      sendMessageSocket('call-user-ready', {
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
      sendMessageSocket('call-user-toggle-media', {
        room: room.value,
        mediaType: type,
        enabled: isCameraOn.value,
      })
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
      sendMessageSocket('call-user-toggle-media', {
        room: room.value,
        mediaType: type,
        enabled: isMicOn.value,
      })
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

  // Đảm bảo đóng kết nối cũ trước khi tạo kết nối mới
  const connection = peerConnections.value.get(targetUserId);
  if (connection) {
    try {
      connection.close(); // Đóng kết nối peer cũ
    } catch (e) {
      console.error('Error closing connection with', targetUserId, e);
    }
    peerConnections.value.delete(targetUserId); // Xóa kết nối khỏi danh sách
  }

  const pc = new RTCPeerConnection({

    // iceServers: stunSeverDefault.map(url => ({ urls: url })),

    iceServers: [


      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' },
      // {
      //   urls: 'turn:turn.example.com:3478', // TURN server của bạn
      //   username: 'your-username',
      //   credential: 'your-credential',
      // }
    ],
    iceCandidatePoolSize: 10,
  })

  // Handle incoming tracks
  pc.ontrack = (event: RTCTrackEvent) => {
    console.log(`🎬 ONTRACK from ${targetUserId}:`, event)

    let stream: MediaStream
    if (event.streams && event.streams.length > 0) {
      stream = event.streams[0]!
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
    if (event.candidate && isConnectedSocket.value) {
      sendMessageSocket('call-ice-candidate', {
        room: room.value,
        to: targetUserId,
        candidate: event.candidate,
      })
    }
  }

  // Connection state
  pc.onconnectionstatechange = () => {
    const state = pc.connectionState
    console.log(`Connection state with ${targetUserId}: ${state}`)

    if (state === 'connected') {
      addLog(`✅ Connected with ${getUserName(targetUserId)}`, 'success')
    }

    if (state === 'failed' || state === 'disconnected') {
      addLog(`⚠️ Connection ${state} with ${getUserName(targetUserId)}`, 'warning')

      // Tự động thử kết nối lại sau 3 giây nếu người dùng vẫn online
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
  if (targetUserId === userId.value || !isConnectedSocket.value) return

  //Bỏ qua nếu đã kết nối/đang kết nối
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
      offerToReceiveVideo: hasVideo.value,
    })

    await pc.setLocalDescription(offer)

    if (isConnectedSocket.value) {
      sendMessageSocket('call-offer', {
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
  if (!localStream || !isConnectedSocket.value) return

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

    const audioSource = audioContext.createMediaStreamSource(new MediaStream([audioTracks[0]!]))
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
      sum += dataArray[i]!
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
const setVideoElement = (userId: string, element: HTMLVideoElement) => {
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
const setupSocketEvent = async () => {

  onEventSocket('call-callVideoRejected', (data: any) => {
    console.log('Call rejected:', data)
    isCallReject.value = true
    addLog(`❌ Call rejected by ${getUserName(data.from)}`, 'error')
    endRoomCallAll()
  })
  onEventSocket('call-join-confirmation', (data: any) => {
    console.log('Join confirmation:', data)
    addLog(`✅ Joined room ${data.room} successfully`, 'success')
  })

  onEventSocket('call-existing-users', (data: any) => {
    console.log('Existing users received:', data)
    const existingUsers = data?.users || []

    existingUsers.forEach((user: any) => {
      const existingUser = roomUsers.value.find(u => u.id === user.id)
      if (!existingUser) {
        roomUsers.value.push({
          id: user.id,
          full_name: user.full_name || `User_${user.id.slice(0, 4)}`,
          avatar: user.avatar || '👤',
          isOnline: user.isOnline || true,
          socketId: user.socketId,
          capabilities: user.capabilities ?? {},
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

  onEventSocket('call-user-joined', (data: {
    user: {
      _id: string
      full_name: string
      avatar: string
      socketId: string
      capabilities: {
        video?: boolean
        audio?: boolean
        bandwidth?: string
      }
    }
    room: string
  }) => {
    if (data?.user && data.user._id !== userId.value) {
      const userName = data.user.full_name || `User_${data.user._id.slice(0, 4)}`
      addLog(`👤 ${userName} joined the room`, 'info')

      // Add to list
      const existingUser = roomUsers.value.find(u => u.id === data.user._id)
      if (!existingUser) {
        roomUsers.value.push({
          id: data.user._id,
          full_name: userName,
          avatar: data.user.avatar || '👤',
          isOnline: true,
          socketId: data.user.socketId,
          capabilities: data.user.capabilities ?? {},
        })
      }
      else {
        existingUser.isOnline = true
        existingUser.socketId = data.user.socketId
      }

      // Auto-connect
      if (localStream) {
        setTimeout(() => {
          connectToUser(data.user._id)
        }, 1000)
      }
    }
  })

  // câp nhật danh sách người dùng trong phòng
  onEventSocket('call-room-users-updated', (data: any) => {
    console.log('Room users updated:', data)
    roomUsers.value = data?.users || []
  })

  onEventSocket('call-user-left', (data: any) => {
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

  onEventSocket('call-user-disconnected', (data: any) => {
    console.log('User disconnected:', data)
    if (data?.userId && data.userId !== userId.value) {
      addLog(`${getUserName(data.userId)} disconnected`, 'warning')

      peerConnections.value.forEach((pc, userId) => {
        if (userId === data.userId) {
          cleanupUserConnection(data.userId)
        }
      })
      roomUsers.value.splice(
        roomUsers.value.findIndex(u => u.id === data.userId),
        1
      )
    }
  })

  onEventSocket('call-user-ready', (data: any) => {
    console.log('User ready:', data)
    if (data?.userId && data.userId !== userId.value) {
      addLog(`${getUserName(data.userId)} is ready`, 'info')
    }
  })

  onEventSocket('call-offer', async (data: any) => {
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

      if (isConnectedSocket.value) {
        sendMessageSocket('call-answer', {
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

  onEventSocket('call-answer', async (data: any) => {
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

  onEventSocket('call-ice-candidate', async (data: any) => {
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


  onEventSocket('call-media-toggled', (data: any) => {
    console.log('Media toggled:', data)
    const user = roomUsers.value.find(u => u.id === data.userId)
    if (user) {
      if (data.mediaType === 'camera') {
        user.capabilities.video = data.enabled
        addLog(`${getUserName(data.userId)} has ${user.capabilities.video ? 'enabled' : 'disabled'} their camera`, 'info')
      }
      else if (data.mediaType === 'mic') {
        user.capabilities.audio = data.enabled
        addLog(`${getUserName(data.userId)} has ${user.capabilities.audio ? 'unmuted' : 'muted'} their microphone`, 'info')
      }
    }
  })
  onEventSocket('call-room-call-ended', (data: any) => {
    addLog('The call has been ended by the host.', 'warning')
    isCallEnded.value = true
    cleanupUserConnections()
    window.close()
  })

  onEventSocket('error', (data: any) => {
    addLog(`Server error: ${data?.message}`, 'error')
  })
}

// ========== ROOM MANAGEMENT ==========


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
  delete videoReadyStates.value[userId]
}

// ========== INITIALIZATION ==========
const initialize = async () => {
  try {
    addLog('Initializing video call...', 'info')
    // Get media
    await getLocalMedia()
    if (isConnectedSocket.value) {
      await setupSocketEvent()
      if (userId.value == callerId.value) {
        sendMessageSocket('call-callVideoRequest', {
          conversation_id: room.value,
          caller_id: userId.value,
          has_video: hasVideo.value,
        })
      }
      sendMessageSocket('call-join-room', {
        room: room.value,
        userId: userId.value,
        capabilities: {
          video: isCameraOn.value,
          audio: isMicOn.value,
        },
      })
    }

    addLog('✅ System ready. Waiting for others...', 'success')
  }
  catch (error: any) {
    addLog(`❌ Initialization failed: ${error.message}`, 'error')
  }
}

async function askMediaPermission(): Promise<boolean> {
  // 1. Kiểm tra quyền bằng Permissions API (nếu có)
  if (navigator.permissions) {
    try {
      const cam = await navigator.permissions.query({ name: 'camera' as any })
      const mic = await navigator.permissions.query({ name: 'microphone' as any })

      // Nếu đã bị chặn (denied) trước đó → không hỏi được → return false
      if (cam.state === 'denied' || mic.state === 'denied') {
        return false
      }
    } catch (e) {
      // Safari không hỗ trợ permissions → bỏ qua
    }
  }

  // 2. Gọi getUserMedia để hỏi quyền thật sự
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    })
    // Nếu thành công → user đã đồng ý
    stream.getTracks().forEach(t => t.stop())
    return true
  } catch (err: any) {
    // Nếu user ấn Block → rơi vào đây
    return false
  }
}

// ========== LIFECYCLE ==========
onMounted(async () => {

  try {
    room.value = route.query.room as string || `room_${Math.random().toString(36).substr(2, 9)}`
    hasVideo.value = route.query['has_video'] === 'false' ? false : true;

    isPermissionGranted.value = await askMediaPermission()

    if (isPermissionGranted.value) {
      await initialize()
    }
    isLoading.value = false;
  }
  catch (error: any) {
    console.error('Error in onMounted:', error)
    addLog(`❌ Failed to initialize: ${error.message}`, 'error')
  }
})
const cleanupUserConnections = () => {

  // Cleanup local stream
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
  }
  // Cleanup all peer connections
  peerConnections.value.forEach((pc, userId) => {
    cleanupUserConnection(userId)
  })
}
onUnmounted(() => {
  try {
    // Leave room
    if (isConnectedSocket.value) {
      sendMessageSocket('call-leave-room', {
        room: room.value,
        userId: userId.value,
      })
      // socket.disconnect()
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
    if (newOnlineUsers.length > 0 && localStream && isConnectedSocket.value) {
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
watch(() => isConnectedSocket.value, (connected) => {
  if (connected && localStream) {
    addLog('Socket reconnected, re-establishing connections...', 'info')
    setTimeout(() => {
      connectToAllUsers()
    }, 1000)
  }
})

const endRoomCallAll = () => {
  // Gửi tín hiệu kết thúc cuộc gọi đến tất cả người dùng
  if (isConnectedSocket.value) {
    sendMessageSocket('call-end-call-room-all', {
      room: room.value,
      userId: userId.value,
    })
    addLog('You ended the call for all participants.', 'info')
  }

  cleanupUserConnections()
  window.close();
}
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

  0%,
  100% {
    opacity: 1;
  }

  50% {
    opacity: 0.5;
  }
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
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

.status-dot.connected {
  background-color: #10B981;
}

.status-dot.connecting {
  background-color: #F59E0B;
  animation: pulse 1s infinite;
}

.status-dot.disconnected {
  background-color: #EF4444;
}


@keyframes ping-slow {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.6;
  }

  50% {
    transform: scale(1.15);
    opacity: 0.3;
  }
}

@keyframes ping-slower {

  0%,
  100% {
    transform: scale(1);
    opacity: 0.4;
  }

  50% {
    transform: scale(1.3);
    opacity: 0.1;
  }
}

@keyframes pulse-rapid {

  0%,
  100% {
    opacity: 1;
    transform: scale(1);
  }

  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
}

.animate-ping-slow {
  animation: ping-slow 1.2s cubic-bezier(0, 0, 0.2, 1) infinite;
}

.animate-ping-slower {
  animation: ping-slower 1.8s cubic-bezier(0, 0, 0.2, 1) infinite;
}
</style>
