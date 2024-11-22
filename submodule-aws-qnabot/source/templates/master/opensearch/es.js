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

const util = require('../../util');

const properties = {
  CognitoOptions: {
    Enabled: true,
    IdentityPoolId: { Ref: 'OpenSearchDashboardsIdPool' },
    RoleArn: { 'Fn::GetAtt': ['ESCognitoRole', 'Arn'] },
    UserPoolId: { Ref: 'UserPool' },
  },
  ClusterConfig: {
    DedicatedMasterEnabled: false,
    InstanceCount: { Ref: 'OpenSearchNodeCount' },
    InstanceType: { Ref: 'OpenSearchInstanceType' },
    ZoneAwarenessEnabled: { 'Fn::If': ['SingleNode', false, true] },
  },
  EBSOptions: {
    EBSEnabled: true,
    VolumeSize: { Ref: 'OpenSearchEBSVolumeSize' },
    VolumeType: 'gp2',
  },
  EngineVersion: 'OpenSearch_2.11',
  SnapshotOptions: {
    AutomatedSnapshotStartHour: '0',
  },
  AdvancedOptions: {
    'rest.action.multi.allow_explicit_index': 'true',
  },
  EncryptionAtRestOptions: {
    Enabled: true,
  },
  NodeToNodeEncryptionOptions: {
    Enabled: true,
  },
  DomainEndpointOptions: {
    EnforceHTTPS: true,
    TLSSecurityPolicy: 'Policy-Min-TLS-1-2-2019-07',
  },
  VPCOptions: {
    'Fn::If': ['VPCEnabled', {
      SubnetIds: { Ref: 'VPCSubnetIdList' },
      SecurityGroupIds: { Ref: 'VPCSecurityGroupIdList' },
    }, { Ref: 'AWS::NoValue' }],
  },
};

module.exports = {
  OpensearchDomain: {
    Type: 'AWS::OpenSearchService::Domain',
    DependsOn: ['PreUpgradeExport', 'ESCognitoRole'],
    Condition: 'CreateDomain',
    UpdatePolicy: {
      EnableVersionUpgrade: true
    },
    Metadata: {
      checkov: {
        skip: [
          {
            id: 'CKV_AWS_84',
            comment: 'Logging is enabled via custom resource - see source/templates/master/opensearch/updates.js',
          },
          {
            id: 'CKV_AWS_317',
            comment: 'Logging is enabled via custom resource - see source/templates/master/opensearch/updates.js',
          }
        ]
      },
    },
    Properties: properties,
  },
  ESCognitoRole: {
    Type: 'AWS::IAM::Role',
    Properties: {
      AssumeRolePolicyDocument: {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: {
              Service: 'opensearchservice.amazonaws.com',
            },
            Action: 'sts:AssumeRole',
          },
        ],
      },
      Path: '/',
      Policies: [
        util.esCognitoAccess(),
      ],
    },
    Metadata: {
      cfn_nag: util.cfnNag(['W11', 'W12', 'F38']),
      guard: util.cfnGuard('IAM_NO_INLINE_POLICY_CHECK'),
    },
  },
};
