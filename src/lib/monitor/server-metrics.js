async function getServerMetrics(host, username) {
  const PORT = 19999;
  const TOKEN = process.env.MONITOR_AGENT_TOKEN || 'my_secret_token';

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(new Error('Server metrics timeout')), 3000);

    const fetchPromise = fetch(`http://${host}:${PORT}`, {
      headers: { 'X-Auth-Token': TOKEN },
      signal: controller.signal,
      cache: 'no-store',
    });

    const hardTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Hard Timeout')), 3500)
    );

    const res = await Promise.race([fetchPromise, hardTimeoutPromise]);
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error(`Agent unreachable for ${host} (${username})`);

    const data = await res.json();

    return {
      cpu: data.cpu,
      ram: data.ram,
      disk: data.disk,
      uptime: data.uptime,
      load: data.load,
      sites: data.sites,
      sysMetrics: data.sysMetrics || {},
      status: 'online',
    };
  } catch (_error) {
    return {
      cpu: 0,
      ram: 0,
      disk: 0,
      uptime: '0m',
      load: '0.00',
      sites: [],
      sysMetrics: {},
      status: 'offline',
    };
  }
}

module.exports = { getServerMetrics };
