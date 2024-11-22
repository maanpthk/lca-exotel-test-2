// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import fastify from 'fastify';
import websocket from '@fastify/websocket';
import WebSocket from 'ws'; // type structure for the websocket object used by fastify/websocket
import BlockStream from 'block-stream2';
import os from 'os';
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import {
    MediaStreamConnectedMessage,
    MediaStreamMediaMessage,
    MediaStreamStartMessage,
    MediaStreamStopMessage,
    MediaStreamMessage,
    isConnectedEvent,
    isStartEvent,
    isStopEvent,
    isMediaEvent,
} from './mediastream';

import {  
    CallMetaData, 
    startTranscribe, 
    writeCallStartEvent,
    writeCallEndEvent,
    SocketCallData,
    writeCallRecordingEvent,
} from './calleventdata';

import {
    ulawToL16,
    // msToBytes,
    createWavHeader,
    getClientIP,
    posixifyFilename,
    normalizeErrorForLogging,
} from './utils';
import { PassThrough } from 'stream';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const interleave = require('interleave-stream');

const AWS_REGION = process.env['AWS_REGION'] || 'us-east-1';
const RECORDINGS_BUCKET_NAME = process.env['RECORDINGS_BUCKET_NAME'] || undefined;
const RECORDING_FILE_PREFIX = process.env['RECORDING_FILE_PREFIX'] || 'lca-audio-wav/';
const CPU_HEALTH_THRESHOLD = parseInt(process.env['CPU_HEALTH_THRESHOLD'] || '60', 10);
const LOCAL_TEMP_DIR = process.env['LOCAL_TEMP_DIR'] || '/tmp/';
const WS_LOG_LEVEL = process.env['WS_LOG_LEVEL'] || 'debug';
const WS_LOG_INTERVAL = parseInt(process.env['WS_LOG_INTERVAL'] || '120', 10);
const SHOULD_RECORD_CALL = process.env['SHOULD_RECORD_CALL'] || 'false';
const TALKDESK_ACCOUNT_ID = process.env['TALKDESK_ACCOUNT_ID'] || '';

// Add new constants for Exotel
const EXOTEL_ACCOUNT_ID = process.env['TALKDESK_ACCOUNT_ID'] || ''; //same field for now
const SOURCE_PLATFORM = 'EXOTEL';
// Source specific audio parameters
// const CHUNK_SIZE_IN_MS = parseInt(process.env['CHUNK_SIZE_IN_MS'] || '20', 10);
const SAMPLE_RATE = parseInt(process.env['SAMPLE_RATE'] || '8000', 10);
// const MULAW_BYTES_PER_SAMPLE = parseInt(process.env['MULAW_BYTES_PER_SAMPLE'] || '4', 10);

const s3Client = new S3Client({ region: AWS_REGION });

// global variable to maintain state for active connections
const socketMap = new Map<WebSocket, SocketCallData>();



// create fastify server (with logging enabled for non-PROD environments)
const server = fastify({
    logger: {
        level: WS_LOG_LEVEL,
        prettyPrint: {
            ignore: 'pid,hostname',
            translateTime: 'SYS:HH:MM:ss.l',
            colorize: false,
            levelFirst: true,
        },
    },
    disableRequestLogging: true,
});
// register the @fastify/websocket plugin with the fastify server
server.register(websocket);

// Setup preHandler hook to authenticate 
server.addHook('preHandler', async (request, ) => {
    if (!request.url.includes('health')) { 
        const clientIP = getClientIP(request.headers);
        server.log.debug(`[AUTH]: [${clientIP}] - Received preHandler hook for authentication. URI: <${request.url}>, Headers: ${JSON.stringify(request.headers)}`);
        server.log.debug('[AUTH]: Authentication TO BE IMPLEMENTED');
    }
});

// Setup Route for websocket connection
server.get('/api/v1/ws', { websocket: true, logLevel: 'debug' }, (connection, request) => {
    const clientIP = getClientIP(request.headers);
    server.log.debug(`[NEW CONNECTION]: [${clientIP}] - Received new connection request @ /api/v1/ws. URI: <${request.url}>, Headers: ${JSON.stringify(request.headers)}`);

    registerHandlers(clientIP, connection.socket); // setup the handler functions for websocket events
});

type HealthCheckRemoteInfo = {
    addr: string;
    tsFirst: number;
    tsLast: number;
    count: number;
};
const healthCheckStats = new Map<string, HealthCheckRemoteInfo>();

