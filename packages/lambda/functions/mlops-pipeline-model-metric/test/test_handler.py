import os
import sys
import json

## AWS profile for testing
#os.environ['AWS_PROFILE'] = 'default'

## Add test function to python path
sys.path.append(os.path.dirname(os.path.abspath(os.path.dirname(__file__)))+'/src')
import handler

## Run test handler
def test_handle():
    print('test_handle')
    with open('event.json') as f:
        event = json.load(f)
        response = handler.handle(event, None)
        print('response', response)

test_handle()
