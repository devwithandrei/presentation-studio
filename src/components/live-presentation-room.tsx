"use client";

import { Camera, CameraOff, LoaderCircle, Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { Room, RoomEvent, Track, type RemoteTrack, type RemoteTrackPublication, type RemoteParticipant } from "livekit-client";
import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";

type ParticipantVideo = { identity: string; name: string; track: RemoteTrack };

export function LivePresentationRoom({ tokenEndpoint, enabled, password, isPresenter, controlsHost, onMicrophoneTrack }: {
  tokenEndpoint: string;
  enabled: boolean;
  password?: string;
  isPresenter: boolean;
  controlsHost?: HTMLElement | null;
  onMicrophoneTrack?: (track: MediaStreamTrack | null) => void;
}) {
  const [room, setRoom] = useState<Room | null>(null);
  const [participantVideos, setParticipantVideos] = useState<ParticipantVideo[]>([]);
  const [participantAudioTracks, setParticipantAudioTracks] = useState<RemoteTrack[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(false);
  const [error, setError] = useState("");
  const [displayName, setDisplayName] = useState(isPresenter ? "Presenter" : "");
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = localVideoRef.current;
    const track = room?.localParticipant.getTrackPublication(Track.Source.Camera)?.track;
    if (!video || !track) return;
    track.attach(video);
    return () => { track.detach(video); };
  }, [room, cameraEnabled]);

  useEffect(() => {
    const track = room?.localParticipant.getTrackPublication(Track.Source.Microphone)?.track?.mediaStreamTrack ?? null;
    onMicrophoneTrack?.(track);
    return () => onMicrophoneTrack?.(null);
  }, [room, microphoneEnabled, onMicrophoneTrack]);

  useEffect(() => () => {
    room?.disconnect();
  }, [room]);

  async function joinRoom() {
    if (!enabled || connecting || room) return;
    setConnecting(true);
    setError("");
    let connectedRoom: Room | null = null;
    try {
      const response = await fetch(tokenEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: displayName.trim() || (isPresenter ? "Presenter" : "Guest"), ...(password ? { password } : {}) }),
      });
      const payload = await response.json() as { token?: string; url?: string; error?: string };
      if (!response.ok || !payload.token || !payload.url) throw new Error(payload.error ?? "Could not join the live room.");
      connectedRoom = new Room({ adaptiveStream: true, dynacast: true });
      connectedRoom.on(RoomEvent.TrackSubscribed, (track: RemoteTrack, _publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        if (track.kind === Track.Kind.Audio) {
          setParticipantAudioTracks((current) => [...current, track]);
          return;
        }
        if (track.kind !== Track.Kind.Video) return;
        setParticipantVideos((current) => [...current.filter((item) => item.identity !== participant.identity), {
          identity: participant.identity,
          name: participant.name || participant.identity,
          track,
        }]);
      });
      connectedRoom.on(RoomEvent.TrackUnsubscribed, (track: RemoteTrack) => {
        setParticipantVideos((current) => current.filter((item) => item.track !== track));
        setParticipantAudioTracks((current) => current.filter((item) => item !== track));
      });
      connectedRoom.on(RoomEvent.Disconnected, () => {
        setRoom(null);
        setParticipantVideos([]);
        setParticipantAudioTracks([]);
        setCameraEnabled(false);
        setMicrophoneEnabled(false);
      });
      await connectedRoom.connect(payload.url, payload.token);
      await connectedRoom.localParticipant.setCameraEnabled(true);
      setCameraEnabled(true);
      try {
        await connectedRoom.localParticipant.setMicrophoneEnabled(true);
        setMicrophoneEnabled(true);
      } catch {
        setMicrophoneEnabled(false);
        setError("Camera connected, but microphone access was denied. Check browser permissions.");
      }
      setRoom(connectedRoom);
    } catch (cause) {
      connectedRoom?.disconnect();
      setError(cause instanceof Error ? cause.message : "Could not join the live room.");
    } finally {
      setConnecting(false);
    }
  }

  async function toggleCamera() {
    if (!room) return;
    try {
      const next = !cameraEnabled;
      await room.localParticipant.setCameraEnabled(next);
      setCameraEnabled(next);
    } catch {
      setError("Camera access was denied or the device is unavailable.");
    }
  }

  async function toggleMicrophone() {
    if (!room) return;
    try {
      const next = !microphoneEnabled;
      await room.localParticipant.setMicrophoneEnabled(next);
      setMicrophoneEnabled(next);
    } catch {
      setError("Microphone access was denied or the device is unavailable.");
    }
  }

  function leaveRoom() {
    room?.disconnect();
    setRoom(null);
    setParticipantVideos([]);
    setParticipantAudioTracks([]);
    setCameraEnabled(false);
    setMicrophoneEnabled(false);
    onMicrophoneTrack?.(null);
  }

  return (
    <div className={`live-room ${room ? "is-connected" : ""}`}>
      {room && <div className={`live-room-videos ${participantVideos.length > 0 ? "has-guest" : ""}`}>
        <div className="live-room-person">
          <video ref={localVideoRef} autoPlay muted playsInline aria-label="Your camera" />
          {!cameraEnabled && <div className="live-room-camera-off"><CameraOff size={17} /><span>Camera off</span></div>}
          <span className="live-room-name">{displayName || "You"}{isPresenter ? " · host" : ""}</span>
        </div>
        {participantVideos.map((participant) => <RemoteVideo key={participant.identity} participant={participant} />)}
        {!participantVideos.length && room && <div className="live-room-waiting"><span>Live room</span><small>Share the link to invite someone</small></div>}
      </div>}
      {participantAudioTracks.map((track, index) => <RemoteAudio key={`${track.sid}-${index}`} track={track} />)}
      {(!isPresenter || !controlsHost) && <div className="live-room-controls">
        {!room
          ? <>
            <label className="live-room-name-input"><span>{isPresenter ? "Your camera & mic" : "Join the live conversation"}</span><input value={displayName} maxLength={48} placeholder="Your name" onChange={(event) => setDisplayName(event.target.value)} aria-label="Your name for the live conversation" /></label>
            <button type="button" disabled={!enabled || connecting || (!isPresenter && !displayName.trim())} onClick={() => void joinRoom()} aria-label={enabled ? "Join camera and microphone" : "Live video is unavailable"} title={enabled ? "Join camera and microphone" : "Configure LiveKit to enable live video"}>
            {connecting ? <LoaderCircle size={14} className="live-room-spinner" /> : <Phone size={14} />}
            {connecting ? "Joining…" : isPresenter ? "Start camera" : "Join live"}
            </button>
          </>
          : <>
            <button type="button" onClick={() => void toggleCamera()} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"} title={cameraEnabled ? "Turn camera off" : "Turn camera on"}>{cameraEnabled ? <Camera size={14} /> : <CameraOff size={14} />}</button>
            <button type="button" onClick={() => void toggleMicrophone()} aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"} title={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}>{microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}</button>
            <button type="button" onClick={leaveRoom} aria-label="Leave live room" title="Leave live room"><PhoneOff size={14} /></button>
          </>}
      </div>}
      {(!isPresenter || !controlsHost) && error && <span className="live-room-error" role="alert">{error}</span>}
      {(!isPresenter || !controlsHost) && room && <span className="live-room-status" role="status">Live · camera stays in place as slides change</span>}
      {isPresenter && controlsHost && createPortal(<>
        <span className="presentation-camera-label">Camera &amp; microphone</span>
        <div className="live-room-controls live-room-controls-menu">
          {!room
            ? <>
              <label className="live-room-name-input"><span>Your name</span><input value={displayName} maxLength={48} placeholder="Your name" onChange={(event) => setDisplayName(event.target.value)} aria-label="Your name for the live conversation" /></label>
              <button type="button" disabled={!enabled || connecting} onClick={() => void joinRoom()} aria-label={enabled ? "Start camera and microphone" : "Live video is unavailable"} title={enabled ? "Start camera and microphone" : "Configure LiveKit to enable live video"}>
                {connecting ? <LoaderCircle size={14} className="live-room-spinner" /> : <Phone size={14} />}
                {connecting ? "Joining…" : "Start camera"}
              </button>
            </>
            : <>
              <button type="button" onClick={() => void toggleCamera()} aria-label={cameraEnabled ? "Turn camera off" : "Turn camera on"} title={cameraEnabled ? "Turn camera off" : "Turn camera on"}>{cameraEnabled ? <Camera size={14} /> : <CameraOff size={14} />}{cameraEnabled ? "Camera on" : "Camera off"}</button>
              <button type="button" onClick={() => void toggleMicrophone()} aria-label={microphoneEnabled ? "Mute microphone" : "Unmute microphone"} title={microphoneEnabled ? "Mute microphone" : "Unmute microphone"}>{microphoneEnabled ? <Mic size={14} /> : <MicOff size={14} />}{microphoneEnabled ? "Mic on" : "Mic muted"}</button>
              <button type="button" onClick={leaveRoom} aria-label="Leave live room" title="Leave live room"><PhoneOff size={14} /> Leave</button>
            </>}
        </div>
        {error && <span className="live-room-error" role="alert">{error}</span>}
        {room && <span className="live-room-status" role="status">Live · camera stays in place as slides change</span>}
      </>, controlsHost)}
    </div>
  );
}

function RemoteAudio({ track }: { track: RemoteTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    track.attach(audio);
    return () => { track.detach(audio); };
  }, [track]);

  return <audio ref={audioRef} autoPlay />;
}

function RemoteVideo({ participant }: { participant: ParticipantVideo }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    participant.track.attach(video);
    return () => { participant.track.detach(video); };
  }, [participant.track]);

  return (
    <div className="live-room-person">
      <video ref={videoRef} autoPlay playsInline aria-label={`${participant.name}'s camera`} />
      <span className="live-room-name">{participant.name}</span>
    </div>
  );
}
