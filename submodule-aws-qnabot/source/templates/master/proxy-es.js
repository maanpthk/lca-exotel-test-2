/** *******************************************************************************************************************
 *  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                *
 *                                                                                                                    *
 *  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    *
 *  with the License. A copy of the License is located at                                                             *
 *                                                                                                                    *
 *      http://www.apache.org/licenses/                                                                               *
 *                                                                                                                    *
 *  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES *
 *  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    *
 *  and limitations under the License.                                                                                *
 ******************************************************************************************************************** */

const _ = require('lodash');
const util = require('../util');

const examples = _.fromPairs(require('../examples/outputs')
    .names
    .map((x) => [x, { 'Fn::GetAtt': ['ExamplesStack', `Outputs.${x}`] }]));

module.exports = {
    ESProxyCodeVersion: {
        Type: 'Custom::S3Version',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            Bucket: { Ref: 'BootstrapBucket' },
            Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
            BuildDate: (new Date()).toISOString(),
        },
    },
    UtteranceLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-UtteranceLambda' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    UtteranceLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' }],
            Environment: {
                Variables: {
                    ES_INDEX: { 'Fn::GetAtt': ['Var', 'QnaIndex'] },
                    ES_ADDRESS: { 'Fn::Join': ['', ['https://', { 'Fn::GetAtt': ['ESVar', 'ESAddress'] }]] },
                    UTTERANCE_BUCKET: { Ref: 'AssetBucket' },
                    UTTERANCE_KEY: 'default-utterances.json',
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.utterances',
            LoggingConfig: {
                LogGroup: { Ref: 'UtteranceLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESProxyLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Service',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ESQidLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-ESQidLambda' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    ESQidLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' }],
            Environment: {
                Variables: {
                    ES_INDEX: { 'Fn::GetAtt': ['Var', 'QnaIndex'] },
                    ES_ADDRESS: { 'Fn::GetAtt': ['ESVar', 'ESAddress'] },
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.qid',
            LoggingConfig: {
                LogGroup: { Ref: 'ESQidLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESProxyLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Service',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ESCleaningLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-ESCleaningLambda' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    ESCleaningLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' }],
            Environment: {
                Variables: {
                    ES_INDEX: { 'Fn::GetAtt': ['Var', 'QnaIndex'] },
                    ES_ADDRESS: { 'Fn::GetAtt': ['ESVar', 'ESAddress'] },
                    FEEDBACK_DELETE_RANGE_MINUTES: { Ref: 'OpenSearchDashboardsRetentionMinutes' },
                    METRICS_DELETE_RANGE_MINUTES: { Ref: 'OpenSearchDashboardsRetentionMinutes' },
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.cleanmetrics',
            LoggingConfig: {
                LogGroup: { Ref: 'ESCleaningLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESProxyLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Service',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ScheduledESCleaning: {
        Type: 'AWS::Events::Rule',
        Properties: {
            Description: '',
            ScheduleExpression: 'rate(1 day)',
            State: 'ENABLED',
            Targets: [{
                Arn: { 'Fn::GetAtt': ['ESCleaningLambda', 'Arn'] },
                Id: 'ES_Cleaning_Function',
            }],
        },
    },
    PermissionForEventsToInvokeLambda: {
        Type: 'AWS::Lambda::Permission',
        Properties: {
            FunctionName: { Ref: 'ESCleaningLambda' },
            Action: 'lambda:InvokeFunction',
            Principal: 'events.amazonaws.com',
            SourceArn: { 'Fn::GetAtt': ['ScheduledESCleaning', 'Arn'] },
        },
    },
    ESLoggingLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-ESLoggingLambda' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    ESLoggingLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' },
            ],
            Environment: {
                Variables: {
                    FIREHOSE_NAME: { Ref: 'GeneralKinesisFirehose' },
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.logging',
            LoggingConfig: {
                LogGroup: { Ref: 'ESLoggingLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESLoggingLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Logging',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ESQueryLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-ESQueryLambda' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    ESQueryLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Environment: {
                Variables: {
                    DEFAULT_SETTINGS_PARAM: { Ref: 'DefaultQnABotSettings' },
                    PRIVATE_SETTINGS_PARAM: { Ref: 'PrivateQnABotSettings' },
                    CUSTOM_SETTINGS_PARAM: { Ref: 'CustomQnABotSettings' },
                    ...examples,
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' }],
            Handler: 'index.query',
            LoggingConfig: {
                LogGroup: { Ref: 'ESQueryLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESProxyLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Query',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ESProxyLambdaLogGroup: {
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-ESProxyLambdaLogGroup' },
                        { 'Fn::Select': ['2', { 'Fn::Split': ['/', { Ref: 'AWS::StackId' }] }] },
                    ],
                ],
            },
            RetentionInDays: {
                'Fn::If': [
                    'LogRetentionPeriodIsNotZero',
                    { Ref: 'LogRetentionPeriod' },
                    { Ref: 'AWS::NoValue' },
                ],
            },
        },
        Metadata: {
            guard: util.cfnGuard('CLOUDWATCH_LOG_GROUP_ENCRYPTED', 'CW_LOGGROUP_RETENTION_PERIOD_CHECK'),
        },
    },
    ESProxyLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                S3Bucket: { Ref: 'BootstrapBucket' },
                S3Key: { 'Fn::Sub': '${BootstrapPrefix}/lambda/proxy-es.zip' },
                S3ObjectVersion: { Ref: 'ESProxyCodeVersion' },
            },
            Layers: [{ Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
                { Ref: 'EsProxyLambdaLayer' },
                { Ref: 'QnABotCommonLambdaLayer' },
            ],
            Environment: {
                Variables: {
                    ES_TYPE: { 'Fn::GetAtt': ['Var', 'QnAType'] },
                    ES_INDEX: { 'Fn::GetAtt': ['Var', 'QnaIndex'] },
                    ES_ADDRESS: { 'Fn::GetAtt': ['ESVar', 'ESAddress'] },
                    DEFAULT_SETTINGS_PARAM: { Ref: 'DefaultQnABotSettings' },
                    PRIVATE_SETTINGS_PARAM: { Ref: 'PrivateQnABotSettings' },
                    CUSTOM_SETTINGS_PARAM: { Ref: 'CustomQnABotSettings' },
                    EMBEDDINGS_API: { Ref: 'EmbeddingsApi' },
                    EMBEDDINGS_SAGEMAKER_ENDPOINT: {
                        'Fn::If': [
                            'EmbeddingsSagemaker',
                            { 'Fn::GetAtt': ['SagemakerEmbeddingsStack', 'Outputs.EmbeddingsSagemakerEndpoint'] },
                            '',
                        ],
                    },
                    EMBEDDINGS_LAMBDA_ARN: { Ref: 'EmbeddingsLambdaArn' },
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.handler',
            LoggingConfig: {
                LogGroup: { Ref: 'ESProxyLambdaLogGroup' },
            },
            MemorySize: '1408',
            Role: { 'Fn::GetAtt': ['ESProxyLambdaRole', 'Arn'] },
            Runtime: process.env.npm_package_config_lambdaRuntime,
            Timeout: 300,
            VpcConfig: {
                'Fn::If': ['VPCEnabled', {
                    SubnetIds: { Ref: 'VPCSubnetIdList' },
                    SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
                }, { Ref: 'AWS::NoValue' }],
            },
            TracingConfig: {
                'Fn::If': ['XRAYEnabled', { Mode: 'Active' },
                    { Ref: 'AWS::NoValue' }],
            },
            Tags: [{
                Key: 'Type',
                Value: 'Service',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    ESProxyLambdaRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
            AssumeRolePolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com',
                        },
                        Action: 'sts:AssumeRole',
                    },
                ],
            },
            Path: '/',
            ManagedPolicyArns: [
                { Ref: 'QueryPolicy' },
            ],
            Policies: [
                util.basicLambdaExecutionPolicy(),
                util.lambdaVPCAccessExecutionRole(),
                util.xrayDaemonWriteAccess(),
                util.translateReadOnly(),
                util.lexFullAccess(),
                {
                    PolicyName: 'ParamStorePolicy',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: ['ssm:GetParameter', 'ssm:GetParameters'],
                            Resource: [
                                {
                                    'Fn::Join': [
                                        '', [
                                            'arn:',
                                            { 'Fn::Sub': '${AWS::Partition}:' },
                                            'ssm:',
                                            { 'Fn::Sub': '${AWS::Region}:' },
                                            { 'Fn::Sub': '${AWS::AccountId}:' },
                                            'parameter/',
                                            { Ref: 'DefaultQnABotSettings' },
                                        ],
                                    ],
                                },
                                {
                                    'Fn::Join': [
                                        '', [
                                            'arn:',
                                            { 'Fn::Sub': '${AWS::Partition}:' },
                                            'ssm:',
                                            { 'Fn::Sub': '${AWS::Region}:' },
                                            { 'Fn::Sub': '${AWS::AccountId}:' },
                                            'parameter/',
                                            { Ref: 'PrivateQnABotSettings' },
                                        ],
                                    ],
                                },
                                {
                                    'Fn::Join': [
                                        '', [
                                            'arn:',
                                            { 'Fn::Sub': '${AWS::Partition}:' },
                                            'ssm:',
                                            { 'Fn::Sub': '${AWS::Region}:' },
                                            { 'Fn::Sub': '${AWS::AccountId}:' },
                                            'parameter/',
                                            { Ref: 'CustomQnABotSettings' },
                                        ],
                                    ],
                                },
                                {
                                    'Fn::Join': [
                                        '', [
                                            'arn:',
                                            { 'Fn::Sub': '${AWS::Partition}:' },
                                            'ssm:',
                                            { 'Fn::Sub': '${AWS::Region}:' },
                                            { 'Fn::Sub': '${AWS::AccountId}:' },
                                            'parameter/',
                                            { Ref: 'DefaultUserPoolJwksUrl' },
                                        ],
                                    ],
                                },
                            ],
                        }],
                    },
                },
                {
                    'Fn::If': [
                        'EmbeddingsEnable',
                        {
                            PolicyName: 'EmbeddingsPolicy',
                            PolicyDocument: {
                                Version: '2012-10-17',
                                Statement: [
                                    {
                                        'Fn::If': [
                                            'EmbeddingsSagemaker',
                                            {
                                                Effect: 'Allow',
                                                Action: [
                                                    'sagemaker:InvokeEndpoint',
                                                ],
                                                Resource: { 'Fn::GetAtt': ['SagemakerEmbeddingsStack', 'Outputs.EmbeddingsSagemakerEndpointArn'] },
                                            },
                                            { Ref: 'AWS::NoValue' },
                                        ],
                                    },
                                    {
                                        'Fn::If': [
                                            'EmbeddingsLambdaArn',
                                            {
                                                Effect: 'Allow',
                                                Action: [
                                                    'lambda:InvokeFunction',
                                                ],
                                                Resource: [{ Ref: 'EmbeddingsLambdaArn' }],
                                            },
                                            { Ref: 'AWS::NoValue' },
                                        ],
                                    },
                                    {
                                        'Fn::If': [
                                            'EmbeddingsBedrock',
                                            {
                                                Effect: 'Allow',
                                                Action: [
                                                    'bedrock:InvokeModel',
                                                ],
                                                Resource: [
                                                    { 'Fn::If': ['EmbeddingsBedrock', { 'Fn::Sub': ['arn:${AWS::Partition}:bedrock:${AWS::Region}::foundation-model/${ModelId}', {'ModelId': { 'Fn::FindInMap': ['BedrockDefaults', {'Ref' : 'EmbeddingsBedrockModelId'}, 'ModelID'] }}] }, { Ref: 'AWS::NoValue' }] },
                                                ],
                                            },
                                            { Ref: 'AWS::NoValue' },
                                        ],
                                    },
                                ],
                            },
                        },
                        { Ref: 'AWS::NoValue' },
                    ],
                },
                {
                    PolicyName: 'S3QNABucketReadAccess',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Action: [
                                    's3:GetObject',
                                ],
                                Resource: [
                                    'arn:aws:s3:::QNA*/*',
                                    'arn:aws:s3:::qna*/*',
                                ],
                            },
                        ],
                    },
                },
            ],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W11', 'W12', 'W76', 'F3']),
            guard: util.cfnGuard('IAM_NO_INLINE_POLICY_CHECK'),
        },
    },
    QueryLambdaInvokePolicy: {
        Type: 'AWS::IAM::ManagedPolicy',
        Properties: {
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [{
                    Effect: 'Allow',
                    Action: ['lambda:InvokeFunction'],
                    Resource: [
                        'arn:aws:lambda:*:*:function:qna*',
                        'arn:aws:lambda:*:*:function:QNA*',
                    ].concat(require('../examples/outputs').names
                        .map((x) => ({ 'Fn::GetAtt': ['ExamplesStack', `Outputs.${x}`] }))),
                }],
            },
            Roles: [{ Ref: 'ESProxyLambdaRole' }],
        },
    },
    ESLoggingLambdaRole: {
        Type: 'AWS::IAM::Role',
        Properties: {
            AssumeRolePolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Principal: {
                            Service: 'lambda.amazonaws.com',
                        },
                        Action: 'sts:AssumeRole',
                    },
                ],
            },
            Path: '/',
            Policies: [
                util.basicLambdaExecutionPolicy(),
                util.lambdaVPCAccessExecutionRole(),
                util.xrayDaemonWriteAccess(),
                {
                    PolicyName: 'LambdaGeneralKinesisFirehoseQNALambda',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [
                            {
                                Effect: 'Allow',
                                Action: [
                                    'lambda:InvokeFunction',
                                ],
                                Resource: [
                                    { 'Fn::Join': ['', ['arn:aws:lambda:', { Ref: 'AWS::Region' }, ':', { Ref: 'AWS::AccountId' }, ':function:qna-*']] },
                                    { 'Fn::Join': ['', ['arn:aws:lambda:', { Ref: 'AWS::Region' }, ':', { Ref: 'AWS::AccountId' }, ':function:QNA-*']] },
                                ],
                            },
                            {
                                Effect: 'Allow',
                                Action: [
                                    'comprehend:DetectPiiEntities',
                                ],
                                Resource: [
                                    '*',
                                ],
                            },
                            {
                                Effect: 'Allow',
                                Action: [
                                    'firehose:PutRecord',
                                    'firehose:PutRecordBatch',
                                ],
                                Resource: [
                                    { 'Fn::GetAtt': ['GeneralKinesisFirehose', 'Arn'] },
                                ],
                            },
                        ],
                    },
                }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W11', 'W12']),
            guard: util.cfnGuard('IAM_NO_INLINE_POLICY_CHECK'),
        },
    },
    QueryPolicy: {
        Type: 'AWS::IAM::ManagedPolicy',
        Properties: {
            PolicyDocument: {
                Version: '2012-10-17',
                Statement: [
                    {
                        Effect: 'Allow',
                        Action: [
                            'es:*',
                        ],
                        Resource: ['*'], // these actions cannot be bound to resources other than *
                    }, {
                        Effect: 'Allow',
                        Action: [
                            'kendra:Query',
                            'kendra:Retrieve',
                        ],
                        Resource: [
                            { 'Fn::Sub': 'arn:aws:kendra:${AWS::Region}:${AWS::AccountId}:index/*' },
                        ],
                    }, {
                        Effect: 'Allow',
                        Action: ['s3:Get*'],
                        Resource: [
                            { 'Fn::Sub': 'arn:aws:s3:::${AssetBucket}*' },
                        ],
                    },
                    {
                        Effect: 'Allow',
                        Action: ['comprehend:DetectSyntax'],
                        Resource: ['*'], // these actions cannot be bound to resources other than *
                    },
                ],
            },
        },
        Metadata: { cfn_nag: util.cfnNag(['F5', 'W13']) },
    },
};
