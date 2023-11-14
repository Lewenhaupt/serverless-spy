import { IoTClient, DescribeEndpointCommand } from '@aws-sdk/client-iot';
import { mqtt, iot, auth } from 'aws-iot-device-sdk-v2';

export const SSPY_TOPIC = 'sspy';

export type fragment = { id: string; index: number; count: number; data: any };

function createLog(debugMode: boolean) {
  return (message: string, ...optionalParams: any[]) => {
    if (debugMode) {
      console.debug('SSPY', message, ...optionalParams);
    }
  };
}

function createErrorLog() {
  return (message: string, ...optionalParams: any[]) => {
    console.error('SSPY', message, ...optionalParams);
  };
}

export async function getConnection(
  debugMode: boolean
): Promise<mqtt.MqttClientConnection> {
  const log = createLog(debugMode);
  const logError = createErrorLog();
  log('Getting IoT endpoint');
  let response: any;
  try {
    const iotClient = new IoTClient({});
    response = await iotClient.send(
      new DescribeEndpointCommand({
        endpointType: 'iot:Data-ATS',
      })
    );
  } catch (e) {
    logError('failed to get endpoint', e);
    throw e;
  }
  log('Using IoT endpoint:', response.endpointAddress);

  if (!response.endpointAddress) {
    logError('No IoT endpoint could be found');
    throw new Error('IoT Endpoint address not found');
  }
  let config_builder =
    iot.AwsIotMqttConnectionConfigBuilder.new_with_websockets({
      region: response.endpointAddress.split('.')[2],
      credentials_provider: auth.AwsCredentialsProvider.newDefault(),
    })
      .with_keep_alive_seconds(30)
      .with_clean_session(false)
      .with_endpoint(response.endpointAddress)
      .with_client_id('test-' + Math.floor(Math.random() * 100000000));
  const config = config_builder.build();

  const client = new mqtt.MqttClient();
  const connection = client.new_connection(config);

  connection.on('connect', () => {
    log('IoT connected');
  });

  connection.on('error', (err) => {
    logError('IoT error', err);
  });

  connection.on('closed', () => {
    log('IoT closed');
  });

  connection.on('resume', () => {
    log('IoT reconnected');
  });

  await connection.connect();

  return connection;
}
