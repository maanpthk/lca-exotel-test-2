// // Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// // SPDX-License-Identifier: Apache-2.0

export type Uuid = string;  
export type StartEvent = 'start';
export type StopEvent = 'stop';
export type MediaEvent = 'media';
export type ConnectedEvent = 'connected';

export const isConnectedEvent = (value: string): value is MediaStreamEventType => (
    (value === 'connected')
);

export const isStartEvent = (value: MediaStreamEventType): value is MediaStreamEventType => (
    (value === 'start')
);

export const isStopEvent = (value: MediaStreamEventType): value is MediaStreamEventType => (
    (value === 'stop')
);

export const isMediaEvent = (value: MediaStreamEventType): value is MediaStreamEventType => (
    (value === 'media')
);

export type MediaStreamEventType = 
    | StartEvent 
    | StopEvent 
    | MediaEvent
    | ConnectedEvent;

export type MediaStreamConnectedMessage = {
    event: ConnectedEvent;
    protocol: string;
    version: string;
}

export type MediaStreamBase<Type extends MediaStreamEventType = MediaStreamEventType> = {
    event: Type;
    sequenceNumber: string;
    streamSid: Uuid;
}

export type MediaStreamMessage = 
    | MediaStreamConnectedMessage 
    | MediaStreamStartMessage 
    | MediaStreamMediaMessage 
    | MediaStreamStopMessage;

//Exotel export

export type ExotelMediaFormat = {
    encoding: string;
    sample_rate: string;
    bit_rate: string;
};

export type ExotelCustomParameters = {
    [key: string]: string;
};

export type MediaStreamStartMessage = MediaStreamBase<StartEvent> & {
    start: {
        accountSid: Uuid;
        streamSid: Uuid;
        callSid: Uuid;
        from?: string; // Added for Exotel
        to?: string; // Added for Exotel
        custom_parameters?: ExotelCustomParameters; // Added for Exotel
        mediaFormat: {
            encoding: string;
            sampleRate: number;
            channels: number;
        } | ExotelMediaFormat; // Support both Talkdesk and Exotel formats
    }
}

export type MediaStreamMediaMessage = MediaStreamBase<MediaEvent> & {
    media: {
        track?: string; // Made optional since Exotel doesn't use it
        chunk: string | number;  // Support both string and number
        timestamp: Uuid | string; // Support both formats
        payload: string;
    }
}

export type MediaStreamStopMessage = MediaStreamBase<StopEvent> & {
    stop: {
        accountSid: Uuid;
        callSid: Uuid;
        reason?: string; // Added for Exotel
    }
}