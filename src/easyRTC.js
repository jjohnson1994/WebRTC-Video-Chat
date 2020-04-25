const SDP_SEMANTICS = ["unified-plan", "plan-b"];
const ICE_SERVERS = [{
  urls: 'stun:stun.l.google.com:19302',
}];

function EasyRTC(localVideoContainer, remotesContainer, socketInterface) {
  let localStream;
  let peerConnections = {};

  const initLocalMediaStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });

      localVideoContainer.srcObject = stream;
      localStream = stream;
    } catch (error) {
      console.error('Error getting user media devices', error);
    }
  };

  const switchPeerTracks = localStream => {
    const tracks = localStream.getTracks();

    console.log({ tracks });

    for (const [key, peer] of Object.entries(peerConnections)) {
      tracks.forEach(track => {
        const sender = peer.getSenders().find(function(s) {
          return s.track.kind == track.kind;
        });

        console.log({ sender });
        sender.replaceTrack(track);
      });
    }
  };

  const toggleScreenShare = async (enabled) => {
    console.log('startScreenShare', enabled);
    try {
      let stream;

      if (enabled === false) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
      } else if (navigator.mediaDevices.getDisplayMedia) {
        stream = await navigator.mediaDevices.getDisplayMedia({video: true});
      }

      localVideoContainer.srcObject = stream;
      localStream = stream;

      switchPeerTracks(localStream);
    } catch (error) {
      console.error('Error getting user media devices', error);
    }
  };

  const newClientPeerConnection = async clientId => {
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  
    peerConnection.addEventListener('track', event => {
      console.log(`recieved tracks from ${clientId}`);
      let videoContainer = document.querySelector(`video#remoteVideo${clientId}`);
      if (!videoContainer) {
        videoContainer = document.createElement('video');

        videoContainer.id = `remoteVideo${clientId}`;
        videoContainer.setAttribute('playinline', true);
        videoContainer.setAttribute('muted', true);
        videoContainer.setAttribute('autoplay', true);

        remotesContainer.appendChild(videoContainer);
      }

      if (videoContainer.srcObject !== event.streams[0]) {
        videoContainer.srcObject = event.streams[0];
      }
    });

    peerConnections[clientId] = peerConnection;
    return peerConnections[clientId];
  };

  const sendOfferToClient = async clientId => {
    console.log(`send offer to ${clientId}`);
    const peerConnection = await newClientPeerConnection(clientId);

    peerConnection.onnegotiationneeded = async event => {
      console.log('negotiatin needed', event);
      const description = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(description);

      // TODO Bug fix, offers are sent before clients 'offer listener' is initialized
      window.setTimeout(() => {
        socketInterface.emit('offer', {
          offerTo: clientId,
          offer: peerConnection.localDescription,
        });
      }, 1000);
    };
  };

  const closeClientConnection = async clientId => {
    const videoContainer = document.querySelector(`video#remoteVideo${clientId}`);
    if (videoContainer) {
      videoContainer.remove();
    }

    const peerConnection = peerConnections[clientId];
    if (peerConnection) {
      peerConnection.close();
      delete peerConnections.clientId;
    }
  };

  return ({
    sendOfferToClient,
    toggleScreenShare,
    closeClientConnection,
    async init() {
      await initLocalMediaStream();

      socketInterface.listen({
        onOffer: async (clientId, offer) => {
          console.log(`recieved offer from ${clientId}`)
          try {
            const peerConnection = await newClientPeerConnection(clientId);
            await peerConnection.setRemoteDescription(offer);

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            console.log(`send answer to ${clientId}`);

            socketInterface.emit('answer', {
              answerTo: clientId,
              answer: peerConnection.localDescription
            });
          } catch (error) {
            console.error('on offer errror', error);
          }
        },
        onAnswer: (clientId, answer) => {
          console.log(`recieved answer from ${clientId}`);
          try {
            const peerConnection = peerConnections[clientId];
            peerConnection.setRemoteDescription(answer);
          } catch(error) {
            console.error('on answer error', error);
          }
        },
        onIceCandidate: (clientId, candidate) => {
          console.log(`recieved ice candidate from ${clientId}`)
          try {
            const peerConnections = peerConnections[clientId];
            peerConnection.addIceCandidate(candidate);
          } catch (error) {
            console.error('on candidate error', error);
          }
        },
      });
    },
  });
}