// Setup Route for health check 
server.get('/health/check', { logLevel: 'warn' }, (request, response) => {
    const now = Date.now();

    const cpuUsage = os.loadavg()[0] / os.cpus().length * 100;
    const isHealthy = cpuUsage > CPU_HEALTH_THRESHOLD ? false : true;
    const status = isHealthy ? 200 : 503;

    const remoteIp = request.socket.remoteAddress || 'unknown';
    const item = healthCheckStats.get(remoteIp);
    if (!item) {
        server.log.debug(`[HEALTH CHECK]: [${remoteIp}] - Received First health check from load balancer. URI: <${request.url}>, Headers: ${JSON.stringify(request.headers)} ==> Health Check status - CPU Usage%: ${cpuUsage}, IsHealthy: ${isHealthy}, Status: ${status}`);
        healthCheckStats.set(remoteIp, { addr: remoteIp, tsFirst: now, tsLast: now, count: 1 });
    } else {
        item.tsLast = now;
        ++item.count;
        const elapsed_seconds = Math.round((item.tsLast - item.tsFirst) / 1000);
        if ((elapsed_seconds % WS_LOG_INTERVAL) == 0) {
            server.log.debug(`[HEALTH CHECK]: [${remoteIp}] - Received Health check # ${item.count} from load balancer. URI: <${request.url}>, Headers: ${JSON.stringify(request.headers)} ==> Health Check status - CPU Usage%: ${cpuUsage}, IsHealthy: ${isHealthy}, Status: ${status}`);
        }
    }

    response
        .code(status)
        .header('Cache-Control', 'max-age=0, no-cache, no-store, must-revalidate, proxy-revalidate')
        .send({ 'Http-Status': status, 'Healthy': isHealthy });
});

// Setup handlers for websocket events - 'message', 'close', 'error'
const registerHandlers = (clientIP: string, ws: WebSocket): void => {

    ws.on('message', async (data): Promise<void> => {        
        try {
            const message: MediaStreamMessage = JSON.parse(Buffer.from(data as Uint8Array).toString('utf8'));

            if (typeof (message.event) === 'undefined') {
                server.log.error(`[ON MESSAGE]: [${clientIP}] - Undefined Event Type in the event message received from Talkdesk. Ignoring the event. ${JSON.stringify(message)}`);
            } else {
                if (isConnectedEvent(message.event)) {
                    await onConnected(clientIP, ws, message as MediaStreamConnectedMessage);
                } else if (isStartEvent(message.event)) {
                    await onStart(clientIP, ws, message as MediaStreamStartMessage);
                } else if (isMediaEvent(message.event)) {
                    await onMedia(clientIP, ws, message as MediaStreamMediaMessage);
                } else if (isStopEvent(message.event)) {
                    await onStop(clientIP, ws, message as MediaStreamStopMessage);
                } else {
                    server.log.error(`[ON MESSAGE]: [${clientIP}] - Invalid Event Type Event Type in the event message received from Talkdesk. Ignoring the event. ${JSON.stringify(message)}`);
                }
            }
        } catch (error) {
            server.log.error(`[ON MESSAGE]: [${clientIP}] - Error parsing event message from Talkdesk. Possible syntax error in the json payload.: ${normalizeErrorForLogging(error)}`);
        }
    });

    ws.on('close', async (code: number) => {
        try {
            await onWsClose(clientIP, ws, code);
        } catch (err) {
            server.log.error(`[ON WSCLOSE]: [${clientIP}] Error in WS close handler: ${normalizeErrorForLogging(err)}`);
        }
    });

    ws.on('error', (error: Error) => {
        server.log.error(`[ON WSERROR]: [${clientIP}] - Websocket error, forcing close: ${normalizeErrorForLogging(error)}`);
        ws.close();
    });
};

const onConnected = async (clientIP: string, ws: WebSocket, data: MediaStreamConnectedMessage): Promise<void> => {
    server.log.info(`[ON CONNECTED]: [${clientIP}] - Client connected: ${JSON.stringify(data)}`);
};

