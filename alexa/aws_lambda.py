#!/usr/bin/python

"""
The MIT License (MIT)
Copyright (c) 2016 jagsta
Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:
The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
"""
import os
import json
import paho.mqtt.client as mqtt
import ssl
from yaep import populate_env
from yaep import env
from ask import alexa

ENV_FILE = os.path.join(os.path.dirname(__file__), ".env")

response=''

def setup_env():
  os.environ['ENV_FILE'] = ENV_FILE
  populate_env()

def verify_appid(appid=None):
  if appid != env('SKILL_APPID'):
    raise ValueError("Invalid Application ID")

def on_message(client, userdata, msg):
  global response
  response = str(msg.payload)
  print("*** Volumio response received ****")
  print("*** Volumio response received: " + response)
  #print("Volumio response received: " +str(json.loads(response)))
  client.disconnect()

def on_session_started(session_started_request, session):
  print("on_session_started: requestId=" + session_started_request['requestId'] + ", sessionId=" + session['sessionId'])

def build_response(session_attributes, speechlet_response):
    return {
        "version": "1.0",
        "sessionAttributes": session_attributes,
        "response": speechlet_response
    }
    
def build_speechlet_response(title, output, reprompt_text, should_end_session):
    return {
        "outputSpeech": {
            "type": "PlainText",
            "text": output
        },
        "card": {
            "type": "Simple",
            "title": title,
            "content": output
        },
        "reprompt": {
            "outputSpeech": {
                "type": "PlainText",
                "text": reprompt_text
            }
        },
        "shouldEndSession": should_end_session
    }


def lambda_handler(event, context):
  appid = event['session']['application']['applicationId']
  print("lambda_handler: applicationId=" + appid)
  print("event: " +json.dumps(event))

  alexa_enabled = 1
  
  setup_env()

  verify_appid(appid)

  if event['session']['new']:
    on_session_started({'requestId': event['request']['requestId']}, event['session'])
  
  CLIENTID = os.getenv('MQTT_CLIENTID', 'clientid')
  PORT = os.getenv('MQTT_PORT', '10338')
  USER = os.getenv('MQTT_USER', 'MQTT_USER_TO_REPLACE')
  PASS = os.getenv('MQTT_PASSWORD', 'MQTT_PASSWORD_TO_REPLACE')
  MQTT = os.getenv('MQTT_ADDRESS', 'm20.cloudmqtt.com')
  PUB = os.getenv('MQTT_PUBTOPIC', '/alexa/command')
  SUB = os.getenv('MQTT_SUBTOPIC', '/alexa/response')
  SUB_ENABLED = os.getenv('MQTT_SUBTOPIC', '/alexa/enabled')
  CAFILE = os.getenv('MQTT_CAFILE', 'ca.pem')

  client = mqtt.Client(CLIENTID)
  client.username_pw_set(USER, PASS)
  #client.tls_set(CAFILE, certfile=None, keyfile=None, cert_reqs=ssl.CERT_REQUIRED, tls_version=ssl.PROTOCOL_TLSv1_2)
  client.on_message = on_message
  client.connect(MQTT, PORT, 60)
  client.subscribe(SUB, qos=0)
  if (alexa_enabled == 1):
    client.publish(PUB, json.dumps(event))
    print("published event, waiting on response")
    client.loop_forever()
    print("published event, done with client.loop_forever()")
    session_attributes = {}
    card_title = "Alexa Home Control"
    speech_output = response
    reprompt_text = "Anything else ?" 
    should_end_session = False
    return build_response(session_attributes, build_speechlet_response(card_title, speech_output, reprompt_text, should_end_session))
  else:
    card_title = "Alexa Home Control"
    speech_output = "Sorry, Control is disabled"
    reprompt_text = "Anything else ?" 
    should_end_session = False
    return build_response(session_attributes, build_speechlet_response(card_title, speech_output, reprompt_text, should_end_session))
    
  #return alexa.create_response(message="Goodbye!")


