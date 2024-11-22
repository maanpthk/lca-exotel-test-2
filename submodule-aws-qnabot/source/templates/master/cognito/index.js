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
    CognitoDomain: {
        Type: 'Custom::CognitoDomain',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            UserPool: { Ref: 'UserPool' },
        },
    },
    CognitoLoginClient: {
        Type: 'Custom::CognitoLogin',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            UserPool: { Ref: 'UserPool' },
            ClientId: { Ref: 'ClientClient' },
            LoginCallbackUrls: [
                { 'Fn::GetAtt': ['Urls', 'Client'] },
            ],
            CSS: require('./style').client,
        },
    },
    CognitoLoginDesigner: {
        Type: 'Custom::CognitoLogin',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            UserPool: { Ref: 'UserPool' },
            ClientId: { Ref: 'ClientDesigner' },
            LoginCallbackUrls: [
                { 'Fn::GetAtt': ['Urls', 'Designer'] },
            ],
            LogoutCallbackUrls: [
                { 'Fn::GetAtt': ['Urls', 'Designer'] },
            ],
            CSS: require('./style').designer,
        },
    },
    DesignerLogin: {
        Type: 'Custom::CognitoUrl',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            adad: 'adaad',
            ClientId: { Ref: 'ClientDesigner' },
            Domain: { Ref: 'CognitoDomain' },
            LoginRedirectUrl: { 'Fn::GetAtt': ['Urls', 'Designer'] },
            response_type: 'code',
        },
    },
    ClientLogin: {
        Type: 'Custom::CognitoUrl',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            ClientId: { Ref: 'ClientClient' },
            Domain: { Ref: 'CognitoDomain' },
            LoginRedirectUrl: { 'Fn::GetAtt': ['Urls', 'Client'] },
            response_type: 'code',
        },
    },
    User: {
        Type: 'AWS::Cognito::UserPoolUser',
        DependsOn: ['SignupPermision', 'MessagePermision', 'OpenSearchDashboardsRoleAttachment', 'RoleAttachment'],
        Properties: {
            DesiredDeliveryMediums: ['EMAIL'],
            UserAttributes: [
                {
                    Name: 'email',
                    Value: { Ref: 'Email' },
                },
            ],
            Username: { Ref: 'Username' },
            UserPoolId: { Ref: 'UserPool' },
        },
    },
    UserToGroup: {
        Type: 'AWS::Cognito::UserPoolUserToGroupAttachment',
        Properties: {
            GroupName: { Ref: 'Admins' },
            Username: { Ref: 'User' },
            UserPoolId: { Ref: 'UserPool' },
        },
    },
    IdPool: {
        Type: 'AWS::Cognito::IdentityPool',
        Properties: {
            IdentityPoolName: { 'Fn::Join': ['-', ['QnaBotIdPool', { Ref: 'AWS::StackName' }]] },
            AllowUnauthenticatedIdentities: true,
            CognitoIdentityProviders: [{
                ClientId: { Ref: 'ClientDesigner' },
                ProviderName: { 'Fn::GetAtt': ['UserPool', 'ProviderName'] },
                ServerSideTokenCheck: true,
            }, {
                ClientId: { Ref: 'ClientClient' },
                ProviderName: { 'Fn::GetAtt': ['UserPool', 'ProviderName'] },
                ServerSideTokenCheck: true,
            },
            ],
        },
        Metadata: { cfn_nag: util.cfnNag(['W57']) },
    },
    OpenSearchDashboardsIdPool: {
        Type: 'AWS::Cognito::IdentityPool',
        Properties: {
            IdentityPoolName: { 'Fn::Join': ['-', ['OpenSearchDashboardsIdPool', { Ref: 'AWS::StackName' }]] },
            AllowUnauthenticatedIdentities: false,
        },
    },
    OpenSearchDashboardsRoleAttachment: {
        Type: 'Custom::CognitoRole',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            IdentityPoolId: { Ref: 'OpenSearchDashboardsIdPool' },
            DomainName: { 'Fn::GetAtt': ['ESVar', 'ESDomain'] },
            Roles: {
                authenticated: { 'Fn::GetAtt': ['UserRole', 'Arn'] },
                unauthenticated: { 'Fn::GetAtt': ['UnauthenticatedRole', 'Arn'] },
            },
            RoleMappings: [{
                ClientId: { 'Fn::GetAtt': ['OpenSearchDashboardsClient', 'ClientId'] },
                UserPool: { Ref: 'UserPool' },
                Type: 'Rules',
                AmbiguousRoleResolution: 'Deny',
                RulesConfiguration: {
                    Rules: [{
                        Claim: 'cognito:groups',
                        MatchType: 'Contains',
                        Value: 'Admin',
                        RoleARN: { 'Fn::GetAtt': ['OpenSearchDashboardsRole', 'Arn'] },
                    }],
                },
            }],
        },
    },
    RoleAttachment: {
        Type: 'Custom::CognitoRole',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            IdentityPoolId: { Ref: 'IdPool' },
            Roles: {
                authenticated: { 'Fn::GetAtt': ['UserRole', 'Arn'] },
                unauthenticated: { 'Fn::GetAtt': ['UnauthenticatedRole', 'Arn'] },
            },
            RoleMappings: [{
                ClientId: { Ref: 'ClientClient' },
                UserPool: { Ref: 'UserPool' },
                Type: 'Rules',
                AmbiguousRoleResolution: 'AuthenticatedRole',
                RulesConfiguration: {
                    Rules: [{
                        Claim: 'cognito:groups',
                        MatchType: 'Contains',
                        Value: 'Admin',
                        RoleARN: { 'Fn::GetAtt': ['UserRole', 'Arn'] },
                    }],
                },
            }, {
                ClientId: { Ref: 'ClientDesigner' },
                UserPool: { Ref: 'UserPool' },
                Type: 'Rules',
                AmbiguousRoleResolution: 'Deny',
                RulesConfiguration: {
                    Rules: [{
                        Claim: 'cognito:groups',
                        MatchType: 'Contains',
                        Value: 'Admin',
                        RoleARN: { 'Fn::GetAtt': ['AdminRole', 'Arn'] },
                    }],
                },
            }],
        },
    },
    UserPool: {
        Type: 'AWS::Cognito::UserPool',
        Properties: {
            UserPoolName: { 'Fn::Join': ['-', ['UserPool', { Ref: 'AWS::StackName' }]] },
            AdminCreateUserConfig: {
                AllowAdminCreateUserOnly: { 'Fn::If': ['AdminSignUp', true, false] },
                InviteMessageTemplate: {
                    EmailMessage: { 'Fn::Sub': fs.readFileSync(`${__dirname}/invite.txt`, 'utf8') },
                    EmailSubject: 'Welcome to QnABot!',
                },
            },
            AliasAttributes: ['email'],
            AutoVerifiedAttributes: ['email'],
            Schema: [{
                Required: true,
                Name: 'email',
                AttributeDataType: 'String',
                Mutable: true,
            }],
            LambdaConfig: {
                CustomMessage: { 'Fn::GetAtt': ['MessageLambda', 'Arn'] },
                PreSignUp: { 'Fn::GetAtt': ['SignupLambda', 'Arn'] },
            },
        },
    },
    OpenSearchDashboardsClient: {
        Type: 'Custom::ESCognitoClient',
        Properties: {
            ServiceToken: { 'Fn::GetAtt': ['CFNLambda', 'Arn'] },
            UserPool: { Ref: 'UserPool' },
            DomainName: { 'Fn::GetAtt': ['ESVar', 'ESDomain'] },
        },
    },
    ClientDesigner: {
        Type: 'AWS::Cognito::UserPoolClient',
        Properties: {
            ClientName: {
                'Fn::Join': ['-', [
                    'UserPool',
                    { Ref: 'AWS::StackName' },
                    'designer',
                ]],
            },
            GenerateSecret: false,
            UserPoolId: { Ref: 'UserPool' },
        },
    },
    ClientClient: {
        Type: 'AWS::Cognito::UserPoolClient',
        Properties: {
            ClientName: {
                'Fn::Join': ['-', [
                    'UserPool',
                    { Ref: 'AWS::StackName' },
                    'client',
                ]],
            },
            GenerateSecret: false,
            UserPoolId: { Ref: 'UserPool' },
        },
    },
    Users: {
        Type: 'AWS::Cognito::UserPoolGroup',
        Properties: {
            GroupName: 'Users',
            UserPoolId: { Ref: 'UserPool' },
        },
    },
    Admins: {
        Type: 'AWS::Cognito::UserPoolGroup',
        Properties: {
            GroupName: 'Admins',
            UserPoolId: { Ref: 'UserPool' },
        },
    },
};
