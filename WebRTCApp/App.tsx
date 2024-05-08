import React, { useEffect, useRef, useState } from 'react';
import { View, Button, Text, StyleSheet, TouchableOpacity } from 'react-native';
import io from 'socket.io-client';
import {
  mediaDevices,
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView
} from 'react-native-webrtc';

const configuration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};
const socket = io('http://172.20.10.5:3009', {
  transports: ['websocket'],
});

const App = () => {
  const [role, setRole] = useState(null); // null, 'broadcaster', or 'viewer'
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const peerConnections = useRef({});

  useEffect(() => {
    socket.on('broadcaster', () => {
      if (role === 'viewer') {
        socket.emit('watcher');
      }
    });

    socket.on('watcher', (id) => {
      const peerConnection = createPeerConnection(id);
      peerConnections.current[id] = peerConnection;

      peerConnection.addStream(localStream);

      peerConnection.createOffer()
        .then((offer) => peerConnection.setLocalDescription(offer))
        .then(() => socket.emit('offer', id, peerConnection.localDescription));
    });

    socket.on('offer', (id, description) => {
      const peerConnection = createPeerConnection(id);
      peerConnections.current[id] = peerConnection;

      peerConnection.setRemoteDescription(new RTCSessionDescription(description))
        .then(() => peerConnection.createAnswer())
        .then((answer) => peerConnection.setLocalDescription(answer))
        .then(() => socket.emit('answer', id, peerConnection.localDescription));
    });

    socket.on('answer', (id, description) => {
      const peerConnection = peerConnections.current[id];
      peerConnection.setRemoteDescription(new RTCSessionDescription(description));
    });

    socket.on('candidate', (id, candidate) => {
      const peerConnection = peerConnections.current[id];
      peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on('disconnectPeer', (id) => {
      const peerConnection = peerConnections.current[id];
      if (peerConnection) peerConnection.close();
      delete peerConnections.current[id];
      setRemoteStreams((prevStreams) => prevStreams.filter((stream) => stream.id !== id));
    });

    return () => {
      socket.disconnect();
    };
  }, [localStream, role]);

  const createPeerConnection = (id) => {
    const peerConnection = new RTCPeerConnection(configuration);

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('candidate', id, event.candidate);
      }
    };

    peerConnection.onaddstream = (event) => {
      setRemoteStreams((prevStreams) => [...prevStreams, { id, stream: event.stream }]);
    };

    return peerConnection;
  };

  const startBroadcasting = async () => {
    const stream = await mediaDevices.getUserMedia({ video: true, audio: true });
    setLocalStream(stream);
    setRole('broadcaster');
    socket.emit('broadcaster');
  };

  const startWatching = () => {
    setRole('viewer');
    socket.emit('watcher');
  };

  return (
    <View style={styles.container}>
      {!role && (
        <>
          <TouchableOpacity style={styles.button} onPress={startBroadcasting}>
            <Text style={styles.buttonText}>Start Broadcasting</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={startWatching}>
            <Text style={styles.buttonText}>Start Watching</Text>
          </TouchableOpacity>
        </>
      )}
      {role === 'broadcaster' && localStream && (
        <RTCView streamURL={localStream.toURL()} style={styles.video} />
      )}
      {role === 'viewer' &&
        remoteStreams.map((remote) => (
          <RTCView
            key={remote.id}
            streamURL={remote.stream.toURL()}
            style={styles.video}
          />
        ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  video: {
    width: '100%',
    height: 300,
    backgroundColor: 'black',
  },
  button: {
    marginVertical: 10,
    padding: 15,
    backgroundColor: '#007AFF',
    borderRadius: 10,
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
  },
});

export default App;
