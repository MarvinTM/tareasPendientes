module.exports = {
  apps: [
    {
      name: 'local-poller',
      cwd: './localComponent',
      script: './poller/bin/huawei-poller',
      interpreter: 'none',
      env: {
        POLLER_HOST: '192.168.1.230',
        POLLER_PORT: '502',
        POLLER_LISTEN: '127.0.0.1:8765',
        LINK_MAX_TIMEOUTS: '6',
        LINK_READ_TIMEOUT_MS: '10000',
        LINK_FRESHNESS_MS: '120000',
        LINK_COOLOFF_MS: '5000',
        CADENCE_INVERTER_MS: '30000',
        CADENCE_METER_MS: '10000',
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '100M',
      error_file: './logs/poller-error.log',
      out_file: './logs/poller-out.log',
      time: true
    },
    {
      name: 'local-forwarder',
      cwd: './localComponent',
      script: 'src/forwarder.js',
      node_args: '--dns-result-order=ipv4first',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '200M',
      error_file: './logs/error.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      time: true
    },
    {
      name: 'local-shelly-forwarder',
      cwd: './localComponent',
      script: 'src/shellyForwarder.js',
      node_args: '--dns-result-order=ipv4first',
      env: {
        NODE_ENV: 'production'
      },
      instances: 1,
      autorestart: true,
      watch: false,
      max_restarts: 50,
      min_uptime: '10s',
      restart_delay: 5000,
      max_memory_restart: '200M',
      error_file: './logs/shelly-error.log',
      out_file: './logs/shelly-out.log',
      time: true
    }
  ]
};