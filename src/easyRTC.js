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

  const newClientPeerConnection = async clientId => {
    const peerConnection = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
    });

    localStream.getTracks().forEach(track => peerConnection.addTrack(track, localStream));
  
    peerConnection.addEventListener('track', event => {
      console.log('got tracks');
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
    const peerConnection = await newClientPeerConnection(clientId);
    const description = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(description);

    console.log(`send offer to ${clientId}`)

    // TODO Bug fix, offers are sent before clients 'offer listener' is initialized
    window.setTimeout(() => {
      socketInterface.emit('offer', peerConnection.localDescription);
    }, 1000);
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

            socketInterface.emit('answer', peerConnection.localDescription);
          } catch (error) {
            console.error('on offer errror', error);
          }
        },
        onAnswer: (clientId, answer) => {
          console.log(`recieved answer from ${clientId}`)
          try {
            console.log(peerConnections);
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
