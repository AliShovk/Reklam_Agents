import { serviceRegistry } from "./service-registry.js";

export interface ServiceCallResult {
  ok: boolean;
  service: string;
  action: string;
  status: number;
  summary: string;
  data: unknown;
}

function toQueryString(params: Record<string, string>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    search.set(key, value);
  }
  const rendered = search.toString();
  return rendered.length > 0 ? `?${rendered}` : "";
}

function pickPrefixed(params: Record<string, string>, prefix: string): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([key]) => key.startsWith(prefix))
      .map(([key, value]) => [key.slice(prefix.length), value]),
  );
}

async function doFetch(url: string, init: RequestInit): Promise<ServiceCallResult> {
  const response = await fetch(url, init);
  const raw = await response.text();
  let data: unknown = raw;
  try {
    data = raw.length > 0 ? JSON.parse(raw) : {};
  } catch {
  }
  return {
    ok: response.ok,
    service: "",
    action: "",
    status: response.status,
    summary: typeof data === "string" ? data.slice(0, 500) : JSON.stringify(data).slice(0, 500),
    data,
  };
}

async function executeRest(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  const baseUrl = config.base_url || config.url;
  if (!baseUrl) throw new Error(`Service ${service} requires base_url or url`);
  const method = (params.method || config.method || "GET").toUpperCase();
  const endpoint = params.endpoint || config.endpoint || action || "/";
  const query = pickPrefixed(params, "query.");
  const body = pickPrefixed(params, "body.");
  const headers = {
    ...pickPrefixed(config, "header_"),
    ...pickPrefixed(params, "header."),
  } as Record<string, string>;
  if (config.bearer_token) headers.Authorization = `Bearer ${config.bearer_token}`;
  if (config.api_key && !headers.Authorization && !query.api_key) query.api_key = config.api_key;
  if (config.auth_type === "basic" && config.username && config.password) {
    headers.Authorization = `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`;
  }
  const url = `${baseUrl.replace(/\/$/, "")}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}${toQueryString(query)}`;
  const init: RequestInit = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
    init.body = JSON.stringify(body);
  }
  const result = await doFetch(url, init);
  return { ...result, service, action: action || endpoint };
}

async function executeWordpress(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  const baseUrl = config.base_url;
  const username = config.username;
  const appPassword = config.app_password || config.password;
  if (!baseUrl || !username || !appPassword) throw new Error(`WordPress service ${service} requires base_url, username and app_password`);
  const auth = `Basic ${Buffer.from(`${username}:${appPassword}`).toString("base64")}`;
  if (action === "create_post") {
    const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts`;
    const result = await doFetch(url, {
      method: "POST",
      headers: { Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        title: params.title || "Untitled",
        content: params.content || "",
        status: params.status || "draft",
      }),
    });
    return { ...result, service, action };
  }
  const status = params.status || "draft,publish,pending";
  const url = `${baseUrl.replace(/\/$/, "")}/wp-json/wp/v2/posts${toQueryString({ per_page: params.per_page || "5", status })}`;
  const result = await doFetch(url, { method: "GET", headers: { Authorization: auth } });
  return { ...result, service, action: action || "list_posts" };
}

async function executeYoutube(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  const apiKey = config.api_key;
  if (!apiKey) throw new Error(`YouTube service ${service} requires api_key`);
  if (action === "channel_videos") {
    const query = {
      part: "snippet",
      channelId: params.channel_id || config.channel_id || "",
      maxResults: params.max_results || "5",
      order: "date",
      type: "video",
      key: apiKey,
    };
    const url = `https://www.googleapis.com/youtube/v3/search${toQueryString(query)}`;
    const result = await doFetch(url, { method: "GET" });
    return { ...result, service, action };
  }
  const url = `https://www.googleapis.com/youtube/v3/search${toQueryString({ part: "snippet", q: params.q || action, maxResults: params.max_results || "5", key: apiKey })}`;
  const result = await doFetch(url, { method: "GET" });
  return { ...result, service, action: action || "search" };
}

async function executeDiscord(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  if (config.webhook_url) {
    const result = await doFetch(config.webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: params.content || action || "" }),
    });
    return { ...result, service, action: action || "webhook_post" };
  }
  const botToken = config.bot_token;
  const channelId = params.channel_id || config.channel_id;
  if (!botToken || !channelId) throw new Error(`Discord service ${service} requires webhook_url or bot_token + channel_id`);
  const url = `https://discord.com/api/v10/channels/${channelId}/messages`;
  const result = await doFetch(url, {
    method: "POST",
    headers: { Authorization: `Bot ${botToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ content: params.content || action || "" }),
  });
  return { ...result, service, action: action || "send_message" };
}

async function executeReddit(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  const accessToken = config.access_token || config.bearer_token;
  if (!accessToken) throw new Error(`Reddit service ${service} requires access_token or bearer_token`);
  const headers = { Authorization: `Bearer ${accessToken}`, "User-Agent": config.user_agent || "reklam-agents/1.0" };
  if (action === "submit_post") {
    const url = "https://oauth.reddit.com/api/submit";
    const body = new URLSearchParams({
      sr: params.subreddit || config.subreddit || "",
      kind: params.kind || "self",
      title: params.title || "Untitled",
      text: params.text || "",
      url: params.url || "",
    });
    const result = await doFetch(url, { method: "POST", headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" }, body });
    return { ...result, service, action };
  }
  const subreddit = params.subreddit || config.subreddit || "popular";
  const limit = params.limit || "5";
  const url = `https://oauth.reddit.com/r/${subreddit}/new${toQueryString({ limit })}`;
  const result = await doFetch(url, { method: "GET", headers });
  return { ...result, service, action: action || "list_posts" };
}

export async function executeServiceCall(service: string, action: string, params: Record<string, string>): Promise<ServiceCallResult> {
  const config = await serviceRegistry.getServiceConfig(service);
  if (Object.keys(config).length === 0) throw new Error(`Service ${service} not found`);
  const serviceType = (config.type || config.provider || service).toLowerCase();
  if (serviceType.includes("wordpress")) return executeWordpress(service, action, params);
  if (serviceType.includes("youtube")) return executeYoutube(service, action, params);
  if (serviceType.includes("discord")) return executeDiscord(service, action, params);
  if (serviceType.includes("reddit")) return executeReddit(service, action, params);
  return executeRest(service, action, params);
}
