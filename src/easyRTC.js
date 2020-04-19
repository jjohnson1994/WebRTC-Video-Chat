const SDP_SEMANTICS = ["unified-plan", "plan-b"];
const ICE_SERVERS = [{
  urls: 'stun:stun.l.google.com:19302',
}];

function EasyRTC(socketInterface) {
  let localStream;
  let peerConnection;
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

    /**
     * Join a room and start video
     * @param {object} videoSessionOptions
     * @param {object} videoSessionOptions.socketInterface
     * @param {domnode} videoSessionOptions.remoteVideoContainer
     * @param {boolean} videoSessionOptions.audio
     * @param {boolean} videoSessionOptions.video
     */
    async initVideoSession({ remoteVideoContainer, audio = true, video = true  }) {
      socketInterface
        .listen({
          onIceCandidate: (clientId, candidate) => {
            console.log('recieved candidate', candidate);
            try {
              peerConnection.addIceCandidate(candidate);
            } catch (error) {
              console.error('on candidate error', error);
            }
          },
          onOffer: async (clientId, offer) => {
            console.log('recieved offer', offer);
            try {
              await peerConnection.setRemoteDescription(offer);

              const answer = await peerConnection.createAnswer();
              await peerConnection.setLocalDescription(answer);

              socketInterface.on('answer', peerConnection.localDescription);
            } catch (error) {
              console.error('on offer errror', error);
            }
          },
          onAnswer: (clientId, answer) => {
            console.log('recieve answer', answer);
            try {
              peerConnection.setRemoteDescription(answer);
            } catch(error) {
              console.error('on answer error', error);
            }
          },
        });

      peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));

      const description = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(description);

      socketInterface.on('offer', peerConnection.localDescription);

      peerConnection.addEventListener('track', event => {
        console.log('got tracks', event);
        console.log('src', remoteVideoContainer.srcObject);
        if (remoteVideoContainer.srcObject !== event.streams[0]) {
          remoteVideoContainer.srcObject = event.streams[0];
          console.log('pc2 received remote stream');
        }
      });
    },

    endCall() {
      peerConnection.close();

      peerConnection = null;
    }
  });
}
