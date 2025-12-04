using System;
using System.Collections.Generic;

namespace Firesplash.GameDevAssets.SocketIO
{
    public class SocketIOInstance
    {
        /// <summary>
        /// DISCONNECTED means a disconnect happened upon request or a connection has never been attempted.
        /// CONNECTED is obvious
        /// ERROR means that connection should be established but it is not (check log output)
        /// RECONNECTING means that connection was established but got disconnected and the system is still trying to reconnect
        /// </summary>
        public enum SIOStatus { DISCONNECTED, CONNECTED, ERROR, RECONNECTING };

        public SIOStatus Status { get; internal set; } = SIOStatus.DISCONNECTED;

        internal string InstanceName;
        internal string GameObjectName;
        internal string targetAddress;
        internal bool enableAutoReconnect;
        internal SIOAuthPayload authPayload = null;

        /// <summary>
        /// Contains the SocketID of the current connection. Is null if never connected, still contains the old SocketID after a connection loss until a (re)connect succeeded.
        /// </summary>
        public virtual string SocketID
        {
            get; internal set;
        }

        private Dictionary<string, List<SocketIOEvent>> eventCallbacks;
        private List<SocketIOCatchallEvent> eventCatchallCallbacks;

        /// <summary>
        /// This is the callback type for Socket.IO events
        /// </summary>
        /// <param name="data">The data payload of the transmitted event. Plain text or stringified JSON object.</param>
        public delegate void SocketIOEvent(string data);

        /// <summary>
        /// This is the callback type for Socket.IO "Any" events
        /// </summary>
        /// <param name="eventName">The name of the received event</param>
        /// <param name="data">The data payload of the transmitted event. Plain text or stringified JSON object.</param>
        public delegate void SocketIOCatchallEvent(string eventName, string data);

        internal SocketIOInstance(string gameObjectName, string targetAddress, bool enableReconnect)
        {
            eventCallbacks = new Dictionary<string, List<SocketIOEvent>>();
            eventCatchallCallbacks = new List<SocketIOCatchallEvent>();
            this.InstanceName = gameObjectName;
            this.GameObjectName = gameObjectName;
            this.targetAddress = targetAddress;
            this.enableAutoReconnect = enableReconnect;
        }

        internal void PrepareDestruction()
        {
            if (IsConnected()) Close();
        }
        ~SocketIOInstance()
        {
            Status = SIOStatus.DISCONNECTED;
            eventCallbacks = null;
        }

        /// <summary>
        /// Returns a Boolean which is true if the library is currently connected to the server.
        /// </summary>
        /// <returns></returns>
        public virtual bool IsConnected()
        {
			return Status == SIOStatus.CONNECTED;
        }

        /// <summary>
        /// Connect this Socket.IO instance using the stored parameters from last connect / component configuration
        /// </summary>
        /// <seealso cref="Firesplash.GameDevAssets.SocketIO.SocketIOInstance.Connect(String, Boolean, SIOAuthPayload)"/>
        public virtual void Connect()
        {
            Connect(this.targetAddress, this.enableAutoReconnect, this.authPayload);
        }

        /// <summary>
        /// Connect this Socket.IO instance using the component's set configuration but with (new) auth data
        /// </summary>
        /// <seealso cref="Firesplash.GameDevAssets.SocketIO.SocketIOInstance.Connect(String, Boolean, SIOAuthPayload)"/>
        /// <param name="authPayload">An instance of SIOAuthPayload to be sent upon (re-)connection. Can for example be used to send an authentication token.</param>
        public virtual void Connect(SIOAuthPayload authPayload)
        {
            Connect(targetAddress, this.enableAutoReconnect, authPayload);
        }

        /// <summary>
        /// Connect this Socket.IO instance to a new target (this even works after the initial connect)
        /// This method sends a previously used auth payload (if available)
        /// </summary>
        /// <seealso cref="Firesplash.GameDevAssets.SocketIO.SocketIOInstance.Connect(String, Boolean, SIOAuthPayload)"/>
        /// <param name="targetAddress">The server / IO address to connect to. Has to start with http:// or https:// (substitute ws with http or wss with https): http[s]://<Hostname>[:<Port>][/<path>]</param>
        /// <param name="enableReconnect">Shall we reconnect automatically on an unexpected connection loss?</param>
        public virtual void Connect(string targetAddress, bool enableReconnect)
        {
            Connect(targetAddress, this.enableAutoReconnect, this.authPayload);
        }

        /// <summary>
        /// When Auto-Connect is disabled(best practice), this call connects to the server.It can also be used to reconnect to a different(or the same) server at runtime.
        /// You can optionally specify a targetAddress.If omitted, the system will connect to the server configured in the inspector (or the last target if Connect has already been called before on the instance). If an address is given, you must also specify the enableReconnect Boolean which sets the automatic reconnect function on(true) or off(false).
        /// Note: If specified via Connect parameter, the server address must be given as a valid http:// or https:// scheme URI for native and WebGL implementations. The server still has to work using WebSocket transport.
        /// Further, the optional authPayload can be given to transmit data(e.g.a token) to the server at connect time which can(and should) be used for authentication purposes.SIOAuthPayload supports bool, string, int, double and float parameters.
        /// </summary>
        /// <param name="targetAddress">The server / IO address to connect to. Has to start with http:// or https:// (substitute ws with http or wss with https): http[s]://&lt;Hostname&gt;[:&lt;Port&gt;][/&lt;path&gt;]</param>
        /// <param name="enableReconnect">Shall we reconnect automatically on an unexpected connection loss?</param>
        /// <param name="authPayload">Null or an instance of SIOAuthPayload to be sent upon connection. Can for example be used to send an authentication token.</param>
        /// <exception cref="UriFormatException">if the syntax of the given address is invalid</exception>
        public virtual void Connect(string targetAddress, bool enableReconnect, SIOAuthPayload authPayload)
        {
            if (!targetAddress.StartsWith("http://") && !targetAddress.StartsWith("https://")) throw new UriFormatException("Socket.IO Address has to start with http:// or https:// if provided programmatically");

            this.targetAddress = targetAddress;
            this.enableAutoReconnect = enableReconnect;
            this.authPayload = authPayload;
        }

