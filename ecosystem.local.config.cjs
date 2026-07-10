module.exports = {
  apps: [
    {
      name: 'local-ingest',
      cwd: './localComponent',
      script: 'src/ingest.js',
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
    }
  ]
};
