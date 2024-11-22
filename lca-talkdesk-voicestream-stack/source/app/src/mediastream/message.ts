// message.ts

export type Uuid = string;  
export type StartEvent = 'start';
export type StopEvent = 'stop';
export type MediaEvent = 'media';
export type ConnectedEvent = 'connected';

export type MediaStreamEventType = 
    | StartEvent 
    | StopEvent 
    | MediaEvent
    | ConnectedEvent;

export type MediaFormat = {
    encoding: string;
    sampleRate?: number;
    channels?: number;
    sample_rate?: string;
    bit_rate?: string;
};

export type MediaStreamConnectedMessage = {
    event: ConnectedEvent;
    protocol?: string;
    version?: string;
}

export type MediaStreamBase<Type extends MediaStreamEventType = MediaStreamEventType> = {
    event: Type;
    sequenceNumber: string;
    streamSid: Uuid;
}

export type MediaStreamStartMessage = MediaStreamBase<StartEvent> & {
    start: {
        accountSid: Uuid;
        streamSid: Uuid;
        callSid: Uuid;
        tracks?: string[];
        from?: string;
        to?: string;
        custom_parameters?: { [key: string]: string };
        mediaFormat: MediaFormat;
    }
}

export type MediaStreamMediaMessage = MediaStreamBase<MediaEvent> & {
    media: {
        track?: string;
        chunk: string | number;
        timestamp: string;
        payload: string;
    }
}

export type MediaStreamStopMessage = MediaStreamBase<StopEvent> & {
    stop: {
        accountSid: Uuid;
        callSid: Uuid;
        reason?: string;
    }
}

export type MediaStreamMessage = 
    | MediaStreamConnectedMessage 
    | MediaStreamStartMessage 
    | MediaStreamMediaMessage 
    | MediaStreamStopMessage;

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