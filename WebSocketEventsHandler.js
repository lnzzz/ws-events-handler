class WebSocketEventsHandler {
  #handlers = [];
  #id = null;
  #ws;
  #connectionRetryCount = 0;
  #connectionMaxRetries = 5;
  #connectionRetryDelay = 1000;

  #useHeartbeat = true;
  #heartbeatInterval = 15000;
  #heartbeatTimeout = 10000;
  #heartbeatMessage = "ping";
  #heartbeatExpectedResponse = "pong";

  #useLocalEvents = false;
  #localEventsDelay = 1000;
  #localEvents = [];
  #localEventsDispatchInterval;

  #pingInterval;
  #heartbeatExpectedResponseTimeout;
  #wsUrl;
  #mountTime = null;
  #debugMode = false;

  onerror = false;

  constructor(wsUrl, config = {}) {  
      this.#wsUrl = wsUrl;
      if (!config.hasOwnProperty("heartbeat") || !config.heartbeat) this.#useHeartbeat = false;
      if (config.heartbeat?.timeout) this.#heartbeatTimeout = config.heartbeat.timeout;
      if (config.heartbeat?.expectedResponse) this.#heartbeatExpectedResponse = config.heartbeat.expectedResponse;
      if (config.heartbeat?.message) this.#heartbeatMessage = config.heartbeat.message;
      if (config.heartbeat?.interval) this.#heartbeatInterval = config.heartbeat.interval;
      if (config.connection?.retryCount) this.#connectionRetryCount = config.connection.retryCount;
      if (config.connection?.maxRetries) this.#connectionMaxRetries = config.connection.maxRetries;
      if (config.connection?.retryDelay) this.#connectionRetryDelay = config.connection.retryDelay;
      if (config.connection?.fallback?.localEvents) this.#useLocalEvents = true;
      if (config.connection?.fallback?.localEventsDelay) this.#localEventsDelay = config.connection.fallback.localEventsDelay;
      if (config.debug) this.#debugMode = true;
      this.#setupNetworkListeners();
      this.#connect();
  }

  #setupNetworkListeners() {
    if (window) {
      const _this = this;
      window.addEventListener('online', this.#handleOnline.bind(_this));
      window.addEventListener('offline', this.#handleOffline.bind(_this));
    }
  }

  #handleOnline() {
    this.#log('info', 'Network is online. Attempting to reconnect...');
    this.#connect();
  }

  #handleOffline() {
    this.#log('info', 'Network is offline. Closing WebSocket connection.');
    if (this.#localEventsDispatchInterval) clearInterval(this.#localEventsDispatchInterval);
    this.#ws.close();
  }

  #log(level, message, payload=null) {
    if (this.#debugMode) {
      (payload) ? console[level](message, payload) : console[level](message);
    }
  } 

  #connect() {
    if (navigator && !navigator.onLine) {
      this.#log('warn', 'Network is offline. Cannot connect to WebSocket server.');
      return;
    }
    this.#ws = new WebSocket(this.#wsUrl);
    this.#ws.addEventListener('open', this.#onOpen);
    this.#ws.addEventListener('message', this.#onMessage);
    this.#ws.addEventListener('close', this.#onClose);
    this.#ws.addEventListener('error', this.#onError);
    this.on('mounted', this.#handleMounted.bind(this));
  }

  #onOpen = (data) => {
    this.#log('info', 'Connected to server');
    if (this.#useHeartbeat) this.#startHeartbeat();
    if (this.#useLocalEvents && this.#localEvents.length > 0) {
      if (this.#localEventsDelay) {
        const originalLength = this.#localEvents.length;
        let j = 1;
        this.#localEventsDispatchInterval = setInterval(() => {
            if (this.#localEvents.length > 0) {
              this.#log('info', `Dispatching local events (${j} / ${originalLength})...`);
              const event = this.#localEvents[0];
              this.send(event[0], event[1]);
              this.#localEvents.splice(0, 1);
              j++;
            } else {
              this.#log('info', 'All local events dispatched. Clearing interval.')
              clearInterval(this.#localEventsDispatchInterval);
            }
        }, this.#localEventsDelay);

        return;
      }


      for (let i = this.#localEvents.length -1 ; i>=0; i--) {
        const event = this.#localEvents[i];
        this.send(event[0], event[1]);
        this.#localEvents.splice(this.#localEvents.indexOf(event), 1);
      };
    }
  }

  #onMessage = (event) => {
    const data = JSON.parse(event.data);
    if (data === this.#heartbeatExpectedResponse) {
      clearTimeout(this.#heartbeatExpectedResponseTimeout);
    } else {
      this.#onEvent(event);
    }
  }
  
  #onError = (error) => {
    if (this.onerror) return this.onerror(error);
    this.#log('error', 'WebSocket Error:', error)
  }
  
  #onClose = (event) => {
    this.#log('info', 'Connection closed', event);
    if (this.#connectionRetryCount < this.#connectionMaxRetries) {
      this.#retryConnection();
    } else {
      this.#log('error', `Max retry attempts reached. Connection closed permanently on ${Date.now()}.`);
      this.destroy('Max retry attempts reached.');
    }
    
  }

  #startHeartbeat() {
    this.#pingInterval = setInterval(() => {
      if (this.#ws.readyState === WebSocket.OPEN) {
        this.#ws.send(JSON.stringify(this.#heartbeatMessage));
        this.#heartbeatExpectedResponseTimeout = setTimeout(() => {
          this.#log('warn', 'No heartbeat expected response, reconnecting...');
          this.#ws.close();
        }, this.#heartbeatTimeout);
      }
    }, this.#heartbeatInterval);
  }

  #stopHeartbeat() {
    clearInterval(this.#pingInterval);
    clearTimeout(this.#heartbeatExpectedResponseTimeout);
  }


  #retryConnection() {
    this.#connectionRetryCount++;
    const retryIn = this.#connectionRetryDelay * 2 ** (this.#connectionRetryCount - 1);
    this.#log('info', `Retrying connection in ${retryIn / 1000} seconds (Attempt ${this.#connectionRetryCount} of ${this.#connectionMaxRetries})`);
    setTimeout(() => {
      this.#log('info', 'Attempting to reconnect...');
      this.#connect();
    }, retryIn);
  }

  #handleMounted(data) {
      this.#id = data.id || null;
      this.#mountTime = Date.now();
      this.#log('info', `Mounted with id: ${this.#id} on ${this.#mountTime}`);
  }

  #onEvent(event) {
      let eventData;
      try {
          eventData = JSON.parse(event.data);
      } catch (error) {
          this.#log('info', 'Failed to parse event data, using raw data instead.', error);
      }

      const [eventName, payload] = Array.isArray(eventData) ? eventData : [eventData];
      const handler = this.#handlers.find(h => h.eventName === eventName);

      if (!handler) {
          this.#log('warn', `Handler not found for event '${eventName}'`);
          return;
      }

      if (handler && handler.off) return;

      this.#processHandler(handler, payload);
  }

  #processHandler(handler, payload) {
      const { config } = handler;
      if (!config) throw new Error(`No config found for handler of event type: ${handler.eventName}`);

      if (config.ack) {
          this.#sendAck(handler.eventName, config.ack, payload);
      }

      handler.tracking = {
        lastTrigger: Date.now()
      }
      this.#updateHandler(handler, handler.config);

      if (config.cycle) {
        if (config.cycle.exclusive) return this.#processCycle(handler, payload);
        this.#processCycle(handler, payload);
      }

      if (typeof config === 'function') {
          config(payload);
      } else if (config.callback) {
          config.callback(payload);
      }
      
  }

  #processCycle(handler, payload) {
      const { cycle } = handler.config;

      if (!cycle.internalMessageCount) {
          cycle.internalMessageCount = 0;
          cycle.internalCyclePayloads = [];
      }

      cycle.internalMessageCount++;
      cycle.internalCyclePayloads.push(payload);

      if (cycle.internalMessageCount === cycle.every) {
          const callback = cycle.callback || handler.config.callback;
          callback(cycle.internalCyclePayloads);
          cycle.internalMessageCount = 0;
          cycle.internalCyclePayloads = [];
      }

      this.#updateHandler(handler, handler.config);
  }

  #updateHandler(handler, config) {
      const index = this.#handlers.findIndex(h => h.eventName === handler.eventName);
      if (index !== -1) {
          this.#handlers[index] = { ...handler, config };
      }
  }

  #sendAck(eventName, ackConfig, originalEventPayload=null) {
      const ackMessage = { 
        when: Date.now(), 
        ...(this.#id) ? { id: this.#id } : null,
        ...(ackConfig && ackConfig.originalEvent) ? originalEventPayload : null
      };
      this.#ws.send(JSON.stringify([(ackConfig.event) ? ackConfig.event : `${eventName}-ack`, ackMessage]));
  }

  send(eventName, payload) {
    const message = [eventName, {
      when: Date.now(),
      ...(this.#id) ? { id: this.#id } : null,
      payload
    }];

    if (navigator && !navigator.onLine && this.#useLocalEvents) {
      this.#log('info', 'Network is offline. Storing event locally.');
      this.#localEvents.push(message);
      return;
    }
    this.#ws.send(JSON.stringify(message));
  }

  on(eventName, config) {
    const handler = {
      eventName,
      config,
      registeredOn: Date.now(),
      off: false
    }
    const hIndex = this.#handlers.findIndex((h) => h.eventName === eventName);

    if (hIndex === -1) {
      this.#handlers.push(handler);
      return;
    }

    if (hIndex !== -1) {
      this.#handlers.splice(hIndex, 1, {
        ...this.#handlers[hIndex],
        ...handler
      });
    }
  }

  off(eventName) {
      this.#handlers.forEach((handler, index) => {
          if (handler.eventName === eventName) {
              this.#handlers[index].off = true;
          }
      });
  }

  destroy(reason) {
      if (window) {
        window.removeEventListener('online', this.#handleOnline);
        window.removeEventListener('offline', this.#handleOffline);
      }
      this.#ws.removeEventListener('message', this.#onMessage);
      this.#ws.removeEventListener('open', this.#onOpen);
      this.#ws.removeEventListener('close', this.#onClose);
      this.#ws.removeEventListener('error', this.#onError);
      this.#stopHeartbeat();
      this.#ws.close();
      if (this.#localEventsDispatchInterval) clearInterval(this.#localEventsDispatchInterval);
      this.#log('error', 'WebSocket destroyed.', reason)
  }
}
