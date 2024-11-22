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

const fs = require('fs');
const util = require('../../util');

module.exports = {
    LexProxyLambdaLogGroup:{
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-LexProxyLambda' },
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
    LexProxyLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                ZipFile: fs.readFileSync(`${__dirname}/handler.js`, 'utf8'),
            },
            Environment: {
                Variables: {
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.handler',
            LoggingConfig: {
                LogGroup: { Ref: 'LexProxyLambdaLogGroup' },
            },
            MemorySize: '128',
            Role: { 'Fn::GetAtt': ['LexProxyLambdaRole', 'Arn'] },
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
            Layers: [
                { Ref: 'AwsSdkLayerLambdaLayer' },
                { Ref: 'CommonModulesLambdaLayer' },
            ],
            Tags: [{
                Key: 'Type',
                Value: 'Api',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    LexStatusLambdaLogGroup:{
        Type: 'AWS::Logs::LogGroup',
        Properties: {
            LogGroupName: {
                'Fn::Join': [
                    '-',
                    [
                        { 'Fn::Sub': '/aws/lambda/${AWS::StackName}-LexStatusLambda' },
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
    LexStatusLambda: {
        Type: 'AWS::Lambda::Function',
        Properties: {
            Code: {
                ZipFile: fs.readFileSync(`${__dirname}/status.js`, 'utf8'),
            },
            Environment: {
                Variables: {
                    STATUS_BUCKET: { Ref: 'BuildStatusBucket' },
                    LEXV2_STATUS_KEY: 'lexV2status.json',
                    FULFILLMENT_FUNCTION_ARN: {
                        'Fn::Join': [':', [
                            { 'Fn::GetAtt': ['FulfillmentLambda', 'Arn'] },
                            'live',
                        ]],
                    },
                    FULFILLMENT_FUNCTION_ROLE: { Ref: 'FulfillmentLambdaRole' },
                    LEXV2_BOT_NAME: { 'Fn::GetAtt': ['LexV2Bot', 'botName'] },
                    LEXV2_BOT_ID: { 'Fn::GetAtt': ['LexV2Bot', 'botId'] },
                    LEXV2_BOT_ALIAS: { 'Fn::GetAtt': ['LexV2Bot', 'botAlias'] },
                    LEXV2_BOT_ALIAS_ID: { 'Fn::GetAtt': ['LexV2Bot', 'botAliasId'] },
                    LEXV2_INTENT: { 'Fn::GetAtt': ['LexV2Bot', 'botIntent'] },
                    LEXV2_INTENT_FALLBACK: { 'Fn::GetAtt': ['LexV2Bot', 'botIntentFallback'] },
                    LEXV2_BOT_LOCALE_IDS: { 'Fn::GetAtt': ['LexV2Bot', 'botLocaleIds'] },
                    ...util.getCommonEnvironmentVariables(),
                },
            },
            Handler: 'index.handler',
            LoggingConfig: {
                LogGroup: { Ref: 'LexStatusLambdaLogGroup' },
            },
            MemorySize: '128',
            Role: { 'Fn::GetAtt': ['LexProxyLambdaRole', 'Arn'] },
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
            Layers: [
                { Ref: 'AwsSdkLayerLambdaLayer' },
            ],
            Tags: [{
                Key: 'Type',
                Value: 'Api',
            }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W92']),
            guard: util.cfnGuard('LAMBDA_CONCURRENCY_CHECK', 'LAMBDA_INSIDE_VPC'),
        },
    },
    LexProxyLambdaRole: {
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
                util.lexFullAccess(),
                util.xrayDaemonWriteAccess(),
                {
                    PolicyName: 'Access',
                    PolicyDocument: {
                        Version: '2012-10-17',
                        Statement: [{
                            Effect: 'Allow',
                            Action: [
                                's3:Get*',
                            ],
                            Resource: [{ 'Fn::Sub': 'arn:aws:s3:::${BuildStatusBucket}*' }],
                        }],
                    },
                }],
        },
        Metadata: {
            cfn_nag: util.cfnNag(['W11', 'W12', 'W76', 'F3']),
            guard: util.cfnGuard('IAM_NO_INLINE_POLICY_CHECK'),
        },
    },
};