// Modify onStart function to handle Exotel account validation
const onStart = async (clientIP: string, ws: WebSocket, data: MediaStreamStartMessage): Promise<void> => {
    server.log.info(`[ON START]: [${clientIP}][${data.start.callSid}] - Received Start event`);
    
    if (SOURCE_PLATFORM === 'EXOTEL') {
        if (data.start.accountSid !== EXOTEL_ACCOUNT_ID) {
            server.log.error(`[ON START]: Invalid Exotel Account ID`);
            ws.close(401);
            return;
        }
    } else if (data.start.accountSid !== TALKDESK_ACCOUNT_ID) {
        server.log.error(`[ON START]: Invalid Talkdesk Account ID`);
        ws.close(401);
        return;
    }

    // Rest of the original onStart implementation...
    const callMetaData: CallMetaData = {
        callEvent: 'START',
        callId: data.start.callSid,
        fromNumber: data.start.from || 'Customer Phone',
        toNumber: data.start.to || 'System Phone',
        shouldRecordCall: SHOULD_RECORD_CALL === 'true',
        samplingRate: 8000,
        agentId: randomUUID(),
    };


    const tempRecordingFilename = getTempRecordingFileName(callMetaData);
    const writeRecordingStream = fs.createWriteStream(path.join(LOCAL_TEMP_DIR, tempRecordingFilename));
    const recordingFileSize = { filesize: 0 };
    const highWaterMarkSize = (callMetaData.samplingRate / 10) * 2 * 2;
    const audioInputStream = new PassThrough({ highWaterMark: highWaterMarkSize });
    const agentBlock = new BlockStream({ size: 2 });
    const callerBlock = new BlockStream({ size: 2 });
    const combinedStream = new PassThrough();
    const combinedStreamBlock = new BlockStream({ size: 4 });

    combinedStream.pipe(combinedStreamBlock);
    interleave([agentBlock, callerBlock]).pipe(combinedStream);

    const socketCallMap:SocketCallData = {
        callMetadata: callMetaData,
        audioInputStream: audioInputStream,
        writeRecordingStream: writeRecordingStream,
        recordingFileSize: recordingFileSize,
        startStreamTime: new Date(),
        agentBlock: agentBlock,
        callerBlock: callerBlock,
        combinedStream: combinedStream,
        combinedStreamBlock: combinedStreamBlock,
        ended: false,
    };
    socketMap.set(ws, socketCallMap);

    await writeCallStartEvent(callMetaData, server);

    combinedStreamBlock.on('data', (chunk) => {
        // server.log.info(`[COMBINED STREAM]: [${clientIP}][${callMetaData.callId}] - Writing combined chunk to audio input stream `);

        audioInputStream.write(chunk);
        writeRecordingStream.write(chunk);
        recordingFileSize.filesize += chunk.byteLength;

    });
    startTranscribe(callMetaData, audioInputStream, socketCallMap, server);
};

