type LogParams = {
  method: string;
  path: string;
  status: number;
  duration: number;
  ip: string;
};

function maskEmail(value: string) {
  return value.replace(
    /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g,
    "***@$2",
  );
}

function maskIp(ip: string) {
  if (!ip || ip === "unknown") return "unknown";
  const parts = ip.split(".");
  if (parts.length === 4) {
    parts[parts.length - 1] = "***";
    return parts.join(".");
  }
  return ip;
}

export function logRequest({ method, path, status, duration, ip }: LogParams) {
  const safePath = maskEmail(path);
  const safeIp = maskIp(ip);
  console.info(
    `[api] ${method} ${safePath} -> ${status} ${Math.round(duration)}ms ip=${safeIp}`,
  );
}
