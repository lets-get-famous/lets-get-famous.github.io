using UnityEngine;
using System.Collections;

namespace Firesplash.GameDevAssets.SocketIO.MIT {
    [System.Serializable]
    public class SocketOpenData {

        public string sid;
        public string[] upgrades;
        public int pingInterval;
        public int pingTimeout;

    }
}