// Modify onMedia function to handle Exotel's audio format
const onMedia = async (clientIP: string, ws: WebSocket, data: MediaStreamMediaMessage): Promise<void> => {
    const socketData = socketMap.get(ws);
    let callid = `Stream ID-${data.streamSid}`;
    if (socketData && socketData.callMetadata) {
        callid = socketData.callMetadata.callId;
    }

    if (socketData !== undefined && socketData.audioInputStream !== undefined &&
        socketData.writeRecordingStream !== undefined && socketData.recordingFileSize !== undefined) {
        
        const payload = Buffer.from(data.media.payload, 'base64');

        if (SOURCE_PLATFORM === 'EXOTEL') {
            // Exotel sends 16-bit PCM directly
            socketData.agentBlock.write(payload);
            socketData.callerBlock.write(payload);
        } else {
            // Original Talkdesk handling
            const pcm16 = ulawToL16(payload);
            const pcm16Buffer = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);

            if (data.media.track == 'inbound') {
                socketData.agentBlock.write(pcm16Buffer);
            } else if (data.media.track == 'outbound') {
                socketData.callerBlock.write(pcm16Buffer);
            }
        }
    } else {
        server.log.error(`[ON MEDIA]: [${clientIP}][${callid}] - Error: received 'media' event before receiving 'start' event.`);
    }
};
const endCall = async (ws: WebSocket, callMetaData: CallMetaData|undefined, socketData: SocketCallData): Promise<void> => {
    
    if (callMetaData === undefined) {
        callMetaData = socketData.callMetadata;
    }

    if (socketData !== undefined && socketData.ended === false) {
        if (socketData.audioInputStream !== undefined && socketData.writeRecordingStream !== undefined &&
            socketData.recordingFileSize !== undefined) {
            socketData.agentBlock.end();
            socketData.callerBlock.end();
            socketData.writeRecordingStream.end();

            socketData.ended = true;
            await writeCallEndEvent(callMetaData, server);
            
            const header = createWavHeader(socketData.recordingFileSize.filesize, callMetaData.samplingRate);
            const tempRecordingFilename = getTempRecordingFileName(callMetaData);
            const wavRecordingFilename = getWavRecordingFileName(callMetaData);
            const readStream = fs.createReadStream(path.join(LOCAL_TEMP_DIR, tempRecordingFilename));
            const writeStream = fs.createWriteStream(path.join(LOCAL_TEMP_DIR, wavRecordingFilename));
            
            writeStream.write(header);
            for await (const chunk of readStream) {
                writeStream.write(chunk);
            }
            writeStream.end();
    
            await writeToS3(callMetaData, tempRecordingFilename);
            await writeToS3(callMetaData, wavRecordingFilename);
            await deleteTempFile(callMetaData, path.join(LOCAL_TEMP_DIR, tempRecordingFilename));
            await deleteTempFile(callMetaData, path.join(LOCAL_TEMP_DIR, wavRecordingFilename));
    
            const url = new URL(RECORDING_FILE_PREFIX + wavRecordingFilename, `https://${RECORDINGS_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com`);
            const recordingUrl = url.href;
            
            await writeCallRecordingEvent(callMetaData, recordingUrl, server);
        }
        if (socketData.audioInputStream !== undefined) {
            server.log.debug(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Closing audio input stream:  ${JSON.stringify(callMetaData)}`);
            socketData.audioInputStream.end();
            socketData.audioInputStream.destroy();
        }
        if (socketData !== undefined) {
            server.log.debug(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Deleting websocket from map: ${JSON.stringify(callMetaData)}`);
            socketMap.delete(ws);
        }
    } else {
        server.log.error(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Duplicate End call event. Already received the end call event: ${JSON.stringify(callMetaData)}`);

    }
};

const onStop = async (clientIP: string, ws: WebSocket, data: MediaStreamStopMessage): Promise<void> => {
    const socketData = socketMap.get(ws);
    if (!socketData || !(socketData.callMetadata)) {
        server.log.error(`[${clientIP}]: [${data.stop.callSid}] - Received STOP without starting a call:  ${JSON.stringify(data)}`);
        return;
    }
    server.log.info(`[ON STOP]: [${clientIP}][${data.stop.callSid}] - Received STOP event from client. ${JSON.stringify(data)}`);
    
    const callMetaData: CallMetaData = {
        callEvent: 'END',
        callId: data.stop.callSid,
        fromNumber: 'Customer Phone',
        toNumber: 'System Phone',
        shouldRecordCall: SHOULD_RECORD_CALL === 'true' ? true : false,
        samplingRate: socketData.callMetadata.samplingRate,
        agentId: randomUUID(),
    };

    await endCall(ws, callMetaData, socketData);
};

const onWsClose = async (clientIP: string, ws:WebSocket, code: number): Promise<void> => {
    ws.close(code);
    const socketData = socketMap.get(ws);
    if (socketData !== undefined) {
        server.log.debug(`[ON WSCLOSE]: [${clientIP}][${socketData.callMetadata.callId}] - Writing call end event due to websocket close event ${JSON.stringify(socketData.callMetadata)}`);
        await endCall(ws, undefined, socketData);
    }
};

// Start the websocket server on default port 3000 if no port supplied in environment variables
server.listen(
    { 
        port: parseInt(process.env?.['SERVERPORT'] ?? '8080'),
        host: process.env?.['SERVERHOST'] ?? '127.0.0.1'
    },
    (err) => {
        if (err) {
            server.log.error('Error starting websocket server: ',err);
            process.exit(1);
        }
        server.log.info(`Routes: \n${server.printRoutes()}`);
    }
);


const getTempRecordingFileName = (callMetaData: CallMetaData): string => {
    return `${posixifyFilename(callMetaData.callId)}.raw`;
};

const getWavRecordingFileName = (callMetaData: CallMetaData): string => {
    return `${posixifyFilename(callMetaData.callId)}.wav`;
};

const writeToS3 = async (callMetaData: CallMetaData, tempFileName:string) => {
    const sourceFile = path.join(LOCAL_TEMP_DIR, tempFileName);

    let data;
    const fileStream = fs.createReadStream(sourceFile);
    const uploadParams = {
        Bucket: RECORDINGS_BUCKET_NAME,
        Key: RECORDING_FILE_PREFIX + tempFileName,
        Body: fileStream,
    };
    try {
        data = await s3Client.send(new PutObjectCommand(uploadParams));
        server.log.debug(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Uploaded ${sourceFile} to S3 complete: ${JSON.stringify(data)}`);
    } catch (err) {
        server.log.error(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Error uploading ${sourceFile} to S3: ${normalizeErrorForLogging(err)}`);
    } finally {
        fileStream.destroy();
    }
    return data;
};

export const deleteTempFile = async(callMetaData: CallMetaData, sourceFile:string) => {
    try {
        await fs.promises.unlink(sourceFile);
        server.log.debug(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Deleted tmp file ${sourceFile}`);
    } catch (err) {
        server.log.error(`[${callMetaData.callEvent} LCA EVENT]: [${callMetaData.callId}] - Error deleting tmp file ${sourceFile} : ${normalizeErrorForLogging(err)}`);
    }
};
