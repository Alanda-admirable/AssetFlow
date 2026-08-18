import PocketBase from "pocketbase";

export function getPocketBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_POCKETBASE_URL) {
    return process.env.NEXT_PUBLIC_POCKETBASE_URL;
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname || "127.0.0.1";
    return `http://${host}:8090`;
  }
  return "http://127.0.0.1:8090";
}

let pbInstance: PocketBase | null = null;

export function getPocketBase(): PocketBase {
  const url = getPocketBaseUrl();
  if (!pbInstance || pbInstance.baseUrl !== url) {
    pbInstance = new PocketBase(url);
    pbInstance.autoCancellation(false);
  }
  return pbInstance;
}

export interface PocketBaseAsset {
  id: string;
  assetCode: string;
  serialNumber?: string;
  name: string;
  description?: string;
  category: string;
  location: string;
  room?: string;
  building?: string;
  purchasePrice?: number;
  purchaseDate?: string;
  condition?: string;
  imageUrl?: string;
  qrToken?: string;
  status?: string;
  created?: string;
  updated?: string;
}
