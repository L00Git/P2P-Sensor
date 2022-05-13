    const list = document.getElementById('log');

    function append(s) {
        const node = document.createElement("li");
        const textnode = document.createTextNode(s);
        node.appendChild(textnode);
        list.appendChild(node);
    }

    document.getElementById("options").style.visibility = "hidden"
    document.getElementById("topic").style.visibility = "hidden"
    document.getElementById("lowerBound").style.visibility = "hidden"
    document.getElementById("upperBound").style.visibility = "hidden"
    document.getElementById("key").style.visibility = "hidden"
    document.getElementById("value").style.visibility = "hidden"
    
    change()

    function change(){
        var e = document.getElementById("commands").value;
        if(e == "GET"){
            document.getElementById("options").style.visibility = "visible"
            document.getElementById("topic").style.visibility = "visible"
            document.getElementById("lowerBound").style.visibility = "hidden"
            document.getElementById("upperBound").style.visibility = "hidden"
            document.getElementById("key").style.visibility = "hidden"
            document.getElementById("value").style.visibility = "hidden"
        }else if(e == "SUB"){
            document.getElementById("options").style.visibility = "hidden"
            document.getElementById("topic").style.visibility = "visible"
            document.getElementById("lowerBound").style.visibility = "hidden"
            document.getElementById("upperBound").style.visibility = "hidden"
            document.getElementById("key").style.visibility = "hidden"
            document.getElementById("value").style.visibility = "hidden"
        }else if(e == "UNSUB"){
            document.getElementById("options").style.visibility = "hidden"
            document.getElementById("topic").style.visibility = "visible"
            document.getElementById("lowerBound").style.visibility = "hidden"
            document.getElementById("upperBound").style.visibility = "hidden"
            document.getElementById("key").style.visibility = "hidden"
            document.getElementById("value").style.visibility = "hidden"
        }else if(e == "PUB"){
            document.getElementById("options").style.visibility = "hidden"
            document.getElementById("topic").style.visibility = "hidden"
            document.getElementById("lowerBound").style.visibility = "hidden"
            document.getElementById("upperBound").style.visibility = "hidden"
            document.getElementById("key").style.visibility = "visible"
            document.getElementById("value").style.visibility = "visible"
        }
    }


    function changeGet(){
        var e = document.getElementById("options").value;
        if(e == "BETWEEN"){
            document.getElementById("lowerBound").style.visibility = "visible"
            document.getElementById("upperBound").style.visibility = "visible"
        }else{
            document.getElementById("lowerBound").style.visibility = "hidden"
            document.getElementById("upperBound").style.visibility = "hidden"
        }
    }

    function getRequest(){
        var e = document.getElementById("commands").value
        if(e == "GET"){
            var o = document.getElementById("options").value;
            if(o == "BETWEEN"){
                return e + " " + o + "," + document.getElementById("lowerBound").value + "," + document.getElementById("upperBound").value + " " +document.getElementById("topic").value
            }else{
                return e + " " + o + " " +document.getElementById("topic").value
            }
        }else if(e == "SUB"){
            return e + " " +document.getElementById("topic").value
        }else if(e == "UNSUB"){
            return e + " " +document.getElementById("topic").value
        }else if(e == "PUB"){
            return e + ' {"key": "' + document.getElementById("key").value + '", "value": "' + document.getElementById("value").value + '" }'
        }
    }


    //https://www.pegaxchange.com/2018/03/23/websocket-client/
    /**
     * Event handler for clicking on button "Connect"
     */
    function onConnectClick() {
        openWSConnection();
    }
    /**
     * Event handler for clicking on button "Disconnect"
     */
    function onDisconnectClick() {
        webSocket.close();
    }
    /**
     * Open a new WebSocket connection using the given parameters
     */
    function openWSConnection() {
        var webSocketURL = null;
        webSocketURL = 'ws://localhost:8080/'
        console.log("openWSConnection::Connecting to: " + webSocketURL);
        try {
            webSocket = new WebSocket(webSocketURL, 'echo-protocol');
            webSocket.onopen = function(openEvent) {
                console.log("WebSocket OPEN: " + JSON.stringify(openEvent, null, 4));
                append("WebSocket OPEN: " + JSON.stringify(openEvent, null, 4))
                document.getElementById("btnSend").disabled       = false;
            document.getElementById("btnConnect").disabled    = true;
            document.getElementById("btnDisconnect").disabled = false;
            };
            webSocket.onclose = function (closeEvent) {
                console.log("WebSocket CLOSE: " + JSON.stringify(closeEvent, null, 4));
                append("WebSocket CLOSE: " + JSON.stringify(closeEvent, null, 4))
                document.getElementById("btnSend").disabled       = true;
                document.getElementById("btnConnect").disabled    = false;
                document.getElementById("btnDisconnect").disabled = true;
            };
            webSocket.onerror = function (errorEvent) {
                console.log("WebSocket ERROR: " + JSON.stringify(errorEvent, null, 4));
                append("WebSocket ERROR: " + JSON.stringify(errorEvent, null, 4));
            };
            webSocket.onmessage = function (messageEvent) {
                var wsMsg = messageEvent.data;
                console.log("WebSocket MESSAGE: " + wsMsg);
                if (wsMsg.indexOf("error") > 0) {
                    append("error: " + wsMsg.error)
                } else {
                    append("message: " + wsMsg)
                }
            };
        } catch (exception) {
            console.error(exception);
            append(exception)
        }
    }
    /**
     * Send a message to the WebSocket server
     */
    function onSendClick() {
        if (webSocket.readyState != WebSocket.OPEN) {
            console.error("webSocket is not open: " + webSocket.readyState);
            append("webSocket is not open: " + webSocket.readyState)
            return;
        }
        webSocket.send(getRequest());
    }
