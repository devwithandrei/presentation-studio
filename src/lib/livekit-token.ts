import { AccessToken } from "livekit-server-sdk";

export async function createLiveRoomToken(roomName: string, identity: string, name: string) {
  const apiKey = process.env.LIVEKIT_API_KEY;
  const apiSecret = process.env.LIVEKIT_API_SECRET;
  const url = process.env.LIVEKIT_URL;
  if (!apiKey || !apiSecret || !url) return null;
  if (!url.startsWith("wss://")) throw new Error("LIVEKIT_URL must be a secure wss:// URL.");

  const accessToken = new AccessToken(apiKey, apiSecret, { identity, name, ttl: "1h" });
  accessToken.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  return { token: await accessToken.toJwt(), url };
}
