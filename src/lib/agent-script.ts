const DEFAULT_AGENT_INTERVAL_SEC = 60;

function py(value: string): string {
  return JSON.stringify(value);
}

export function buildInstallScript(params: {
  appUrl: string;
  token: string;
  serverId: string;
}) {
  const heartbeatUrl = `${params.appUrl.replace(/\/+$/, '')}/api/agent/heartbeat`;

  return `cat <<'PYEOF' > /usr/local/bin/server-monitor-agent.py
#!/usr/bin/env python3
import json
import os
import re
import subprocess
import time
import urllib.request

APP_URL = ${py(heartbeatUrl)}
TOKEN = ${py(params.token)}
SERVER_ID = ${py(params.serverId)}
INTERVAL_SEC = ${DEFAULT_AGENT_INTERVAL_SEC}


def run(cmd: str) -> str:
    try:
        return subprocess.check_output(cmd, shell=True, stderr=subprocess.DEVNULL, text=True).strip()
    except Exception:
        return ""


def read_float(path: str, default: float = 0.0) -> float:
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            return float(f.read().strip().split()[0])
    except Exception:
        return default


def parse_percent(text: str) -> float:
    if not text:
        return 0.0
    return float(text.replace('%', '').replace(',', '.').strip() or 0)


def get_cpu_percent() -> float:
    value = run("top -bn1 | grep 'Cpu(s)' | awk '{print $2 + $4}'")
    try:
        return round(float(value.replace(',', '.')), 2)
    except Exception:
        return 0.0


def get_memory_percent() -> float:
    value = run("free | awk '/Mem:/ {print ($3/$2)*100}'")
    try:
        return round(float(value.replace(',', '.')), 2)
    except Exception:
        return 0.0


def get_disk_percent() -> float:
    value = run("df / | tail -1 | awk '{print $5}'")
    try:
        return round(parse_percent(value), 2)
    except Exception:
        return 0.0


def get_load() -> list[float]:
    try:
        with open('/proc/loadavg', 'r', encoding='utf-8', errors='ignore') as f:
            parts = f.read().split()[:3]
            return [round(float(x), 2) for x in parts]
    except Exception:
        return [0.0, 0.0, 0.0]


def get_uptime_seconds() -> int:
    return int(read_float('/proc/uptime', 0.0))


def get_sites() -> list[str]:
    domains = set()

    try:
        for line in run("nginx -T 2>/dev/null | grep 'server_name'").splitlines():
            line = line.strip()
            if not line.startswith('server_name '):
                continue
            parts = line.replace(';', '').split()[1:]
            for part in parts:
                domains.add(part)
    except Exception:
        pass

    regex_nginx = re.compile(r'server_name\\s+([^;]+)')
    regex_apache = re.compile(r'(?:ServerName|ServerAlias)\\s+([^\\s]+)')
    config_dirs = [
        '/etc/nginx/sites-enabled',
        '/etc/nginx/conf.d',
        '/etc/apache2/sites-enabled',
        '/etc/httpd/conf.d',
        '/usr/local/lsws/conf/vhosts',
    ]

    for path in config_dirs:
        if not os.path.isdir(path):
            continue
        for name in os.listdir(path):
            file_path = os.path.join(path, name)
            if not os.path.isfile(file_path):
                continue
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as fh:
                    content = fh.read()
                for match in regex_nginx.findall(content):
                    for part in match.split():
                        domains.add(part)
                for match in regex_apache.findall(content):
                    domains.add(match)
            except Exception:
                pass

    cleaned = set()
    blacklist = {'_', '--', 'localhost', 'example.com', 'www.example.com', 'default'}
    for domain in domains:
        domain = domain.strip().strip(';').strip('"').strip("'")
        if domain.startswith('www.'):
            domain = domain[4:]
        if domain.startswith('$'):
            continue
        if domain in blacklist or '.' not in domain:
            continue
        cleaned.add(domain.lower())

    return sorted(cleaned)


def get_top_processes() -> list[dict]:
    rows = run("ps -eo comm,%cpu,%mem --sort=-%cpu | head -n 6").splitlines()[1:]
    result = []
    for row in rows:
        parts = row.split()
        if len(parts) >= 3:
            result.append({
                'name': parts[0],
                'cpu': parts[1],
                'ram': parts[2],
            })
    return result


def get_services() -> dict:
    services = {}
    for service in ['nginx', 'mysql', 'mysqld', 'mariadb', 'apache2', 'docker']:
        status = run(f"systemctl is-active {service} 2>/dev/null")
        if not status or status == 'unknown':
            continue
        name = 'mysql' if service in ['mariadb', 'mysqld'] else service
        if name == 'mysql' and status == 'active':
            services[name] = True
        elif name not in services:
            services[name] = status == 'active'
    return services


def get_network_totals() -> dict:
    raw = run("cat /proc/net/dev | grep -v 'lo:' | awk 'NR>2{rx+=$2;tx+=$10}END{print rx/1024/1024, tx/1024/1024}'")
    parts = raw.split()
    if len(parts) != 2:
        return {'rx_mb': 0, 'tx_mb': 0}
    try:
        return {
            'rx_mb': int(float(parts[0])),
            'tx_mb': int(float(parts[1])),
        }
    except Exception:
        return {'rx_mb': 0, 'tx_mb': 0}


def get_hardware() -> dict:
    ram_raw = run("free -m | awk '/Mem:/ {print $2, $3}'").split()
    disk_raw = run("df -h / | tail -1 | awk '{print $2, $3}'").split()
    cpu_cores = run("grep -c ^processor /proc/cpuinfo") or '0'
    return {
        'ram_total': ram_raw[0] if len(ram_raw) > 0 else '0',
        'ram_used': ram_raw[1] if len(ram_raw) > 1 else '0',
        'disk_total': disk_raw[0] if len(disk_raw) > 0 else '0',
        'disk_used': disk_raw[1] if len(disk_raw) > 1 else '0',
        'cpu_cores': cpu_cores,
    }


def get_sys_metrics() -> dict:
    return {
        'procs': get_top_processes(),
        'services': get_services(),
        'net': get_network_totals(),
        'hardware': get_hardware(),
    }


def post_metrics() -> None:
    load1, load5, load15 = get_load()
    payload = {
        'token': TOKEN,
        'serverId': SERVER_ID,
        'cpuPercent': get_cpu_percent(),
        'memoryPercent': get_memory_percent(),
        'diskPercent': get_disk_percent(),
        'load1': load1,
        'load5': load5,
        'load15': load15,
        'uptimeSeconds': get_uptime_seconds(),
        'discoveredDomains': get_sites(),
        'sysMetrics': get_sys_metrics(),
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(
        APP_URL,
        data=data,
        headers={'Content-Type': 'application/json'},
        method='POST',
    )
    with urllib.request.urlopen(req, timeout=15) as response:
        response.read()


def main() -> None:
    while True:
        try:
            post_metrics()
        except Exception:
            pass
        time.sleep(INTERVAL_SEC)


if __name__ == '__main__':
    main()
PYEOF
chmod +x /usr/local/bin/server-monitor-agent.py
cat <<'SVCEOF' > /etc/systemd/system/server-monitor-agent.service
[Unit]
Description=Server monitor heartbeat agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 /usr/local/bin/server-monitor-agent.py
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
SVCEOF
systemctl daemon-reload && systemctl enable --now server-monitor-agent.service && systemctl restart server-monitor-agent.service`;
}
