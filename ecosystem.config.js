module.exports = {
  apps: [{
    name: 'bypass-app',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/bypass/bypassv2Web',
    env: {
      PORT: 3003,
      NODE_ENV: 'production'
    },
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
};