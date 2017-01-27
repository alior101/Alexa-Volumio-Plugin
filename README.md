# Alexa-Volumio-Plugin

instructions to add the plugin in manual mode:

1. put the files in /data/plugins/user-interface/alexa/

2. update /data/configuration/plugins.json with the alexa entry


  "user_interface": {
    "websocket": {
      "enabled": {
        "type": "boolean",
        "value": true
      },
      "status": {
        "type": "string",
        "value": "STARTED"
      }
    },
    "alexa": {
      "enabled": {
        "type": "boolean",
        "value": true
      },
      "status": {
        "type": "string",
        "value": "STOPPED"
      }
    },
    "mpdemulation": {
      "enabled": {
        "type": "boolean",


3. restart volumio with 
  systemctl restart volumio
