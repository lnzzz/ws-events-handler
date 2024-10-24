class WebSocketEventsHandler {
    constructor(ws) {
      this.handlers = [];
      this.afterHooks = [];
      this.id = null;
      this.ws = ws;

      this.mountTime = null;

      this.onOpen = () => console.log('Connected to server');
      this.onMessage = (event) => this.on(event);
      this.onError = (error) => console.log(error);
      this.onClose = () => console.log('Connection closed');

      this.ws.addEventListener('open', this.onOpen);
      this.ws.addEventListener('message', this.onMessage);
      this.ws.addEventListener('close', this.onClose);
      this.ws.addEventListener('error', this.onError);

      this.register('mounted', (data) => {
        if (!data.id) this.destroy(`No 'id' found in mounted event.`);
        this.id = data.id;
        this.mountTime = Date.now();
        console.log(`Mounted with id: ${this.id} on ${this.mountTime}`);
      });

    }

    _updateHandler(handler, config) {
      console.log(config);
      const index = this.handlers.findIndex(h => h.t === handler.t);
      this.handlers[index] = { ...handler, config };
      console.log(this.handlers[index]);
    }

    _getHandlers() {
      return this.handlers;
    }

    on(event) {
      let eventData = event.data || null;
      if (!eventData) throw new Error('No event data found');
      try {
        eventData = JSON.parse(eventData);
      } catch (error) {}

      if (!Array.isArray(eventData)) {
        eventData = [eventData];
      }
      const [eventType, payload] = eventData;
      const handler = this._getHandlers().find(h => h.t === eventType);

      if (!handler) {
        console.warn(`Handler not found for event '${eventType}'`);
        return;
      }

      const { config } = handler;
      const { cycle } = config;

      if (cycle && cycle.every) {
        if (!cycle.hasOwnProperty('internalMessageCount')) {
          this._updateHandler(handler, {...config, cycle: { ...cycle, internalMessageCount: 0, internalCyclePayloads: [] }});
        }

        if (cycle.hasOwnProperty('internalMessageCount')) {
          cycle.internalMessageCount = cycle.internalMessageCount+1;
          cycle.internalCyclePayloads.push(payload);
          this._updateHandler(handler, {...config, cycle: { ...cycle }});
        }

        console.log(`${cycle.internalMessageCount} / ${cycle.every}`);

        if (cycle.internalMessageCount === cycle.every) {
          cycle.callback(cycle.internalCyclePayloads);
          cycle.internalCyclePayloads = [];
          cycle.internalMessageCount = 0;
          this._updateHandler(handler, {...config, cycle: { ...cycle }});
        }
      }
      if (!config) throw new Error(`No config found for handler of event type: ${eventType}`);
      
      if (config.ack) this.sendAck(eventType);

      if (typeof config === 'function') {
        config(payload);
      } else if (config.callback) {
        config.callback(payload);
      }
    }

    sendAck(eventType) {
      this.ws.send(JSON.stringify([`${eventType}-ack`, { when: Date.now(), id: this.id }]));
    }

    send(eventType, payload) {
      this.ws.send(JSON.stringify([eventType, payload]))
    }

    register(eventType, config) {
      this.handlers.push({ t: eventType, config, registeredOn: Date.now() });
    }

    unregister(eventType) {
      this.handlers = this.handlers.filter(h => h.t !== eventType);
    }

    destroy(reason) {
      this.ws.removeEventListener('message', this.onMessage);
      this.ws.removeEventListener('open', this.onOpen);
      this.ws.removeEventListener('close', this.onClose);
      this.ws.removeEventListener('error', this.onError);
      throw new Error(reason);
    }
  }