const SDP_SEMANTICS = ["unified-plan", "plan-b"];
const ICE_SERVERS = [
  {
    urls: "stun:stun.l.google.com:19302",
  },
];

function cameraSource() {
  return navigator.mediaDevices.getUserMedia({
    audio: true,
    video: true,
  });
}

function screenShareSource() {
  return navigator.mediaDevices.getDisplayMedia({ video: true });
}

function replacePeerTracks(peerConnections, localStream) {
  const tracks = localStream.getTracks();

  for (const [key, peer] of Object.entries(peerConnections)) {
    for (const track of tracks) {
      const sender = peer.getSenders().find(function (s) {
        return s.track.kind === track.kind;
      });

      sender.replaceTrack(track);
    }
  }
}

function createVideoNode(id, parent) {
  const videoNode = document.createElement("video");

  videoNode.id = `remoteVideo${id}`;
  videoNode.setAttribute("playinline", true);
  videoNode.setAttribute("muted", true);
  videoNode.setAttribute("autoplay", true);

  parent.appendChild(videoNode);

  return videoNode;
}

const EasyRTC = {
  VideoChatRoom({
    localVideoContainer,
    remotesContainer,
    eventEmitter,
    onError: reportError = () => {},
    onLog: reportLog = () => {},
  }) {
    let localStream;
    const peerConnections = {};

    const toggleScreenShare = async (enabled) => {
      try {
        localStream = enabled
          ? await screenShareSource()
          : await cameraSource();
        localVideoContainer.srcObject = localStream;

        replacePeerTracks(peerConnections, localStream);
      } catch (error) {
        console.error("Error getting user media devices", error);
      }
    };

    const newClientPeerConnection = async (clientId) => {
      const peerConnection = new RTCPeerConnection({
        iceServers: ICE_SERVERS,
      });

      localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
      });

      peerConnection.ontrack = (event) => {
        reportLog(`recieved tracks from ${clientId}`);

        const videoContainer =
          document.querySelector(`video#remoteVideo${clientId}`) ||
          createVideoNode(clientId, remotesContainer);

        if (videoContainer.srcObject !== event.streams[0]) {
          const [stream] = event.streams;
          videoContainer.srcObject = stream;
        }
      };

      peerConnections[clientId] = peerConnection;
      return peerConnections[clientId];
    };

    const sendOfferToClient = async (clientId) => {
      const peerConnection = await newClientPeerConnection(clientId);

      peerConnection.onnegotiationneeded = async (event) => {
        reportLog("negotiatin needed", event);

        const description = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(description);

        // TODO Bug fix, offers are sent before clients 'offer listener' is initialized
        window.setTimeout(() => {
          eventEmitter("offer", {
            offerTo: clientId,
            offer: peerConnection.localDescription,
          });
        }, 1000);
      };
    };

    const closeClientConnection = async (clientId) => {
      const videoContainer = document.querySelector(
        `video#remoteVideo${clientId}`
      );

      if (videoContainer) {
        videoContainer.remove();
      }

      const peerConnection = peerConnections[clientId];
      if (peerConnection) {
        peerConnection.close();
        delete peerConnections.clientId;
      }
    };

    return {
      toggleScreenShare,
      async init() {
        localStream = await cameraSource();
        localVideoContainer.srcObject = localStream;
      },
      onUserJoinedRoom: (clientId) => {
        sendOfferToClient(clientId);
      },
      onOffer: async (clientId, offer) => {
        reportLog(`recieved offer from ${clientId}`);

        try {
          const peerConnection = await newClientPeerConnection(clientId);
          await peerConnection.setRemoteDescription(offer);

          const answer = await peerConnection.createAnswer();
          await peerConnection.setLocalDescription(answer);

          reportLog(`send answer to ${clientId}`);

          eventEmitter("answer", {
            answerTo: clientId,
            answer: peerConnection.localDescription,
          });
        } catch (error) {
          reportError("on offer errror", error);
        }
      },
      onAnswer: (clientId, answer) => {
        reportLog(`recieved answer from ${clientId}`);

        try {
          const peerConnection = peerConnections[clientId];
          peerConnection.setRemoteDescription(answer);
        } catch (error) {
          reportError("on answer error", error);
        }
      },
      onIceCandidate: (clientId, candidate) => {
        reportLog(`recieved ice candidate from ${clientId}`);

        try {
          const peerConnection = peerConnections[clientId];
          peerConnection.addIceCandidate(candidate);
        } catch (error) {
          reportError("on candidate error", error);
        }
      },
      onUserLeftRoom: (clientId) => {
        closeClientConnection(clientId);
      },
    };
  },
};
