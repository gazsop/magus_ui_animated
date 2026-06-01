import { Application } from "@shared/contracts";
import { ServerApi } from "@shared/contracts/server_api";

export type TPushPermissionState = "granted" | "denied" | "default" | "unsupported";

type TPushRequest = <T, K extends object = {}>(args: {
  endPoint: string;
  method?: "GET" | "POST";
  body?: K;
  headers?: Record<string, string>;
  silentStatuses?: number[];
  errorMode?: "blocking" | "quiet";
}) => Promise<Application.IResponseDataSuccess<T>>;

export type TEnsurePushSubscriptionResult = {
  subscription: PushSubscription;
  configured: boolean;
};

export const getPushPermissionState = (): TPushPermissionState => {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  ) {
    return "unsupported";
  }
  return Notification.permission;
};

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
};

const serializeSubscription = (
  subscription: PushSubscription
): ServerApi.PushRoutes.BrowserSubscription => {
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
    throw new Error("Browser returned an incomplete push subscription.");
  }
  return {
    endpoint: json.endpoint,
    expirationTime: json.expirationTime,
    keys: {
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    },
  };
};

export const ensurePushSubscription = async (
  pushRequest: TPushRequest
): Promise<TEnsurePushSubscriptionResult> => {
  const permissionState = getPushPermissionState();
  if (permissionState === "unsupported") {
    throw new Error("Push is not supported in this browser.");
  }
  if (permissionState === "denied") {
    throw new Error("Notifications are blocked by the browser.");
  }

  const permission =
    permissionState === "granted" ? "granted" : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const keyResponse = await pushRequest<ServerApi.PushRoutes.PublicKeyResponse>({
    endPoint: "/publicKey",
    body: {},
  });
  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(keyResponse.data.publicKey),
    }));

  await pushRequest<unknown, ServerApi.PushRoutes.SubscribeBody>({
    endPoint: "/subscribe",
    body: {
      subscription: serializeSubscription(subscription),
      userAgent: navigator.userAgent,
    },
  });

  return {
    subscription,
    configured: keyResponse.data.configured,
  };
};
