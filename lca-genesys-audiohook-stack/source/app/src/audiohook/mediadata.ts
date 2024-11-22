// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { MediaParameter, MediaFormat, MediaRate, MediaChannel } from './message';
import { AudioFrame, createAudioFrame } from '../audio';

export type MediaDataFrame = AudioFrame<MediaChannel, MediaFormat, MediaRate>;

export const mediaDataFrameFromMessage = (data: Uint8Array, mediaParameter: MediaParameter): MediaDataFrame => {
    return createAudioFrame(data, mediaParameter);
};