        /// <summary>
        /// Closes the connection to the server
        /// </summary>
        public virtual void Close()
        {

        }

        /// <summary>
        /// Used to subscribe to a specific event. The callback will be executed everytime when the specific event is received.
        /// The callback contains a string. This is the data sent from the server, eighter a stringified JSON object (if the data was a json object) or a plain text string.
        /// If the server sent no payload, the string will be null.
        /// </summary>
        /// <param name="EventName"></param>
        /// <param name="Callback"></param>
        public virtual void On(string EventName, SocketIOEvent Callback) {
            //Add callback internally
            if (!eventCallbacks.ContainsKey(EventName))
            {
                eventCallbacks.Add(EventName, new List<SocketIOEvent>());
            }
            eventCallbacks[EventName].Add(Callback);
        }

        /// <summary>
        /// Registers a callback that will be called on any incoming event
        /// </summary>
        /// <param name="Callback"></param>
        public virtual void OnAny(SocketIOCatchallEvent Callback) {
            //Add callback internally
            eventCatchallCallbacks.Add(Callback);
        }

        /// <summary>
        /// Unregisters a specific callback to a given event
        /// </summary>
        /// <param name="EventName"></param>
        public virtual void Off(string EventName, SocketIOEvent Callback)
        {
            if (eventCallbacks.ContainsKey(EventName)) {
                eventCallbacks[EventName].Remove(Callback);
            }
        }

        /// <summary>
        /// Unregisters all callbacks to a given event
        /// </summary>
        /// <param name="EventName"></param>
        public virtual void Off(string EventName)
        {
            if (eventCallbacks.ContainsKey(EventName))
            {
                eventCallbacks.Remove(EventName);
            }
        }

        /// <summary>
        /// Unregisters a specific Catchall-Callback
        /// </summary>
        /// <param name="Callback"></param>
        public virtual void OffAny(SocketIOCatchallEvent Callback)
        {
            if (eventCatchallCallbacks.Contains(Callback)) {
                eventCatchallCallbacks.Remove(Callback);
            }
        }

        /// <summary>
        /// Unregisters all CatchAll-Callbacks
        /// </summary>
        public virtual void OffAny()
        {
            eventCatchallCallbacks.Clear();
        }

        /// <summary>
        /// Called by the platform specific implementation
        /// </summary>
        /// <param name="EventName"></param>
        /// <param name="Data"></param>
        internal virtual void RaiseSIOEvent(string EventName, string Data)
        {
            if (eventCallbacks.ContainsKey(EventName))
            {
                foreach (SocketIOEvent cb in eventCallbacks[EventName])
                {
                    cb.Invoke(Data);
                }
            }

            foreach (SocketIOCatchallEvent cb in eventCatchallCallbacks)
            {
                cb.Invoke(EventName, Data);
            }
        }

        /// <summary>
        /// Used to send an event to the server containaing am optional payload.
        /// If DataIsPlainText is set true, the data will be delivered as a string. Else it will be delivered as a JSON object. If JSON object is sent(DataIsPlainText= false) and the string is not a valid stringified object, unexpected errors might occur.The third parameter is a hard override.
        /// </summary>
        /// <param name="EventName">The name of the event</param>
        /// <param name="Data">The payload (can for example be a serialized object)</param>
        /// <param name="DataIsPlainText">Use this parameter to explicitely state if the data is stringified JSON or a plain text string. Default: false = JSON object</param>
        public virtual void Emit(string EventName, string Data, bool DataIsPlainText)
        {

        }

        /// <summary>
        /// Emits a Socket.IO Event with payload
        /// Without third parameter: If the payload is a valid JSON stringified object, the server will receive it as a JSON object.
        /// The automatic detection(JSON or PlainText) only works reliably in conjunction with JSON.NET as described above.If you don’t use JSON.NET (or if you forgot to set the flag), omitting the third parameter will cause a deprecation warning.
        /// If you are using JSON.NET, everything is fine. If not, consider using it (and set the HAS_JSON_NET flag) OR use the third parameter to specify the data type manually.
        /// </summary>
        /// <param name="EventName">The name of the event</param>
        /// <param name="Data">The payload (can for example be a serialized object)</param>
#if !HAS_JSON_NET
        [System.Obsolete("You are sending payload along an Emit without specifying the third parameter. -- This might cause unexpected results for complex objects or some plain text strings. Please consider using JSON.NET and set the HAS_JSON_NET flag or explicitely specify the third parameter to distinguish between plain text and JSON. Please referr to the documentation for more information abut this topic.")]
#endif
        public virtual void Emit(string EventName, string Data)
        {

        }

        /// <summary>
        /// Emits a Socket.IO Event without payload
        /// </summary>
        /// <param name="EventName">The name of the event</param>
        public virtual void Emit(string EventName)
        {

        }
    }
}
