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
const _ = require('lodash');

const files = [
    require('./bucket'),
    require('./resources'),
];

module.exports = {
    Resources: _.assign.apply({}, files),
    AWSTemplateFormatVersion: '2010-09-09',
    Description: `(SO0189n-export) QnABot nested export resources - Version v${process.env.npm_package_version}`,
    Outputs: require('./outputs'),
    Parameters: {
        ContentDesignerOutputBucket: { Type: 'String' },
        CFNLambda: { Type: 'String' },
        CFNInvokePolicy: { Type: 'String' },
        S3Clean: { Type: 'String' },
        BootstrapBucket: { Type: 'String' },
        BootstrapPrefix: { Type: 'String' },
        VarIndex: { Type: 'String' },
        EsEndpoint: { Type: 'String' },
        EsProxyLambda: { Type: 'String' },
        ExportBucket: { Type: 'String' },
        LexVersion: { Type: 'String' },
        // Lex V2
        LexV2BotName: { Type: 'String' },
        LexV2BotId: { Type: 'String' },
        LexV2BotAlias: { Type: 'String' },
        LexV2BotAliasId: { Type: 'String' },
        LexV2BotLocaleIds: { Type: 'String' },
        Api: { Type: 'String' },
        ApiRootResourceId: { Type: 'String' },
        Stage: { Type: 'String' },
        ApiDeploymentId: { Type: 'String' },
        DefaultQnABotSettings: { Type: 'String' },
        PrivateQnABotSettings: { Type: 'String' },
        CustomQnABotSettings: { Type: 'String' },
        KendraCrawlerSnsTopic: { Type: 'String' },
        VPCSubnetIdList: { Type: 'String' },
        VPCSecurityGroupIdList: { Type: 'String' },
        XraySetting: { Type: 'String' },
        AwsSdkLayerLambdaLayer: { Type: 'String' },
        QnABotCommonLambdaLayer: { Type: 'String' },
        KendraFaqIndexId: { Type: 'String' },
        KendraWebPageIndexId: { Type: 'String' },
        LogRetentionPeriod: { Type: 'Number' },
    },
    Conditions: {
        VPCEnabled: {
            'Fn::Not': [
                { 'Fn::Equals': ['', { Ref: 'VPCSecurityGroupIdList' }] },
            ],
        },
        XRAYEnabled: { 'Fn::Equals': [{ Ref: 'XraySetting' }, 'TRUE'] },
        CreateKendraSyncPolicy: { 'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'KendraFaqIndexId' }, ''] }] },
        CreateKendraCrawlerPolicy: { 'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'KendraWebPageIndexId' }, ''] }] },
        LogRetentionPeriodIsNotZero: { 'Fn::Not': [{ 'Fn::Equals': [{ Ref: 'LogRetentionPeriod' }, 0] }] }
    },
};
