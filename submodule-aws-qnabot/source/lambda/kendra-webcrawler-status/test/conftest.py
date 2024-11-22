######################################################################################################################
#  Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.                                                #
#                                                                                                                    #
#  Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance    #
#  with the License. A copy of the License is located at                                                             #
#                                                                                                                    #
#      http://www.apache.org/licenses/LICENSE-2.0                                                                    #
#                                                                                                                    #
#  or in the 'license' file accompanying this file. This file is distributed on an 'AS IS' BASIS, WITHOUT WARRANTIES #
#  OR CONDITIONS OF ANY KIND, express or implied. See the License for the specific language governing permissions    #
#  and limitations under the License.                                                                                #
######################################################################################################################

import os
import pytest

@pytest.fixture(autouse=True)
def aws_environment_variables():
    """Mocked AWS evivronment variables such as AWS credentials and region"""
    os.environ["AWS_ACCESS_KEY_ID"] = "mocked-aws-access-key-id"
    os.environ["AWS_SECRET_ACCESS_KEY"] = "mocked-aws-secret-access-key"
    os.environ["AWS_SESSION_TOKEN"] = "mocked-aws-session-token"
    os.environ["AWS_REGION"] = "us-east-1"
    os.environ["AWS_DEFAULT_REGION"] = "us-east-1"
    os.environ["AWS_SDK_USER_AGENT"] = '{ "user_agent_extra": "solution/fakeID/fakeVersion" }'
    os.environ["DATASOURCE_NAME"] = "mock_data_source"
    os.environ["ROLE_ARN"] = "mock_role_arn"
    os.environ["DEFAULT_SETTINGS_PARAM"] = "test_default_setting_param"
    os.environ["PRIVATE_SETTINGS_PARAM"] = "test_private_setting_param"
    os.environ["CUSTOM_SETTINGS_PARAM"] = "test_custom_setting_param"
    os.environ["LAMBDA_TASK_ROOT"] = f"{os.path.dirname(os.path.realpath(__file__))}/.."
    os.environ["DASHBOARD_NAME"] = "test_dashboard"
    os.environ["SOLUTION_ID"] = "SO0189"
    os.environ["SOLUTION_VERSION"] = "mock_version"
