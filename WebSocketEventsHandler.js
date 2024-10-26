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
    console.log('Network is online. Attempting to reconnect...');
    this.#connect();
  }

  #handleOffline() {
    console.log('Network is offline. Closing WebSocket connection.');
    this.#ws.close();
  }

  #connect() {
    if (navigator && !navigator.onLine) {
      console.warn('Network is offline. Cannot connect to WebSocket server.');
      return;
    }
    this.#ws = new WebSocket(this.#wsUrl);
    this.#ws.addEventListener('open', this.#onOpen);
    this.#ws.addEventListener('message', this.#onMessage);
    this.#ws.addEventListener('close', this.#onClose);
    this.#ws.addEventListener('error', this.#onError);
    this.on('mounted', this.#handleMounted.bind(this));
  }

  #onOpen = () => {
    console.log('Connected to server');
    if (this.#useHeartbeat) this.#startHeartbeat();
    if (this.#useLocalEvents && this.#localEvents.length > 0) {
      if (this.#localEventsDelay) {
        let i = this.#localEvents.length - 1;
        this.#localEventsDispatchInterval = setInterval(() => {
            if (i >= 0) {
              console.log(`Dispatching local events (${this.#localEvents.length})...`);
              const event = this.#localEvents[i];
              this.send(event[0], event[1]);
              this.#localEvents.splice(i, 1);
              i--;
            } else {
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
  #onError = (error) => console.error('WebSocket Error:', error);
  #onClose = () => {
    console.log('Connection closed');
    if (this.#connectionRetryCount < this.#connectionMaxRetries) {
      this.#retryConnection();
    } else {
      console.error('Max retry attempts reached. Connection closed permanently.');
    }
  }

  #startHeartbeat() {
    this.#pingInterval = setInterval(() => {
      if (this.#ws.readyState === WebSocket.OPEN) {
        this.#ws.send(JSON.stringify(this.#heartbeatMessage));
        this.#heartbeatExpectedResponseTimeout = setTimeout(() => {
          console.warn('No heartbeat expected response, reconnecting...');
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
    console.log(`Retrying connection in ${retryIn / 1000} seconds (Attempt ${this.#connectionRetryCount} of ${this.#connectionMaxRetries})`);
    setTimeout(() => {
      console.log('Attempting to reconnect...');
      this.#connect();
    }, retryIn);
  }

  #handleMounted(data) {
      if (!data.wsId) return this.destroy(`No 'wsId' found in mounted event.`);
      this.#id = data.wsId;
      this.#mountTime = Date.now();
      console.log(`Mounted with id: ${this.#id} on ${this.#mountTime}`);
  }

  #onEvent(event) {
      let eventData;
      try {
          eventData = JSON.parse(event.data);
      } catch (error) {
          console.warn('Failed to parse event data, using raw data instead.', error);
      }

      const [eventName, payload] = Array.isArray(eventData) ? eventData : [eventData];
      const handler = this.#handlers.find(h => h.eventName === eventName);

      if (!handler) {
          console.warn(`Handler not found for event '${eventName}'`);
          return;
      }

      if (handler && handler.off) return;

      this.#processHandler(handler, payload);
  }

  #processHandler(handler, payload) {
      const { config } = handler;
      if (!config) throw new Error(`No config found for handler of event type: ${handler.eventName}`);

      if (config.cycle) {
          this.#processCycle(handler, payload);
      }

      if (config.ack) {
          this.#sendAck(handler.eventName, config.ack, payload);
      }

      if (typeof config === 'function') {
          config(payload);
      } else if (config.callback) {
          config.callback(payload);
      }
      handler.tracking = {
        lastTrigger: Date.now()
      }
      this.#updateHandler(handler, handler.config);
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
        id: this.#id,
        ...(ackConfig && ackConfig.originalEvent) ? originalEventPayload : null
      };
      this.#ws.send(JSON.stringify([(ackConfig.event) ? ackConfig.event : `${eventName}-ack`, ackMessage]));
  }

  send(eventName, payload) {
    const message = [eventName, {
      when: Date.now(),
      id: this.#id,
      payload
    }];

    if (navigator && !navigator.onLine && this.#useLocalEvents) {
      console.warn('Network is offline. Storing event locally.');
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
      console.error('WebSocket destroyed:', reason);
  }
}
