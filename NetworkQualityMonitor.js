const https = require('https');
const EventEmitter = require('events');

class NetworkQualityMonitor extends EventEmitter {
    url = null;
    interval = null;
    isOnline = true;
    latency = null;
    #checkInterval = null;

    constructor(url = 'https://www.google.com', interval = 5000) {
      super();
      this.url = url;
      this.interval = interval;
      this.startMonitoring();
    }
  
    startMonitoring() {
      this.#checkInterval = setInterval(() => this.checkNetworkQuality(), this.interval);
    }

    stopMonitoring() {
      clearInterval(this.#checkInterval);
    }
  
    checkNetworkQuality() {
      const startTime = Date.now();
  
      https.get(this.url, (res) => {
        const responseTime = Date.now() - startTime;
        const currentlyOnline = res.statusCode === 200;
  
        if (currentlyOnline !== this.isOnline) {
          this.isOnline = currentlyOnline;
          this.emit(currentlyOnline ? 'online' : 'offline');
        }
        if (this.isOnline) {
          this.latency = responseTime;
          this.emit('quality', { latency: responseTime });
        }
      }).on('error', () => {
        if (this.isOnline !== false) {
          this.isOnline = false;
          this.emit('offline');
        }
      });
    }
  }
  
  module.exports = NetworkQualityMonitor;