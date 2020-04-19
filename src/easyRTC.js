const SDP_SEMANTICS = ["unified-plan", "plan-b"];
const ICE_SERVERS = [{
  urls: 'stun:stun.l.google.com:19302',
}];

function EasyRTC(socketInterface) {
  let localStream;
  let localPeerConnection;
  let removePeerConnection;

  let _localVideoContainer, _remoteVideoContainer;

  return ({
    initLocalMediaStream(localVideoContainer) {
      return new Promise(async (resolve, reject) => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });

          localVideoContainer.srcObject = stream;
          localStream = stream;

          resolve(stream);
        } catch (e) {
          reject(error);
        } 
      });
    },

    createOffer() {
      return new Promise(async (resolve, reject) => {
        const configuration = {
          // sdpSemantics: SDP_SEMANTICS[0],
          iceServers: ICE_SERVERS,
        };
        const videoTracks = localStream.getVideoTracks();
        const audioTracks = localStream.getAudioTracks();

        if (videoTracks.length > 0) {
          console.log(`Using video device: ${videoTracks[0].label}`);
        }

        if (audioTracks.length > 0) {
          console.log(`Using audio device: ${audioTracks[0].label}`);
        }

        console.log('RTCPeerConnection configuration:', configuration);
        localPeerConnection = new RTCPeerConnection(configuration);
        localPeerConnection.addEventListener('icecandidate', event => {
          removePeerConnection.addIceCandidate(event.candidate);
        });

        removePeerConnection = new RTCPeerConnection(configuration);
        removePeerConnection.addEventListener('icecandidate', event => {
          localPeerConnection.addIceCandidate(event.candidate);
        });

        removePeerConnection.addEventListener('track', event => {
          if (_remoteVideoContainer.srcObject !== event.streams[0]) {
            _remoteVideoContainer.srcObject = event.streams[0];
            console.log('pc2 received remote stream');
          }
        });

        localPeerConnection.addEventListener('iceconnectionstatechange', event => {
          console.log('Local Peer Connection Ice Candidate Change', event);
        });

        removePeerConnection.addEventListener('iceconnectionstatechange', event => {
          console.log('Local Peer Connection Ice Candidate Change', event);
        });

        localStream.getTracks().forEach(track => localPeerConnection.addTrack(track, localStream));
        console.log('Added local stream to pc1');

        try {
          console.log('Creating Local Offer');
          const offer = await localPeerConnection.createOffer({
            offerToReceiveAudio: 1,
            offerToReceiveVideo: 1
          });

          resolve(offer);
        } catch (error) {
          console.error('Error Creating Offer', error);
          reject(error);
        }
      });
    },

    setPeerDescription(desc) {
      return new Promise(async (resolve, reject) => {
        console.log(`Offer from pc1\n${desc.sdp}`);
        console.log('pc1 setLocalDescription start');
        try {
          await localPeerConnection.setLocalDescription(desc);
        } catch (error) {
          console.error('Error setting local description', error);
          reject(error);
        }

        console.log('pc2 setRemoteDescription start');
        try {
          await removePeerConnection.setRemoteDescription(desc);
        } catch (error) {
          console.error('Error setting local description', error);
          reject(error);
        }

        console.log('pc2 createAnswer start');
        // Since the 'remote' side has no media stream we need
        // to pass in the right constraints in order for it to
        // accept the incoming offer of audio and video.
        try {
          const answer = await removePeerConnection.createAnswer();
          resolve(answer);
        } catch (error) {
          console.error('Error creating remove answer', error);
          rejecte(error);
        }
      });
    },

    async onCreateAnswerSuccess(desc) {
      console.log(`Answer from remote peer connection:\n${desc.sdp}`);
      console.log('Setting remote local description');
      try {
        await removePeerConnection.setLocalDescription(desc);
      } catch (error) {
        console.error('Error setting remote local description', error);
        reject(error);
      }

      console.log('Setting local remote description');
      try {
        await localPeerConnection.setRemoteDescription(desc);
      } catch (e) {
        console.error('Error setting local remote description', error);
        reject(error);
      }

    },

    /**
     * Join a room and start video
     * @param {object} videoSessionOptions
     * @param {object} videoSessionOptions.socketInterface
     * @param {domnode} videoSessionOptions.localVideoContainer
     * @param {domnode} videoSessionOptions.remoteVideoContainer
     * @param {boolean} videoSessionOptions.audio
     * @param {boolean} videoSessionOptions.video
     */
    async initVideoSession({ localVideoContainer, remoteVideoContainer, audio = true, video = true  }) {
      _localVideoContainer = localVideoContainer;
      _remoteVideoContainer = remoteVideoContainer;

      socketInterface
        .listen({
          callback: data => {

          },
          callback1: data => {

          },
        });
      const localOffer = await this.createOffer();
      const answer = await this.setPeerDescription(localOffer);
      this.onCreateAnswerSuccess(answer);
    },

    endCall() {
      localPeerConnection.close();
      removePeerConnection.close();

      localPeerConnection = null;
      removePeerConnection = null;
    }
  });
}
