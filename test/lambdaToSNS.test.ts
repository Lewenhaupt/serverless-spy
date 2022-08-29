import * as fs from 'fs';
import * as path from 'path';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { createServerlessSpyListener } from '../listener/createServerlessSpyListener';
import { SpyListener } from '../listener/SpyListener';
import { SpyEvents } from './SpyEvents';

jest.setTimeout(30000);

describe('Lambda to SNS', () => {
  const exportLocation = path.join(__dirname, './cdk/cdkExports.json');
  let serverlessSpyListener: SpyListener<SpyEvents>;

  if (!fs.existsSync(exportLocation)) {
    throw new Error(`File ${exportLocation} doen not exists.`);
  }
  const output = JSON.parse(fs.readFileSync(exportLocation).toString())[
    'ServerlessSpyLambdaToSNS'
  ];

  beforeEach(async () => {
    serverlessSpyListener = await createServerlessSpyListener<SpyEvents>({
      serverlessSpyWsUrl: output.ServerlessSpyWsUrl,
    });
  });

  afterEach(async () => {
    serverlessSpyListener.stop();
  });

  test('basic test', async () => {
    const lambdaClient = new LambdaClient({});

    const data = <DataType>{
      message: 'Hello',
    };

    const command = new InvokeCommand({
      FunctionName: output.FunctionNameTestA,
      InvocationType: 'RequestResponse',
      LogType: 'Tail',
      Payload: JSON.stringify(data) as any,
    });

    const r = await lambdaClient.send(command);

    // expect(data).toMatchObject;

    // await expect(serverlessSpyListener).toReceiveEvent(
    //   "Function#TestA#Request"
    // );

    /*
    (
      await (
        await (
          await serverlessSpyListener.waitForFunctionTestARequest<DataType>(
            (data) => data.request.key1 === "value1"
          )
        )
          .toMatchObject(data)
          .follwedByConsoleLog()
      )
        .toMatchObject(data)
        .follwedByResponse()
    ).toMatchObject(data);
    */

    // @ts-ignore

    const f = (
      await serverlessSpyListener.waitForFunctionTestARequest<DataType>()
    ).getData();
    console.log('req', f.request.key1);

    const waitForRequest = (
      await serverlessSpyListener.waitForFunctionTestARequest<DataType>()
    )
      .toMatchObject({
        request: { key1: 'value1' },
      })
      .toMatchObject({ request: { key2: 'value2' } })
      .toMatchObject({ request: { key3: 'value3' } });

    const req = waitForRequest.getData();
    console.log('req', req.request.key1);

    const resp = (
      await waitForRequest.followedByResponse<DataType>({
        condition: (d) => {
          return d.response.key1 === 'value1';
        },
      })
    )
      .toMatchObject({ response: { key2: 'value2' } })
      .getData();

    console.log('resp', resp.response.key1);

    await serverlessSpyListener.waitForDynamoDBDDBTable<DataType>({
      condition: (d) => d.newImage.key1 === 'value1',
    });

    const x = (
      await serverlessSpyListener.waitForDynamoDBDDBTable<DataType>({
        condition: (d) => d.newImage.key1 === 'value1',
      })
    )
      .toMatchObject({ newImage: { key2: 'value2' } })
      .getData();
    console.log('x', x.newImage.key1);

    // const d = (
    //   await serverlessSpyListener.waitForDynamoDBDDBTable<DataType>({
    //     condition: (d) => d.data.newImage.data.key1 === "value1",
    //     timoutMs: 10000,
    //   })
    // ).getData(); //toMatchObject({ newImage: { data: { key1: "value1" } } });
    // console.log(d.newImage.key1);
  });
});

type DataType = {
  message: string;
};
