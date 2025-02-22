'use strict';

const expect = require('chai').expect;
const sinon = require('sinon');
const AwsInfo = require('../../../../../../lib/plugins/aws/info/index');
const AwsProvider = require('../../../../../../lib/plugins/aws/provider');
const Serverless = require('../../../../../../lib/Serverless');
const CLI = require('../../../../../../lib/classes/CLI');
const chalk = require('chalk');
const runServerless = require('../../../../../utils/run-serverless');

describe('#display()', () => {
  let serverless;
  let awsInfo;
  let consoleLogStub;

  beforeEach(() => {
    const options = {
      stage: 'dev',
      region: 'us-east-1',
    };
    serverless = new Serverless();
    serverless.serviceOutputs = new Map();
    serverless.setProvider('aws', new AwsProvider(serverless, options));
    serverless.cli = new CLI(serverless);
    serverless.service.service = 'my-service';
    awsInfo = new AwsInfo(serverless, options);
    awsInfo.gatheredData = {
      info: {
        service: 'my-first',
        stage: 'dev',
        region: 'eu-west-1',
        stack: 'my-first-dev',
        endpoints: [],
        functions: [],
        apiKeys: [],
        resourceCount: 10,
      },
    };
    consoleLogStub = sinon.stub(serverless.cli, 'consoleLog').returns();
  });

  afterEach(() => {
    serverless.cli.consoleLog.restore();
  });

  it('should display general service info', () => {
    let expectedMessage = '';

    expectedMessage += `${chalk.yellow.underline('Service Information')}\n`;
    expectedMessage += `${chalk.yellow('service:')} my-first\n`;
    expectedMessage += `${chalk.yellow('stage:')} dev\n`;
    expectedMessage += `${chalk.yellow('region:')} eu-west-1\n`;
    expectedMessage += `${chalk.yellow('stack:')} my-first-dev\n`;
    expectedMessage += `${chalk.yellow('resources:')} 10`;

    const message = awsInfo.displayServiceInfo();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should display a warning if 450+ resources', () => {
    let expectedMessage = '';

    expectedMessage += `${chalk.yellow.underline('Service Information')}\n`;
    expectedMessage += `${chalk.yellow('service:')} my-first\n`;
    expectedMessage += `${chalk.yellow('stage:')} dev\n`;
    expectedMessage += `${chalk.yellow('region:')} eu-west-1\n`;
    expectedMessage += `${chalk.yellow('stack:')} my-first-dev\n`;
    expectedMessage += `${chalk.yellow('resources:')} 450`;
    expectedMessage += `\n${chalk.red('WARNING:')}\n`;
    expectedMessage += '  You have 450 resources in your service.\n';
    expectedMessage += '  CloudFormation has a hard limit of 500 resources in a service.\n';
    expectedMessage +=
      '  For advice on avoiding this limit, check out this link: http://bit.ly/2IiYB38.';

    awsInfo.gatheredData.info.resourceCount = 450;

    const message = awsInfo.displayServiceInfo();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should display API keys if given', () => {
    awsInfo.gatheredData.info.apiKeys = [
      {
        name: 'keyOne',
        value: '1234',
        description: 'keyOne description',
      },
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('api keys:')}`;
    expectedMessage += '\n  keyOne: 1234 - keyOne description';

    const message = awsInfo.displayApiKeys();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);

    delete awsInfo.gatheredData.info.apiKeys;
    const missingMessage = awsInfo.displayApiKeys();
    expectedMessage = `${chalk.yellow('api keys:')}`;
    expectedMessage += '\n  None';
    expect(missingMessage).to.equal(expectedMessage);
  });

  it('should hide API keys values when `--conceal` is given', () => {
    awsInfo.options.conceal = true;
    awsInfo.gatheredData.info.apiKeys = [
      {
        name: 'keyOne',
        value: '1234',
        description: 'keyOne description',
      },
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('api keys:')}`;
    expectedMessage += '\n  keyOne - keyOne description';

    const message = awsInfo.displayApiKeys();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should display https endpoints if given', () => {
    awsInfo.serverless.service.functions = {
      function1: {
        events: [
          {
            http: {
              path: '/',
              method: 'POST',
            },
          },
          {
            http: {
              path: '/both/',
              method: 'POST',
            },
          },
          {
            http: {
              path: '/both/add/',
              method: 'POST',
            },
          },
          {
            http: {
              path: 'e',
              method: 'POST',
            },
          },
        ],
      },
      function2: {
        events: [
          {
            http: 'GET function1',
          },
        ],
      },
      function3: {
        events: [
          {
            s3: 'used-to-trigger-if',
          },
        ],
      },
    };

    awsInfo.gatheredData.info.endpoints = [
      'https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev',
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev';
    expectedMessage += '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev/both';
    expectedMessage +=
      '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev/both/add';
    expectedMessage += '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev/e';
    expectedMessage +=
      '\n  GET - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev/function1';

    const message = awsInfo.displayEndpoints();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should display wss endpoint if given', () => {
    awsInfo.gatheredData.info.endpoints = [
      'wss://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev',
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  wss://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev';

    const message = awsInfo.displayEndpoints();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should support a mix of https and wss endpoints', () => {
    awsInfo.serverless.service.functions = {
      function1: {
        events: [
          {
            http: {
              path: '/',
              method: 'POST',
            },
          },
          {
            http: {
              path: '/both/',
              method: 'POST',
            },
          },
        ],
      },
      function2: {
        events: [
          {
            websocket: '$connect',
          },
        ],
      },
    };

    awsInfo.gatheredData.info.endpoints = [
      'https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev',
      'wss://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev',
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev';
    expectedMessage += '\n  POST - https://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev/both';
    expectedMessage += '\n  wss://ab12cd34ef.execute-api.us-east-1.amazonaws.com/dev';

    const message = awsInfo.displayEndpoints();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);
  });

  it('should not display any endpoint info if none is given', () => {
    const missingMessage = awsInfo.displayEndpoints();

    let expectedMessage = '';

    expectedMessage = `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  None';
    expect(missingMessage).to.equal(expectedMessage);
  });

  it('should display cloudfront endpoint if given', () => {
    awsInfo.serverless.service.functions = {
      function1: {
        events: [
          {
            cloudfront: {},
          },
        ],
      },
    };

    awsInfo.gatheredData.info.cloudFront = 'a12bcdef3g45hi.cloudfront.net';

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  CloudFront - a12bcdef3g45hi.cloudfront.net';

    const message = awsInfo.displayEndpoints();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);

    delete awsInfo.gatheredData.info.cloudFront;
    const missingMessage = awsInfo.displayEndpoints();
    expectedMessage = `${chalk.yellow('endpoints:')}`;
    expectedMessage += '\n  None';
    expect(missingMessage).to.equal(expectedMessage);
  });

  it('should display functions if given', () => {
    awsInfo.gatheredData.info.functions = [
      {
        name: 'function1',
        deployedName: 'my-first-dev-function1',
      },
      {
        name: 'function2',
        deployedName: 'my-first-dev-function2',
      },
      {
        name: 'function3',
        deployedName: 'my-first-dev-function3',
      },
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow('functions:')}`;
    expectedMessage += '\n  function1: my-first-dev-function1';
    expectedMessage += '\n  function2: my-first-dev-function2';
    expectedMessage += '\n  function3: my-first-dev-function3';

    const message = awsInfo.displayFunctions();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);

    delete awsInfo.gatheredData.info.functions;
    const missingMessage = awsInfo.displayFunctions();
    expectedMessage = `${chalk.yellow('functions:')}`;
    expectedMessage += '\n  None';
    expect(missingMessage).to.equal(expectedMessage);
  });

  it('should display CloudFormation outputs when verbose output is requested', () => {
    awsInfo.options.verbose = true;

    awsInfo.gatheredData.outputs = [
      {
        Description: 'Lambda function info',
        OutputKey: 'Function1FunctionArn',
        OutputValue: 'arn:function1',
      },
      {
        Description: 'Lambda function info',
        OutputKey: 'Function2FunctionArn',
        OutputValue: 'arn:function2',
      },
    ];

    let expectedMessage = '';

    expectedMessage += `${chalk.yellow.underline('\nStack Outputs\n')}`;
    expectedMessage += `${chalk.yellow('Function1FunctionArn')}: ${'arn:function1'}\n`;
    expectedMessage += `${chalk.yellow('Function2FunctionArn')}: ${'arn:function2'}\n`;

    const message = awsInfo.displayStackOutputs();
    expect(consoleLogStub.calledOnce).to.equal(true);
    expect(message).to.equal(expectedMessage);

    awsInfo.options.verbose = false;
    const nonVerboseMessage = awsInfo.displayStackOutputs();
    expect(nonVerboseMessage).to.equal('');
  });
});

describe('test/unit/lib/plugins/aws/info/display.test.js', () => {
  let serverless;
  let serviceName;

  before(async () => {
    ({
      serverless,
      fixtureData: {
        serviceConfig: { service: serviceName },
      },
    } = await runServerless({
      fixture: 'apiGateway',
      command: 'info',
      awsRequestStubMap: {
        APIGateway: {
          getApiKey: {
            value: 'test-key-value',
            name: 'test-key-name',
          },
        },
        CloudFormation: {
          describeStacks: {
            Stacks: [
              {
                Outputs: [
                  {
                    OutputKey: 'ServiceEndpoint',
                    OutputValue: 'https://xxxxx.execute-api.us-east-1.amazonaws.com/dev',
                    Description: 'URL of the service endpoint',
                    ExportName: 'sls-test-api-gw',
                  },
                  {
                    OutputKey: 'ServerlessDeploymentBucketName',
                    OutputValue: 'test-api-gw-dev-serverlessdeploymentbucket-xxxxx',
                    ExportName: 'sls-test-api-gw-ServerlessDeploymentBucketName',
                  },
                  {
                    OutputKey: 'LayerLambdaLayerQualifiedArn',
                    OutputValue: 'arn:aws:lambda:us-east-1:00000000:layer:layer:1',
                  },
                ],
              },
            ],
          },
          describeStackResources: {
            StackResources: [
              {
                PhysicalResourceId: 'test',
                ResourceType: 'AWS::ApiGateway::ApiKey',
              },
            ],
          },
          listStackResources: {},
        },
      },
      configExt: {
        provider: {
          apiGateway: {
            apiKeys: [
              { name: 'full-key', value: 'full-key-asdf-asdf-asdf-adfafdadfadfadfadfafafdafadf' },
              'no-value-key',
              { value: 'no-name-key-asdf-asdf-asdf-adfafdadfadfadfadfafafdafadf' },
            ],
          },
        },
        layers: {
          layer: {
            path: 'layer',
          },
        },
      },
    }));
  });

  it('should register api gateway api keys section', () => {
    expect(serverless.serviceOutputs.get('api keys')).to.deep.equal([
      'test-key-name: test-key-value',
    ]);
  });

  it('should register endpoints section', () => {
    expect(serverless.serviceOutputs.get('endpoints')).to.deep.equal([
      'GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev',
      'POST - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/minimal-1',
      'GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/foo',
      'POST - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/some-post',
      'GET - https://xxxxx.execute-api.us-east-1.amazonaws.com/dev/bar/{marko}',
    ]);
  });
  it('should register functions section', () => {
    expect(serverless.serviceOutputs.get('functions')).to.deep.equal([
      `minimal: ${serviceName}-dev-minimal`,
      `foo: ${serviceName}-dev-foo`,
      `other: ${serviceName}-dev-other`,
    ]);
  });
  it('should register layers section', () => {
    expect(serverless.serviceOutputs.get('layers')).to.deep.equal([
      'layer: arn:aws:lambda:us-east-1:00000000:layer:layer:1',
    ]);
  });
});
