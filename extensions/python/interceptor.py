import json
import os

import boto3
from awscrt import auth, http, mqtt5
from awsiot import mqtt_connection_builder
from awslambdaric import bootstrap

boto_iot = boto3.client('iot')

subscribed_to_sqs = os.environ['SSPY_SUBSCRIBED_TO_SQS'] == 'true'
debug_mode = os.environ['SSPY_DEBUG'] == 'true'

_print = print


def on_connection_interrupted(connection, error, **kwargs):
    print('Connection interrupted. error: {}'.format(error))


# Callback when an interrupted connection is re-established.
def on_connection_resumed(connection, return_code, session_present, **kwargs):
    print(
        'Connection resumed. return_code: {} session_present: {}'.format(
            return_code, session_present
        )
    )


def handler(event, context):
    spied_function_name = os.environ['SSPY_FUNCTION_NAME']
    original_handler_name = os.environ['ORIGINAL_HANDLER']
    original_handler = bootstrap._get_handler(original_handler_name)

    iot_endpoint_response = boto_iot.describe_endpoint(
        endpointType='iot:Data-ATS'
    )
    endpoint_address = iot_endpoint_response['endpointAddress']
    credentials_provider = auth.AwsCredentialsProvider.new_default_chain()

    mqtt_connection = (
        mqtt_connection_builder.websockets_with_default_aws_signing(
            endpoint=endpoint_address,
            region=os.environ['AWS_REGION'],
            credentials_provider=credentials_provider,
            on_connection_interrupted=on_connection_interrupted,
            on_connection_resumed=on_connection_resumed,
            client_id=context.aws_request_id,
            clean_session=False,
            keep_alive_secs=30,
        )
    )
    connect_future = mqtt_connection.connect()

    # Future.result() waits until a result is available
    connect_future.result()
    print(f'Connected!')
    mqtt_connection.publish(
        topic=spied_function_name,
        payload=json.dumps(
            {
                'type': f'Function#{spied_function_name}#Request',
                'request': event,
                'context': context,
            }
        ),
        qos=mqtt5.QoS.AT_LEAST_ONCE,
    )
    try:
        response = original_handler(event, context)
        mqtt_connection.publish(
            topic=spied_function_name,
            payload=json.dumps(
                {
                    'type': f'Function#{spied_function_name}#Response',
                    'request': event,
                    'response': response,
                    'context': context,
                }
            ),
            qos=mqtt5.QoS.AT_LEAST_ONCE,
        )
    except Exception as e:
        print('error')
