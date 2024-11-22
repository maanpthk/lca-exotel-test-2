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

require("aws-sdk-client-mock-jest");
const { EventEmitter } = require('events');
const httpsMock = require('https');
const Stream = require('stream');
const { S3Client, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { mockClient } = require('aws-sdk-client-mock');
const s3ClientMock = mockClient(S3Client);
const { handler } = require('../handler');
const { event, endMock, writeMock, doneMock } = require('./handler.fixtures');

jest.mock('https', () => ({
    methodToMock: {},
}));

const context = {
    logStreamName: 'mock log stream name',
    done: doneMock,
};

const emitter = new EventEmitter();
emitter.write = writeMock;
emitter.end = endMock;

describe('bootstrap handler', () => {
    beforeEach(() => {
        jest.resetModules();
        endMock.mockRestore();
        doneMock.mockRestore();
        writeMock.mockRestore();
        s3ClientMock.reset();
    });

    it('should send a put request to the provided url', async () => {
        const message = new Stream();

        s3ClientMock.on(HeadObjectCommand)
            .resolvesOnce({
                VersionId: 4,
            });

        httpsMock.request = jest.fn().mockImplementation((options, cb) => {
            cb(message);

            expect(options.hostname).toEqual('localhost');
            expect(options.method).toEqual('PUT');
            expect(options.port).toEqual(443);
            message.emit('end');
            return emitter;
        });

        await handler(event, context);
        expect(s3ClientMock).toHaveReceivedCommandWith(HeadObjectCommand, { Bucket: "test-bucket", Key: 'test-key' });
        expect(writeMock).toHaveBeenCalledWith("{\"Status\":\"SUCCESS\",\"Reason\":\"See the details in CloudWatch Log Stream: mock log stream name\",\"PhysicalResourceId\":\"mock log stream name\",\"NoEcho\":false,\"Data\":{\"version\":4}}");
        expect(endMock).toHaveBeenCalled();
        expect(doneMock).toHaveBeenCalled();
    });

    it('should set version id to 1 if falsy', async () => {
        const message = new Stream();

        s3ClientMock.on(HeadObjectCommand)
            .resolvesOnce({});

        httpsMock.request = jest.fn().mockImplementation((options, cb) => {
            cb(message);

            expect(options.hostname).toEqual('localhost');
            expect(options.method).toEqual('PUT');
            expect(options.port).toEqual(443);
            message.emit('end');
            return emitter;
        });

        await handler(event, context);
        expect(s3ClientMock).toHaveReceivedCommandWith(HeadObjectCommand, { Bucket: "test-bucket", Key: 'test-key' });
        expect(writeMock).toHaveBeenCalledWith("{\"Status\":\"SUCCESS\",\"Reason\":\"See the details in CloudWatch Log Stream: mock log stream name\",\"PhysicalResourceId\":\"mock log stream name\",\"NoEcho\":false,\"Data\":{\"version\":1}}");
        expect(endMock).toHaveBeenCalled();
        expect(doneMock).toHaveBeenCalled();
    });

    it('should close context on error', async () => {
        const message = new Stream();

        httpsMock.request = jest.fn().mockImplementation((options, cb) => {
            cb(message);

            expect(options.hostname).toEqual('localhost');
            expect(options.method).toEqual('PUT');
            expect(options.port).toEqual(443);
            message.emit('end');
            return emitter;
        });

        await handler(event, context);
        emitter.emit('error', 'error message');
        expect(writeMock).toHaveBeenCalled();
        expect(endMock).toHaveBeenCalled();
        expect(doneMock).toHaveBeenCalled();
    });

    it('should respond to delete requests', async () => {
        const message = new Stream();
        const clonedEvent = JSON.parse(JSON.stringify(event));
        clonedEvent.RequestType = 'Delete';

        httpsMock.request = jest.fn().mockImplementation((options, cb) => {
            cb(message);

            expect(options.hostname).toEqual('localhost');
            expect(options.method).toEqual('PUT');
            expect(options.port).toEqual(443);
            message.emit('end');
            return emitter;
        });

        await handler(clonedEvent, context);
        emitter.emit('end', 'end');
        expect(writeMock).toHaveBeenCalled();
        expect(endMock).toHaveBeenCalled();
        expect(doneMock).toHaveBeenCalled();
    });
});
