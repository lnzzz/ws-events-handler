class WebSocketEventsHandler {
  #handlers = [];
  #id = null;
  #ws;
  #mountTime = null;

  constructor(ws) {  
      this.#ws = ws;

      this.#ws.addEventListener('open', this.#onOpen);
      this.#ws.addEventListener('message', this.#onMessage);
      this.#ws.addEventListener('close', this.#onClose);
      this.#ws.addEventListener('error', this.#onError);
      
      this.register('mounted', this.#handleMounted.bind(this));
  }

  #onOpen = () => console.log('Connected to server');
  #onMessage = (event) => this.#onEvent(event);
  #onError = (error) => console.error('WebSocket Error:', error);
  #onClose = () => console.log('Connection closed');

  #handleMounted(data) {
      if (!data.id) return this.destroy(`No 'id' found in mounted event.`);
      this.#id = data.id;
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

      const [eventType, payload] = Array.isArray(eventData) ? eventData : [eventData];
      const handler = this.#handlers.find(h => h.t === eventType);

      if (!handler) {
          console.warn(`Handler not found for event '${eventType}'`);
          return;
      }

      this.#processHandler(handler, payload);
  }

  #processHandler(handler, payload) {
      const { config } = handler;
      if (!config) throw new Error(`No config found for handler of event type: ${handler.t}`);

      if (config.cycle) {
          this.#processCycle(handler, payload);
      }

      if (config.ack) {
          this.sendAck(handler.t);
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
          cycle.callback(cycle.internalCyclePayloads);
          cycle.internalMessageCount = 0;
          cycle.internalCyclePayloads = [];
      }

      this.#updateHandler(handler, handler.config);
  }

  #updateHandler(handler, config) {
      const index = this.#handlers.findIndex(h => h.t === handler.t);
      if (index !== -1) {
          this.#handlers[index] = { ...handler, config };
      }
  }

  sendAck(eventType) {
      this.#ws.send(JSON.stringify([`${eventType}-ack`, { when: Date.now(), id: this.#id }]));
  }

  register(eventType, config) {
      this.#handlers.push({ t: eventType, config, registeredOn: Date.now() });
  }

  unregister(eventType) {
      this.#handlers = this.#handlers.filter(h => h.t !== eventType);
  }

  destroy(reason) {
      this.#ws.removeEventListener('message', this.#onMessage);
      this.#ws.removeEventListener('open', this.#onOpen);
      this.#ws.removeEventListener('close', this.#onClose);
      this.#ws.removeEventListener('error', this.#onError);
      console.error('WebSocket destroyed:', reason);
  }
}
