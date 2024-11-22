/*********************************************************************************************************************
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
 *********************************************************************************************************************/

const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const customSdkConfig = require('sdk-config/customSdkConfig');
const region = process.env.AWS_REGION;
const s3 = new S3Client(customSdkConfig('C011', { region }));

module.exports = async function(config){
    try {
        const parts =[];
        for (const part of config.parts){
            console.log(`getting part ${part.key}`);
            const params = {
                Bucket: config.bucket,
                Key: part.key,
                VersionId: config.version
            };
            const response = await s3.send(new GetObjectCommand(params));
            const readableStream = Buffer.concat(await response.Body.toArray());
            parts.push(readableStream);
        };
        const putParams = {
            Bucket:config.bucket,
            Key:config.key,
            Body:parts.join('\n')
        };
        await s3.send(new PutObjectCommand(putParams));
        config.status='Clean';
    } catch (error) {
        console.error("An error occurred while joining parts", error);
        throw error;
    }
}